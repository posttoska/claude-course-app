import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

// Vitest runs under the Node runtime (not Bun). The data layer in lib/db.ts is
// driver-agnostic and falls back to node:sqlite there, so the repository/action
// code is testable here without a Bun process. React component tests use jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Unit/integration tests live under __tests__/ (mirrors the source layout:
    // __tests__/lib/*, __tests__/actions/*). node_modules is excluded by default.
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    // Mirror tsconfig.json's "@/*" -> project root so tests import the same way
    // the app does (e.g. `import { db } from "@/lib/db"`).
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
});
