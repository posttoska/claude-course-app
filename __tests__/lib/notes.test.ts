import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Isolate the suite in an in-memory DB (no file on disk). MUST be set before the
// first getDb() call — the handle opens lazily and only reads DATABASE_PATH then.
process.env.DATABASE_PATH = ":memory:";

import { closeDb, get, getDb, run } from "@/lib/db";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNoteByPublicSlug,
  getNotesByUser,
  setNotePublic,
  updateNote,
} from "@/lib/notes";

// The `notes` table FKs to better-auth's `user` table, which doesn't exist in a
// bare in-memory DB. A minimal stub (just the `id` PK the FK targets) is enough
// to satisfy the constraint; two users let us prove cross-owner authorization.
function seedUsers(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY NOT NULL, email TEXT);`);
  for (const id of ["alice", "bob"]) {
    run('INSERT INTO "user" (id, email) VALUES ($id, $email)', {
      $id: id,
      $email: `${id}@example.com`,
    });
  }
}

/** Shape of the raw persisted row we assert against directly. */
type StoredNote = {
  user_id: string;
  is_public: number;
  content_json: string;
  public_slug: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("lib/notes (repository)", () => {
  beforeEach(() => {
    // A :memory: DB lives only as long as its connection, so closeDb() gives each
    // test a clean slate; getDb() then reopens a fresh handle (and re-applies the
    // notes schema) before we seed the `user` FK target.
    closeDb();
    seedUsers();
  });

  afterAll(() => {
    closeDb();
  });

  describe("createNote()", () => {
    it("applies defaults (title, empty doc, private) and persists the row", async () => {
      const note = await createNote("alice");

      expect(note.id).toMatch(UUID_RE);
      expect(note.userId).toBe("alice");
      expect(note.title).toBe("Untitled note");
      expect(note.contentJson).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
      expect(note.isPublic).toBe(false);
      expect(note.publicSlug).toBeNull();
      // created_at === updated_at on insert.
      expect(note.createdAt).toBe(note.updatedAt);

      const row = get<StoredNote>("SELECT * FROM notes WHERE id = $id", { $id: note.id });
      expect(row).not.toBeNull();
      expect(row?.user_id).toBe("alice");
      expect(row?.is_public).toBe(0);
      // Content is stored as a JSON *string*, never raw HTML (SPEC §5.3).
      expect(typeof row?.content_json).toBe("string");
      expect(JSON.parse(row!.content_json)).toEqual(note.contentJson);
    });

    it("honors a provided title and content", async () => {
      const contentJson = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
      };
      const note = await createNote("alice", { title: "Custom", contentJson });

      expect(note.title).toBe("Custom");
      expect(note.contentJson).toEqual(contentJson);
    });

    it("generates a unique UUID per note", async () => {
      const a = await createNote("alice");
      const b = await createNote("alice");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("getNoteById() / getNotesByUser()", () => {
    it("returns the note for its owner", async () => {
      const note = await createNote("alice", { title: "Owned" });
      expect(getNoteById("alice", note.id)?.title).toBe("Owned");
    });

    it("enforces ownership — a non-owner or missing id returns null (404, not 403)", async () => {
      const note = await createNote("alice");
      expect(getNoteById("bob", note.id)).toBeNull();
      expect(getNoteById("alice", "does-not-exist")).toBeNull();
    });

    it("lists only the user's own notes, newest-edited first", async () => {
      const a1 = await createNote("alice", { title: "older" });
      const a2 = await createNote("alice", { title: "newer" });
      await createNote("bob", { title: "bob's" });

      // Force deterministic ordering (ms-resolution createNote timestamps can tie).
      run("UPDATE notes SET updated_at = $t WHERE id = $id", {
        $t: "2020-01-01T00:00:00.000Z",
        $id: a1.id,
      });
      run("UPDATE notes SET updated_at = $t WHERE id = $id", {
        $t: "2020-06-01T00:00:00.000Z",
        $id: a2.id,
      });

      const aliceNotes = getNotesByUser("alice");
      expect(aliceNotes).toHaveLength(2);
      expect(aliceNotes.map((n) => n.title)).toEqual(["newer", "older"]);

      expect(getNotesByUser("bob")).toHaveLength(1);
    });
  });

  describe("updateNote()", () => {
    it("applies a partial update and always bumps updated_at", async () => {
      const note = await createNote("alice", { title: "Orig" });
      // Establish a known-old baseline so the bump is deterministic (no ms tie).
      const baseline = "2000-01-01T00:00:00.000Z";
      run("UPDATE notes SET updated_at = $t WHERE id = $id", { $t: baseline, $id: note.id });

      const updated = updateNote("alice", note.id, { title: "Changed" });
      expect(updated?.title).toBe("Changed");
      expect(updated?.updatedAt).not.toBe(baseline);
      expect(updated!.updatedAt > baseline).toBe(true);
      // An omitted field is left untouched.
      expect(updated?.contentJson).toEqual(note.contentJson);
    });

    it("enforces ownership — a non-owner cannot update and gets null", async () => {
      const note = await createNote("alice", { title: "Orig" });
      expect(updateNote("bob", note.id, { title: "Hacked" })).toBeNull();
      // The note is untouched.
      expect(getNoteById("alice", note.id)?.title).toBe("Orig");
    });
  });

  describe("deleteNote()", () => {
    it("only deletes a note the user owns", async () => {
      const note = await createNote("alice");

      expect(deleteNote("bob", note.id)).toBe(false);
      expect(getNoteById("alice", note.id)).not.toBeNull(); // intact

      expect(deleteNote("alice", note.id)).toBe(true);
      expect(getNoteById("alice", note.id)).toBeNull(); // gone

      // Idempotent: re-deleting an already-gone note returns false, no throw.
      expect(deleteNote("alice", note.id)).toBe(false);
    });
  });

  describe("setNotePublic() / getNoteByPublicSlug()", () => {
    it("mints a slug on enable, keeps it on disable, and reuses it on re-enable", async () => {
      const note = await createNote("alice");
      expect(note.publicSlug).toBeNull();

      // Enable: mints a high-entropy slug, flips is_public, public lookup works.
      const shared = setNotePublic("alice", note.id, true);
      expect(shared?.isPublic).toBe(true);
      expect(shared?.publicSlug).toBeTruthy();
      expect(shared!.publicSlug!.length).toBe(21);
      const slug = shared!.publicSlug!;
      expect(getNoteByPublicSlug(slug)?.id).toBe(note.id);

      // Disable: KEEPS the slug (SPEC §10.2 — re-share yields the same URL) but the
      // public lookup 404s because it is gated solely on is_public = 1. NOTE: this
      // matches the SPEC-authoritative implementation, which intentionally does NOT
      // "clear" the slug as the prd step loosely words it — don't "fix" this back.
      const unshared = setNotePublic("alice", note.id, false);
      expect(unshared?.isPublic).toBe(false);
      expect(unshared?.publicSlug).toBe(slug);
      expect(getNoteByPublicSlug(slug)).toBeNull();

      // Re-enable: reuses the same slug, lookup works again.
      const reshared = setNotePublic("alice", note.id, true);
      expect(reshared?.publicSlug).toBe(slug);
      expect(getNoteByPublicSlug(slug)?.id).toBe(note.id);
    });

    it("enforces ownership and never matches an unknown slug", async () => {
      const note = await createNote("alice");
      expect(setNotePublic("bob", note.id, true)).toBeNull();
      expect(getNoteByPublicSlug("this-slug-does-not-exist")).toBeNull();
    });
  });
});
