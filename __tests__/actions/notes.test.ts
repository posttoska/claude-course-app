import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolate the suite in an in-memory DB (no file on disk). MUST be set before the
// first getDb() call — the handle opens lazily and only reads DATABASE_PATH then.
process.env.DATABASE_PATH = ":memory:";

// Mock the auth surface so the actions' getSession() is controllable per test AND
// so importing them never pulls in the real lib/auth — which runs better-auth's
// migrations in a top-level await against bun:sqlite, unavailable under Vitest/Node
// (the progress notes warn: don't drive better-auth flows from Vitest). The repo
// layer (lib/notes -> lib/db, node:sqlite under Node) is NOT mocked, so the actions
// exercise their real guard order against a real database.
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

// revalidatePath throws outside a Next request scope; mock it so the actions run
// here and we can assert which paths each mutation purges.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { closeDb, getDb, run } from "@/lib/db";
import { getNoteById, getNoteByPublicSlug } from "@/lib/notes";
import {
  createNoteAction,
  deleteNoteAction,
  toggleShareAction,
  updateNoteAction,
} from "@/lib/actions/notes";

const mockGetSession = vi.mocked(getSession);
const mockRevalidatePath = vi.mocked(revalidatePath);

type SessionResult = Awaited<ReturnType<typeof getSession>>;

/** Drive getSession() to report `userId` as the signed-in user. */
function signInAs(userId: string): void {
  mockGetSession.mockResolvedValue({
    user: { id: userId },
    session: { userId },
  } as unknown as NonNullable<SessionResult>);
}

/** Drive getSession() to report no session (signed out). */
function signOut(): void {
  mockGetSession.mockResolvedValue(null);
}

// The `notes` table FKs to better-auth's `user` table, absent in a bare in-memory
// DB. A minimal stub (just the `id` PK the FK targets) satisfies the constraint;
// two users let us prove cross-owner authorization (404, not 403).
function seedUsers(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY NOT NULL, email TEXT);`);
  for (const id of ["alice", "bob"]) {
    run('INSERT INTO "user" (id, email) VALUES ($id, $email)', {
      $id: id,
      $email: `${id}@example.com`,
    });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("lib/actions/notes (server actions)", () => {
  beforeEach(() => {
    // Reset mock call history + return values between tests. A :memory: DB lives
    // only as long as its connection, so closeDb() gives each test a clean slate;
    // getDb() then reopens a fresh handle (re-applying the notes schema) before we
    // seed the `user` FK target.
    vi.clearAllMocks();
    closeDb();
    seedUsers();
  });

  afterAll(() => {
    closeDb();
  });

  describe("createNoteAction()", () => {
    it("creates a note for the signed-in user and revalidates the dashboard", async () => {
      signInAs("alice");

      const result = await createNoteAction();

      expect(result.ok).toBe(true);
      if (!result.ok) return; // narrow for the assertions below
      expect(result.data.id).toMatch(UUID_RE);
      expect(result.data.userId).toBe("alice");
      expect(result.data.title).toBe("Untitled note");
      expect(result.data.isPublic).toBe(false);

      // Actually persisted and owned by alice.
      expect(getNoteById("alice", result.data.id)?.id).toBe(result.data.id);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("honors a provided title and content", async () => {
      signInAs("alice");
      const contentJson = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
      };

      const result = await createNoteAction({ title: "Custom", contentJson });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.title).toBe("Custom");
      expect(result.data.contentJson).toEqual(contentJson);
    });

    it("rejects an unauthenticated caller without touching the DB", async () => {
      signOut();

      const result = await createNoteAction();

      expect(result).toEqual({ ok: false, error: expect.any(String) });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("rejects content that is not a valid TipTap doc", async () => {
      signInAs("alice");

      // type must be the literal "doc" — this fails Zod validation.
      const result = await createNoteAction({ contentJson: { type: "image" } });

      expect(result).toEqual({ ok: false, error: "Invalid note data." });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateNoteAction()", () => {
    it("applies the update for the owner and revalidates both paths", async () => {
      signInAs("alice");
      const created = await createNoteAction({ title: "Orig" });
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;
      mockRevalidatePath.mockClear();

      const result = await updateNoteAction(id, { title: "Changed" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.title).toBe("Changed");
      expect(getNoteById("alice", id)?.title).toBe("Changed");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/notes/${id}`);
    });

    it("enforces ownership — a non-owner gets 'Note not found.' and the note is untouched", async () => {
      signInAs("alice");
      const created = await createNoteAction({ title: "Orig" });
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;

      signInAs("bob");
      mockRevalidatePath.mockClear();
      const result = await updateNoteAction(id, { title: "Hacked" });

      expect(result).toEqual({ ok: false, error: "Note not found." });
      // Alice's note is unchanged, and nothing was revalidated.
      expect(getNoteById("alice", id)?.title).toBe("Orig");
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated caller", async () => {
      signOut();
      const result = await updateNoteAction("any-id", { title: "x" });
      expect(result.ok).toBe(false);
    });
  });

  describe("deleteNoteAction()", () => {
    it("deletes a note the user owns and revalidates", async () => {
      signInAs("alice");
      const created = await createNoteAction();
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;
      mockRevalidatePath.mockClear();

      const result = await deleteNoteAction(id);

      expect(result).toEqual({ ok: true, data: { id } });
      expect(getNoteById("alice", id)).toBeNull(); // gone
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("enforces ownership — a non-owner cannot delete and the note survives", async () => {
      signInAs("alice");
      const created = await createNoteAction();
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;

      signInAs("bob");
      const result = await deleteNoteAction(id);

      expect(result).toEqual({ ok: false, error: "Note not found." });
      expect(getNoteById("alice", id)).not.toBeNull(); // intact
    });

    it("rejects an unauthenticated caller", async () => {
      signOut();
      const result = await deleteNoteAction("any-id");
      expect(result.ok).toBe(false);
    });
  });

  describe("toggleShareAction()", () => {
    it("enables sharing — mints a slug, makes the note publicly reachable, revalidates the public page", async () => {
      signInAs("alice");
      const created = await createNoteAction();
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;
      mockRevalidatePath.mockClear();

      const result = await toggleShareAction(id, true);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.isPublic).toBe(true);
      expect(result.data.publicSlug).toBeTruthy();
      const slug = result.data.publicSlug!;
      // Now publicly reachable by its slug.
      expect(getNoteByPublicSlug(slug)?.id).toBe(id);
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/p/${slug}`);
    });

    it("disables sharing — keeps the slug but the public lookup 404s", async () => {
      signInAs("alice");
      const created = await createNoteAction();
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;

      const enabled = await toggleShareAction(id, true);
      if (!enabled.ok) throw new Error("enable failed");
      const slug = enabled.data.publicSlug!;

      const disabled = await toggleShareAction(id, false);

      expect(disabled.ok).toBe(true);
      if (!disabled.ok) return;
      expect(disabled.data.isPublic).toBe(false);
      // Slug is retained (SPEC §10.2 — re-share yields the same URL) ...
      expect(disabled.data.publicSlug).toBe(slug);
      // ... but the public lookup is gated on is_public = 1, so it 404s.
      expect(getNoteByPublicSlug(slug)).toBeNull();
    });

    it("enforces ownership — a non-owner cannot share", async () => {
      signInAs("alice");
      const created = await createNoteAction();
      if (!created.ok) throw new Error("setup failed");
      const id = created.data.id;

      signInAs("bob");
      const result = await toggleShareAction(id, true);

      expect(result).toEqual({ ok: false, error: "Note not found." });
      // Alice's note stays private.
      expect(getNoteById("alice", id)?.isPublic).toBe(false);
    });

    it("rejects an unauthenticated caller", async () => {
      signOut();
      const result = await toggleShareAction("any-id", true);
      expect(result.ok).toBe(false);
    });
  });
});
