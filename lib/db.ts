// Single shared SQLite handle plus small, typed query helpers.
//
// Runtime: the app runs under Bun (dev/build/start use `--bun`), where the data
// layer uses `bun:sqlite`. Under plain Node — e.g. the Vitest test runner — it
// transparently falls back to `node:sqlite` (`DatabaseSync`). Both drivers expose
// the same `prepare`/`get`/`all`/`run` surface and accept `$name` parameter
// binding, so the rest of the app stays driver-agnostic (SPEC §3.2, §17).
//
// All queries are parameterized ($name binds) — never interpolate user input.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const nodeRequire = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

/** Allowed bind value types (SQLite booleans are stored as 0/1 integers). */
export type QueryParams = Record<string, string | number | bigint | null | Uint8Array>;

/** Normalized result of a write (`INSERT`/`UPDATE`/`DELETE`). */
export type RunResult = { changes: number; lastInsertRowid: number };

type RawStatement = {
  get(params?: QueryParams): unknown;
  all(params?: QueryParams): unknown[];
  run(params?: QueryParams): { changes: number | bigint; lastInsertRowid: number | bigint };
};

type RawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): RawStatement;
  close?(): void;
};

let db: RawDatabase | null = null;
const statementCache = new Map<string, RawStatement>();

function openDatabase(): RawDatabase {
  const path = process.env.DATABASE_PATH ?? "./data/app.sqlite";
  if (path !== ":memory:") {
    // bun:sqlite/node:sqlite create the file but not its parent directory.
    mkdirSync(dirname(path), { recursive: true });
  }

  // Variable specifier keeps the bundler from statically resolving the unused
  // driver; each branch only ever executes under its own runtime.
  const specifier = isBun ? "bun:sqlite" : "node:sqlite";
  const sqlite = nodeRequire(specifier) as {
    Database?: new (path: string, opts?: { create?: boolean }) => RawDatabase;
    DatabaseSync?: new (path: string) => RawDatabase;
  };

  const instance = isBun
    ? new sqlite.Database!(path, { create: true })
    : new sqlite.DatabaseSync!(path);

  instance.exec("PRAGMA journal_mode = WAL;"); // better read concurrency
  instance.exec("PRAGMA foreign_keys = ON;"); // enforce ON DELETE CASCADE
  return instance;
}

/** Lazily opens (once) and returns the shared SQLite handle — a singleton. */
export function getDb(): RawDatabase {
  if (!db) db = openDatabase();
  return db;
}

/** Prepared-statement cache so repeated SQL reuses one compiled statement. */
function prepare(sql: string): RawStatement {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = getDb().prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}

/** Run a `SELECT` and return all matching rows, typed as `T`. */
export function query<T>(sql: string, params?: QueryParams): T[] {
  const stmt = prepare(sql);
  return (params ? stmt.all(params) : stmt.all()) as T[];
}

/** Run a `SELECT` and return the first row (or `null`), typed as `T`. */
export function get<T>(sql: string, params?: QueryParams): T | null {
  const stmt = prepare(sql);
  const row = params ? stmt.get(params) : stmt.get();
  return (row ?? null) as T | null;
}

/** Run an `INSERT`/`UPDATE`/`DELETE` and return change count + last row id. */
export function run(sql: string, params?: QueryParams): RunResult {
  const stmt = prepare(sql);
  const result = params ? stmt.run(params) : stmt.run();
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

/** Close the handle and clear caches. Primarily for test isolation. */
export function closeDb(): void {
  db?.close?.();
  db = null;
  statementCache.clear();
}
