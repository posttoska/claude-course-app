import { test, expect } from "@playwright/test";
import { login, newCredentials, signUp, uniqueEmail } from "./helpers/auth";

// E2E tests for the authentication flow (prd "Write E2E tests for authentication").
// They drive the real /authenticate UI and the Header's logout control, exercising
// the full better-auth round trip (cookie set on the server, session re-read by the
// Server Component header) exactly as a user would. The harness (config, isolated
// test server + DB, helpers) is already proven by smoke.spec.ts.

test.describe("authentication", () => {
  test("a new user can sign up and is redirected to the dashboard", async ({ page }) => {
    // signUp() fills the form and waits for the post-success redirect to /dashboard.
    await signUp(page, newCredentials("signup"));

    await expect(page).toHaveURL(/\/dashboard$/);
    // The signed-in header shows the logout control — proof of an active session.
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("an existing user can log in and is redirected to the dashboard", async ({
    page,
    request,
  }) => {
    // Seed the account through the auth API using the test's ISOLATED request
    // context, so its session cookie never reaches the browser page — the page
    // starts anonymous and we exercise the login UI in isolation.
    const credentials = newCredentials("login");
    const response = await request.post("/api/auth/sign-up/email", {
      data: {
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
      },
    });
    expect(response.ok()).toBeTruthy();

    // login() fills the form and waits for the redirect to /dashboard.
    await login(page, credentials);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("invalid credentials show an error and stay on the auth page", async ({ page }) => {
    await page.goto("/authenticate");

    // A non-existent account + wrong password. better-auth returns the same error
    // for unknown email and wrong password (no user enumeration); the form surfaces
    // it inline in a role="alert" region.
    await page.getByLabel("Email").fill(uniqueEmail("nobody"));
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    // The failed attempt must NOT navigate away — no session was created.
    await expect(page).toHaveURL(/\/authenticate$/);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("logging out clears the session and returns to the landing page", async ({ page }) => {
    await signUp(page, newCredentials("logout"));

    await page.getByRole("button", { name: "Log out" }).click();
    // LogoutButton navigates home after signing out.
    await page.waitForURL((url) => url.pathname === "/");

    // The header reverts to its signed-out state. Scope to the nav: the landing
    // page also has a "Log in" CTA, so an unscoped query is ambiguous.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Log in" })).toBeVisible();

    // The session is truly gone: the protected dashboard now bounces to /authenticate.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/authenticate$/);
  });
});
