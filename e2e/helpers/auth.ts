import { type Page } from "@playwright/test";

// Auth helpers for E2E specs (prd "Create e2e/helpers/auth.ts with signUp/login
// helpers"). They drive the real /authenticate UI — the forms call better-auth's
// browser client, which sets the session cookie — then wait for the post-success
// redirect to /dashboard, so specs obtain an authenticated session exactly the
// way a real user would.

export type Credentials = {
  name?: string;
  email: string;
  password: string;
};

const DEFAULT_PASSWORD = "test-password-123";

// Cold dev-server route compiles + first-request auth migrations can be slow, so
// give the post-auth redirect a generous window.
const REDIRECT_TIMEOUT = 60_000;

/** A unique email so repeated runs (or a non-pristine DB) never collide. */
export function uniqueEmail(prefix = "user"): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}@example.com`;
}

/** Fresh signup credentials with sensible defaults and a unique email. */
export function newCredentials(prefix = "user"): Required<Credentials> {
  return {
    name: "Test User",
    email: uniqueEmail(prefix),
    password: DEFAULT_PASSWORD,
  };
}

/** Sign up a new account through the UI and land on the dashboard. */
export async function signUp(page: Page, credentials: Credentials): Promise<void> {
  const { name = "Test User", email, password } = credentials;

  await page.goto("/authenticate");
  // The page opens in login mode; the only "Sign up" control here is the toggle.
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // After toggling, the only "Sign up" control is the form's submit button.
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL("**/dashboard", { timeout: REDIRECT_TIMEOUT });
}

/** Log in to an existing account through the UI and land on the dashboard. */
export async function login(page: Page, credentials: Credentials): Promise<void> {
  const { email, password } = credentials;

  await page.goto("/authenticate");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await page.waitForURL("**/dashboard", { timeout: REDIRECT_TIMEOUT });
}
