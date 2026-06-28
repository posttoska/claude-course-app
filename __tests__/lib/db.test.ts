import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Use an in-memory database so the suite is fully isolated and leaves no file on
// disk. This MUST be set before the first getDb() call — the handle opens lazily
// (openDatabase only reads DATABASE_PATH on first use), so assigning it here,
// before any test runs, is sufficient even though the import below is hoisted.
process.env.DATABASE_PATH = ":memory:";

import { closeDb, get, getDb, query, run } from "@/lib/db";

type Item = { id: number; name: string; value: number };

// A throwaway table for exercising the generic helpers in isolation, so the
// tests don't depend on the `notes`/`user` schema (notes has a FK to the
// better-auth `user` table, which doesn't exist in this bare in-memory DB).
function createItemsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS items (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL,
      value INTEGER NOT NULL
    );
  `);
}

function insertItem(name: string, value: number) {
  return run("INSERT INTO items (name, value) VALUES ($name, $value)", {
    $name: name,
    $value: value,
  });
}

describe("lib/db", () => {
  beforeEach(() => {
    // A :memory: database lives only as long as its connection, so closeDb()
    // gives every test a clean slate; reopening via createItemsTable -> getDb()
    // also clears the prepared-statement cache so no statement bound to a closed
    // handle leaks across tests.
    closeDb();
    createItemsTable();
  });

  afterAll(() => {
    closeDb();
  });

  describe("getDb()", () => {
    it("returns the same instance on repeated calls (singleton)", () => {
      expect(getDb()).toBe(getDb());
    });

    it("opens a fresh instance after closeDb()", () => {
      const first = getDb();
      closeDb();
      const second = getDb();
      // Compare identity as a plain boolean — passing the native handles to a
      // matcher would let vitest deep-traverse the now-closed `first` (its
      // "did you mean toEqual?" hint), which throws "database is not open".
      expect(Object.is(first, second)).toBe(false);
    });
  });

  describe("run()", () => {
    it("INSERT reports one change and a numeric last row id", () => {
      const result = insertItem("alpha", 1);
      expect(result.changes).toBe(1);
      expect(typeof result.lastInsertRowid).toBe("number");
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it("UPDATE reports the number of affected rows", () => {
      insertItem("a", 1);
      insertItem("b", 1);
      insertItem("c", 2);
      const result = run("UPDATE items SET value = $value WHERE value = $old", {
        $value: 9,
        $old: 1,
      });
      expect(result.changes).toBe(2);
    });

    it("DELETE reports the number of removed rows", () => {
      insertItem("a", 1);
      insertItem("b", 2);
      const result = run("DELETE FROM items WHERE name = $name", { $name: "a" });
      expect(result.changes).toBe(1);
      expect(query<Item>("SELECT * FROM items")).toHaveLength(1);
    });
  });

  describe("query<T>()", () => {
    it("returns all matching rows typed as T", () => {
      insertItem("a", 1);
      insertItem("b", 2);
      const rows = query<Item>("SELECT * FROM items ORDER BY value ASC");
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.name)).toEqual(["a", "b"]);
      expect(rows[0]).toMatchObject({ name: "a", value: 1 });
    });

    it("binds $name parameters and returns only matches", () => {
      insertItem("keep", 1);
      insertItem("drop", 2);
      const rows = query<Item>("SELECT * FROM items WHERE name = $name", {
        $name: "keep",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("keep");
    });

    it("returns an empty array when nothing matches", () => {
      const rows = query<Item>("SELECT * FROM items WHERE name = $name", {
        $name: "nope",
      });
      expect(rows).toEqual([]);
    });
  });

  describe("get<T>()", () => {
    it("returns a single matching row", () => {
      insertItem("solo", 7);
      const row = get<Item>("SELECT * FROM items WHERE name = $name", {
        $name: "solo",
      });
      expect(row).not.toBeNull();
      expect(row?.value).toBe(7);
    });

    it("returns null when no row matches", () => {
      const row = get<Item>("SELECT * FROM items WHERE name = $name", {
        $name: "ghost",
      });
      expect(row).toBeNull();
    });
  });
});
