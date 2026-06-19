import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// One shared SQLite handle for the whole app. Both lib/auth.ts (better-auth's
// Kysely adapter) and the notes data layer import THIS instance — single file,
// single connection.
const DB_PATH = process.env.DATABASE_PATH ?? "./data/app.sqlite";

// SQLite does not create the parent directory; ensure it exists before opening.
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });

// Connection-level pragmas (safe to run on every cold start):
// - WAL is a persistent file property (better read concurrency).
// - foreign_keys is per-connection, so it must be set on every open to enforce
//   ON DELETE CASCADE.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// App-owned schema. better-auth owns user/session/account/verification and
// creates them itself (see lib/auth.ts); the `notes` table is ours.
// SQLite allows a forward foreign-key reference to "user" before that table
// exists — the constraint is only enforced on row writes, by which point auth
// has created it.
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title       TEXT,
    content     TEXT    NOT NULL,
    is_public   INTEGER NOT NULL DEFAULT 0,
    public_id   TEXT    UNIQUE,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
`);
