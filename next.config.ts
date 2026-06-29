import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E (Playwright) starts its own dev server on a separate port + database
  // (see playwright.config.ts). Honor an optional NEXT_DIST_DIR so that server
  // builds into its own directory (e.g. `.next-e2e`) instead of contending with
  // a running `bun run dev` on `.next` — two Turbopack servers sharing one build
  // dir is flaky on Windows.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
