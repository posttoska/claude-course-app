import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Unit-test config. We test the app's pure logic (validation, content-label
// derivation, the static NoteContent renderer) plus the server actions with
// their DB/session/Next deps mocked — none of this touches `bun:sqlite`, which
// can't load under Vitest. `resolve.tsconfigPaths` wires up the `@/*` alias from
// tsconfig (native in modern Vite); the React plugin handles JSX/TSX; jsdom
// backs the renderer tests.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
});
