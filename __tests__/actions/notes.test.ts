import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks are defined via vi.hoisted so the (hoisted) vi.mock factories below can
// reference them. None of the real modules load — so `bun:sqlite` (lib/db) is
// never imported, and we can assert on the SQL/params, revalidation, and the
// session -> ownership -> validate -> SQL -> revalidate guard order.
const h = vi.hoisted(() => {
  const run = vi.fn();
  return {
    run,
    query: vi.fn((_sql: string) => ({ run })),
    getSession: vi.fn(),
    getOwnedNote: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      const err = new Error("NEXT_REDIRECT") as Error & { url?: string };
      err.url = url;
      throw err;
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: { query: h.query } }));
vi.mock("@/lib/session", () => ({ getSession: h.getSession }));
vi.mock("@/lib/notes", () => ({ getOwnedNote: h.getOwnedNote }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));

import { createNote, deleteNote, setNoteSharing, updateNote } from "@/actions/notes";

const VALID_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

beforeEach(() => {
  vi.clearAllMocks(); // resets call history; keeps the query/redirect implementations
});

describe("createNote", () => {
  it("inserts the note and redirects to the dashboard", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    const fd = new FormData();
    fd.set("title", "Hello");
    fd.set("content", JSON.stringify(VALID_DOC));

    await expect(createNote(fd)).rejects.toThrow("NEXT_REDIRECT");

    expect(h.query.mock.calls[0][0]).toContain("INSERT INTO notes");
    const params = h.run.mock.calls[0][0];
    expect(params.$uid).toBe("u1");
    expect(params.$title).toBe("Hello");
    expect(JSON.parse(params.$content)).toMatchObject({ type: "doc" });
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(h.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /login and never writes when unauthenticated", async () => {
    h.getSession.mockResolvedValue(null);

    await expect(createNote(new FormData())).rejects.toThrow("NEXT_REDIRECT");

    expect(h.redirect).toHaveBeenCalledWith("/login");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("throws INVALID_INPUT on malformed content and never writes", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    const fd = new FormData();
    fd.set("content", "{not json");

    await expect(createNote(fd)).rejects.toThrow("INVALID_INPUT");
    expect(h.query).not.toHaveBeenCalled();
  });
});

describe("updateNote", () => {
  it("returns NOT_FOUND for a note the user does not own (no write)", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue(null);

    const res = await updateNote("n1", { content: VALID_DOC });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("writes and revalidates when the note is owned", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue({ id: "n1", user_id: "u1" });

    const res = await updateNote("n1", { title: "T", content: VALID_DOC });

    expect(res).toEqual({ ok: true });
    expect(h.query.mock.calls[0][0]).toContain("UPDATE notes");
    const params = h.run.mock.calls[0][0];
    expect(params.$id).toBe("n1");
    expect(params.$uid).toBe("u1");
    expect(params.$title).toBe("T");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(h.revalidatePath).toHaveBeenCalledWith("/notes/n1");
  });

  it("returns INVALID_INPUT for a non-doc payload (no write)", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue({ id: "n1", user_id: "u1" });

    const res = await updateNote("n1", { content: { not: "a doc" } });

    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(h.query).not.toHaveBeenCalled();
  });
});

describe("deleteNote", () => {
  it("deletes scoped by user_id and revalidates the dashboard", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });

    await deleteNote("n1");

    expect(h.query.mock.calls[0][0]).toContain("DELETE FROM notes");
    const params = h.run.mock.calls[0][0];
    expect(params.$id).toBe("n1");
    expect(params.$uid).toBe("u1");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

describe("setNoteSharing", () => {
  it("returns NOT_FOUND for a non-owned note (no write)", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue(null);

    const res = await setNoteSharing("n1", true);

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("generates a public_id on first share and revalidates the share path", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue({ id: "n1", user_id: "u1", public_id: null });

    const res = await setNoteSharing("n1", true);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isPublic).toBe(true);
      expect(typeof res.publicId).toBe("string");
    }
    const params = h.run.mock.calls[0][0];
    expect(params.$pub).toBe(1);
    expect(params.$pid).toBeTruthy();
    expect(h.revalidatePath).toHaveBeenCalledWith(`/share/${params.$pid}`);
  });

  it("reuses the existing public_id when re-sharing", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue({ id: "n1", user_id: "u1", public_id: "existing-pid" });

    const res = await setNoteSharing("n1", true);

    expect(res.ok && res.publicId).toBe("existing-pid");
    expect(h.run.mock.calls[0][0].$pid).toBe("existing-pid");
  });

  it("keeps the public_id when unsharing so the link can be revived", async () => {
    h.getSession.mockResolvedValue({ user: { id: "u1" } });
    h.getOwnedNote.mockReturnValue({ id: "n1", user_id: "u1", public_id: "existing-pid" });

    const res = await setNoteSharing("n1", false);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isPublic).toBe(false);
      expect(res.publicId).toBe("existing-pid");
    }
    const params = h.run.mock.calls[0][0];
    expect(params.$pub).toBe(0);
    expect(params.$pid).toBe("existing-pid");
  });
});
