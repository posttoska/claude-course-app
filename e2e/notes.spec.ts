import { test, expect, type Page } from "@playwright/test";
import { newCredentials, signUp } from "./helpers/auth";

// E2E tests for the notes CRUD flow (prd "Write E2E tests for notes CRUD").
// They drive the real dashboard → editor journey end-to-end: creating a note,
// editing its title + rich-text body, applying formatting through the toolbar,
// auto-save, and deleting with the confirmation dialog. Every step exercises the
// genuine Server Actions (create/update/delete) and the SQLite round trip the way
// a user would. The harness (config, isolated test server + DB, helpers) is
// already proven by smoke.spec.ts / auth.spec.ts.

// The TipTap editable body is a ProseMirror contenteditable — a stable selector
// across TipTap versions (the title is a plain <input>, so this is unambiguous).
const EDITOR_BODY = '[contenteditable="true"]';

// Auto-save / manual save settle into "Saved" in the role="status" indicator.
// Generous timeout: a cold Turbopack route compile on first hit can be slow, and
// the debounce adds ~1.5s on top.
const SAVE_TIMEOUT = 20_000;

/** Sign up a fresh user, create a note from the dashboard, and land in its editor. */
async function createNoteAndOpenEditor(page: Page, prefix: string): Promise<void> {
  await signUp(page, newCredentials(prefix));
  await page.getByRole("button", { name: "New note" }).click();
  await page.waitForURL(/\/notes\/.+/);
  // useEditor mounts client-side (immediatelyRender:false), so wait for it.
  await expect(page.locator(EDITOR_BODY)).toBeVisible();
}

test.describe("notes CRUD", () => {
  test("creates a new note from the dashboard and opens its editor", async ({ page }) => {
    await signUp(page, newCredentials("notes-create"));
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "New note" }).click();

    // The create action mints the note and navigates into /notes/[id].
    await page.waitForURL(/\/notes\/.+/);

    // The editor surface is present: title input, toolbar, and editable body.
    await expect(page.getByLabel("Note title")).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
    await expect(page.locator(EDITOR_BODY)).toBeVisible();
  });

  test("edits a note's title and content and persists them across a reload", async ({ page }) => {
    await createNoteAndOpenEditor(page, "notes-edit");
    const body = page.locator(EDITOR_BODY);

    await page.getByLabel("Note title").fill("My first note");
    await body.click();
    await page.keyboard.type("Hello from the editor.");

    // Explicit Save (exact name so it never matches the "Saving…" pending label).
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved", { timeout: SAVE_TIMEOUT });

    // Reload from the DB — the title + content survived the write.
    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue("My first note");
    await expect(page.locator(EDITOR_BODY)).toContainText("Hello from the editor.");
  });

  test("applies bold, italic, and heading formatting from the toolbar", async ({ page }) => {
    await createNoteAndOpenEditor(page, "notes-format");
    const body = page.locator(EDITOR_BODY);

    await body.click();
    await page.keyboard.type("Format me");
    await page.keyboard.press("Control+a"); // select the whole line

    // Bold → button reflects active state and the text is wrapped in <strong>.
    const bold = page.getByRole("button", { name: "Bold" });
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(body.locator("strong")).toHaveText("Format me");

    // Italic on the same selection → wrapped in <em> too.
    const italic = page.getByRole("button", { name: "Italic" });
    await italic.click();
    await expect(italic).toHaveAttribute("aria-pressed", "true");
    await expect(body.locator("em")).toHaveText("Format me");

    // Heading 1 turns the current block into an <h1> (block-level command).
    // Place a collapsed cursor in the block first so the heading toggle targets it.
    await body.click();
    const heading1 = page.getByRole("button", { name: "Heading 1" });
    await heading1.click();
    await expect(body.locator("h1")).toContainText("Format me");
    await expect(heading1).toHaveAttribute("aria-pressed", "true");
  });

  test("auto-saves edits without clicking Save", async ({ page }) => {
    await createNoteAndOpenEditor(page, "notes-autosave");

    // Edit the title but DON'T click Save — the debounced auto-save must fire.
    await page.getByLabel("Note title").fill("Autosaved title");
    await expect(page.getByRole("status")).toHaveText("Saved", { timeout: SAVE_TIMEOUT });

    // Reload — the change persisted via auto-save alone.
    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue("Autosaved title");
  });

  test("deletes a note after confirming and removes it from the dashboard", async ({ page }) => {
    await createNoteAndOpenEditor(page, "notes-delete");

    // Give it a recognisable title and let auto-save persist it (no success toast
    // to overlap the controls — unlike a manual Save).
    await page.getByLabel("Note title").fill("Note to delete");
    await expect(page.getByRole("status")).toHaveText("Saved", { timeout: SAVE_TIMEOUT });

    // The footer Delete button opens the confirmation dialog (the dialog is hidden
    // until then, so this name is unambiguous).
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Delete note?" })).toBeVisible();

    // Confirm — the delete action runs and redirects back to the dashboard.
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL("**/dashboard");

    // The note is gone and the empty state returns (it was the user's only note).
    await expect(page.getByRole("link", { name: "Note to delete" })).toHaveCount(0);
    await expect(page.getByText("No notes yet")).toBeVisible();
  });
});
