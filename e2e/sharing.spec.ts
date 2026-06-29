import { test, expect, type Page } from "@playwright/test";
import { newCredentials, signUp } from "./helpers/auth";

// E2E tests for the public-sharing flow (prd "Write E2E tests for note sharing").
// They drive the real ShareToggle on the /notes/[id] editor end-to-end: flipping a
// note public, reading its unguessable share link, an ANONYMOUS visitor reading the
// shared note, the is_public=1 gate (an unshared note 404s on its old link), a 404
// for an unknown slug, and Copy-to-clipboard. Every toggle exercises the genuine
// toggleShareAction Server Action + the SQLite round trip. The harness (config,
// isolated test server + DB, helpers) is already proven by smoke/auth/notes specs.

// The TipTap editable body — a stable selector across TipTap versions (the title is
// a plain <input>, so this contenteditable is unambiguous). Matches notes.spec.
const EDITOR_BODY = '[contenteditable="true"]';

// Auto-save settles into "Saved" in the role="status" indicator. Generous timeout:
// a cold Turbopack route compile on first hit is slow, and the debounce adds ~1.5s.
const SAVE_TIMEOUT = 20_000;

// The toggle raises a transient toast (auto-dismisses after 3s). Allow for that.
const TOAST_CLEAR_TIMEOUT = 6_000;

/**
 * Sign up a fresh user, create a note, set its title (+ optional body), and let
 * auto-save persist it to the DB — so a later public render reflects the content.
 */
async function createNote(page: Page, prefix: string, title: string, body?: string): Promise<void> {
  await signUp(page, newCredentials(prefix));
  await page.getByRole("button", { name: "New note" }).click();
  await page.waitForURL(/\/notes\/.+/);
  await expect(page.locator(EDITOR_BODY)).toBeVisible();

  await page.getByLabel("Note title").fill(title);
  if (body) {
    await page.locator(EDITOR_BODY).click();
    await page.keyboard.type(body);
  }
  // Persist via auto-save (no success toast to overlap the share controls, unlike a
  // manual Save) so the public page sees the saved title/content, not the defaults.
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: SAVE_TIMEOUT });
}

/**
 * Flip the share switch and confirm the new state. Then wait for the resulting
 * toast to clear: its div has pointer-events-auto, so a lingering toast could
 * intercept a later click (e.g. the second toggle, or Copy link).
 */
async function setShared(page: Page, makePublic: boolean): Promise<void> {
  const toggle = page.getByRole("switch", { name: "Make note public" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(makePublic));

  const message = makePublic ? "Note is now public" : "Note is now private";
  await expect(page.getByText(message)).toBeHidden({ timeout: TOAST_CLEAR_TIMEOUT });
}

test.describe("note sharing", () => {
  test("toggles a note public and reveals its share link", async ({ page }) => {
    await createNote(page, "share-toggle", "Toggle me public");

    const toggle = page.getByRole("switch", { name: "Make note public" });
    // Starts private: switch off + the "only you" message + no link.
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Only you can see this note.")).toBeVisible();
    await expect(page.getByLabel("Public share link")).toHaveCount(0);

    await setShared(page, true);

    // Now public: the message flips and the unguessable share link appears, built
    // from the slug at the test origin (NEXT_PUBLIC_APP_URL → :3100), never the id.
    await expect(page.getByText("Anyone with the link can view this note.")).toBeVisible();
    const link = page.getByLabel("Public share link");
    await expect(link).toBeVisible();
    await expect(link).toHaveValue(/^http:\/\/localhost:3100\/p\/.+/);

    // The header badge reflects the public state on the next server render.
    await page.reload();
    await expect(page.getByRole("switch", { name: "Make note public" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("an anonymous visitor can read a shared note", async ({ page, browser }) => {
    const title = "Publicly shared note";
    const body = "This paragraph is visible to anyone with the link.";
    await createNote(page, "share-anon", title, body);
    await setShared(page, true);

    const shareUrl = await page.getByLabel("Public share link").inputValue();
    expect(shareUrl).toMatch(/^http:\/\/localhost:3100\/p\/.+/);

    // Open the link in a fresh, cookie-less context — proves the public route needs
    // NO session (SPEC §10.3): the author's cookie never reaches this page.
    const anonContext = await browser.newContext();
    try {
      const anonPage = await anonContext.newPage();
      const response = await anonPage.goto(shareUrl);
      expect(response?.status()).toBe(200);

      await expect(anonPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(anonPage.getByText(body)).toBeVisible();
      // No editing surface on the public read-only view.
      await expect(anonPage.locator(EDITOR_BODY)).toHaveCount(0);
    } finally {
      await anonContext.close();
    }
  });

  test("returns 404 for an unknown share slug", async ({ page }) => {
    // A slug that was never minted: the public lookup finds nothing → notFound().
    const response = await page.goto("/p/this-slug-was-never-minted");
    expect(response?.status()).toBe(404);
  });

  test("a note unshared after sharing 404s on its old link", async ({ page, browser }) => {
    await createNote(page, "share-revoke", "Soon to be private");
    await setShared(page, true);

    // Capture the live link, then revoke sharing.
    const shareUrl = await page.getByLabel("Public share link").inputValue();
    await setShared(page, false);

    // Back to private: the link input is gone and the "only you" message returns.
    await expect(page.getByLabel("Public share link")).toHaveCount(0);
    await expect(page.getByText("Only you can see this note.")).toBeVisible();

    // The old link now 404s — the slug is retained in the DB (SPEC §10.2) but the
    // public lookup gates SOLELY on is_public=1, so an unshared note is unreachable.
    const anonContext = await browser.newContext();
    try {
      const anonPage = await anonContext.newPage();
      const response = await anonPage.goto(shareUrl);
      expect(response?.status()).toBe(404);
    } finally {
      await anonContext.close();
    }
  });

  test("copies the share link to the clipboard", async ({ page, context }) => {
    // Grant clipboard access so navigator.clipboard.writeText resolves (localhost is
    // a secure context, so the API is available once permitted).
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await createNote(page, "share-copy", "Copy my link");
    await setShared(page, true);

    const shareUrl = await page.getByLabel("Public share link").inputValue();

    const copyButton = page.getByRole("button", { name: "Copy link" });
    await copyButton.click();

    // The button confirms with transient "Copied!" feedback...
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
    // ...and the clipboard actually holds the share URL.
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(shareUrl);
  });
});
