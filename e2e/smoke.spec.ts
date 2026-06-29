import { test, expect } from "@playwright/test";
import { newCredentials, signUp } from "./helpers/auth";

// Smoke tests that verify the E2E harness itself works end-to-end: the Playwright
// config, the dedicated test server (port 3100 + ./data/test.sqlite + .next-e2e),
// and the auth helpers. The feature specs (auth/notes/sharing/responsive) are
// separate prd tasks; this file just proves `bun run test:e2e` runs and passes.

test("landing page renders with the app header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Notes" })).toBeVisible();
});

test("authenticate page renders the login form", async ({ page }) => {
  await page.goto("/authenticate");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("a new user can sign up and reach the dashboard", async ({ page }) => {
  await signUp(page, newCredentials("smoke"));
  // The signed-in header shows the logout control — proof of an active session.
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});
