import { rmSync } from "node:fs";

// Test database setup (prd "Create e2e/setup.ts for test database setup").
//
// E2E runs against a dedicated SQLite file (./data/test.sqlite — the webServer's
// DATABASE_PATH in playwright.config.ts). Running this wipes it (plus its WAL/SHM
// sidecars) so every run starts from an empty database; the server then recreates
// the schema on cold start (lib/db.ts applyNotesSchema + better-auth migrations).
//
// It runs from the `test:e2e` script BEFORE Playwright launches the server
// (`bun e2e/setup.ts && playwright test`), while the file is still free to delete.
// (A Playwright globalSetup would run only AFTER the server has opened the DB —
// too late to reset it — hence this explicit pre-launch step.)

const TEST_DB_FILES = ["./data/test.sqlite", "./data/test.sqlite-wal", "./data/test.sqlite-shm"];

/** Remove the disposable E2E database so the next run starts from a clean slate. */
export function resetTestDb(): void {
  for (const file of TEST_DB_FILES) {
    try {
      rmSync(file, { force: true }); // force:true ignores a missing file
    } catch (error) {
      // EPERM/EBUSY: a process still holds the file — safe to skip. Re-throw else.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY") throw error;
    }
  }
}

// Executed directly via `bun e2e/setup.ts` (the file is the entry point).
if ((import.meta as { main?: boolean }).main) resetTestDb();
