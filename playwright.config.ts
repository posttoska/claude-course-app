import { defineConfig, devices } from "@playwright/test";

// Playwright E2E configuration (prd "Set up Playwright for E2E testing").
//
// Isolation — the E2E server is fully decoupled from local development:
//   • Port 3100 (dev runs on 3000), so both can run at once.
//   • DATABASE_PATH=./data/test.sqlite — a dedicated, disposable SQLite file
//     (lib/db.ts reads this); globalSetup wipes it before each run.
//   • NEXT_DIST_DIR=.next-e2e — its own Turbopack build dir (next.config.ts), so
//     it never contends with a running `bun run dev` on `.next`.
//   • BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL point at :3100 so better-auth's
//     origin checks and share links match the test server.
//
// SQLite is a single-writer file, so tests run serially (workers: 1) to avoid
// "database is locked" contention from parallel auth/note writes.

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Cold Turbopack route compiles + first-request auth migrations can be slow.
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: "./data/test.sqlite",
      NEXT_DIST_DIR: ".next-e2e",
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
