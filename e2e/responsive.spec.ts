import { test, expect, type Locator, type Page } from "@playwright/test";
import { newCredentials, signUp } from "./helpers/auth";

// E2E tests for responsive layout + dark mode (prd "Write E2E tests for responsive
// and dark mode"). They drive the REAL pages at different viewports and colour
// schemes: the landing layout reflowing from a single mobile column to a tablet
// row, dark-mode theme tokens applying via prefers-color-scheme, touch-target
// sizing, and a full sign-up → create-note journey on a phone-sized viewport. The
// harness (config, isolated test server + DB, helpers) is already proven by the
// smoke/auth/notes/sharing specs.

// Phone- and tablet-sized viewports (prd asks for 375px mobile + 768px tablet).
const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };

// Apple/Material guidance: interactive targets should be at least ~44px tall.
const TOUCH_TARGET_MIN = 44;

// The TipTap editable body — a stable selector across versions (matches notes.spec).
const EDITOR_BODY = '[contenteditable="true"]';

// Auto-save settles into "Saved" in the role="status" indicator; a cold Turbopack
// route compile on first hit is slow, so the window is generous (matches notes.spec).
const SAVE_TIMEOUT = 20_000;

/** Bounding boxes for every element a locator resolves to, in DOM order. */
async function boxesOf(
  locator: Locator,
): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  const count = await locator.count();
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const box = await locator.nth(i).boundingBox();
    if (!box) throw new Error(`element ${i} has no bounding box (not rendered?)`);
    boxes.push(box);
  }
  return boxes;
}

/** The three feature cards on the landing page, in DOM order. */
function featureCards(page: Page): Locator {
  return page.getByRole("region", { name: "Features" }).locator("article");
}

test.describe("responsive layout", () => {
  test("stacks the hero CTAs and feature cards on a 375px mobile viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");

    // The header nav is present and usable on mobile.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Notes" })).toBeVisible();

    // The two hero CTAs stack vertically (flex-col on mobile, sm:flex-row above it).
    const hero = page.locator("section").first();
    const getStarted = hero.getByRole("link", { name: /Get started/ });
    const heroLogin = hero.getByRole("link", { name: "Log in" });
    const [getStartedBox, heroLoginBox] = await Promise.all([
      getStarted.boundingBox(),
      heroLogin.boundingBox(),
    ]);
    expect(getStartedBox).not.toBeNull();
    expect(heroLoginBox).not.toBeNull();
    // "Log in" sits BELOW "Get started" (stacked, not side by side).
    expect(heroLoginBox!.y).toBeGreaterThanOrEqual(getStartedBox!.y + getStartedBox!.height - 1);

    // The CTA is a comfortable touch target (h-11 ≈ 44px) on mobile.
    expect(getStartedBox!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);

    // The three feature cards stack into a single column: each is below the previous
    // and shares the same left edge (no horizontal columns at this width).
    const [first, second, third] = await boxesOf(featureCards(page));
    expect(second.y).toBeGreaterThan(first.y + first.height - 1);
    expect(third.y).toBeGreaterThan(second.y + second.height - 1);
    expect(Math.abs(second.x - first.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(third.x - first.x)).toBeLessThanOrEqual(1);
  });

  test("lays the feature cards out in a row on a 768px tablet viewport", async ({ page }) => {
    await page.setViewportSize(TABLET);
    await page.goto("/");

    // At the sm breakpoint (≥640px) the grid becomes sm:grid-cols-3: the three cards
    // sit on one row — shared top edge, strictly increasing left edges.
    const [first, second, third] = await boxesOf(featureCards(page));
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(third.y - first.y)).toBeLessThanOrEqual(1);
    expect(first.x).toBeLessThan(second.x);
    expect(second.x).toBeLessThan(third.x);
  });
});

test.describe("dark mode", () => {
  test("applies the dark theme tokens under prefers-color-scheme: dark", async ({ page }) => {
    // Dark scheme → the :root tokens switch and the UA renders native controls dark.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const darkBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    const colorScheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(darkBackground).toBe("rgb(10, 10, 10)"); // --background: #0a0a0a
    expect(colorScheme).toBe("dark");

    // Light scheme → the same page repaints with the light token (no reload needed;
    // the media query re-evaluates live).
    await page.emulateMedia({ colorScheme: "light" });
    const lightBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(lightBackground).toBe("rgb(255, 255, 255)"); // --background: #ffffff
  });

  test("dark: variant utilities respond to the colour scheme", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");

    // The header border uses `border-black/10 dark:border-white/15`, so its colour
    // must differ between the two schemes — proving Tailwind's dark: variants (not
    // just the CSS tokens) react to prefers-color-scheme.
    await page.emulateMedia({ colorScheme: "light" });
    const lightBorder = await header.evaluate((el) => getComputedStyle(el).borderBottomColor);
    await page.emulateMedia({ colorScheme: "dark" });
    const darkBorder = await header.evaluate((el) => getComputedStyle(el).borderBottomColor);

    expect(darkBorder).not.toBe(lightBorder);
  });
});

test.describe("mobile interactions", () => {
  test("a user can sign up, navigate, and create a note on a mobile viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE);

    // The whole auth journey works at 375px: sign up → redirect to the dashboard.
    await signUp(page, newCredentials("responsive-mobile"));
    await expect(page).toHaveURL(/\/dashboard$/);

    // Header nav reflects the signed-in state and the logout control is reachable.
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    // Creating a note from the dashboard works at this width.
    const newNote = page.getByRole("button", { name: "New note" });
    await expect(newNote).toBeVisible();
    await newNote.click();
    await page.waitForURL(/\/notes\/.+/);

    // The editor is usable on mobile: title + body render, and a typed edit auto-saves.
    await expect(page.getByLabel("Note title")).toBeVisible();
    await expect(page.locator(EDITOR_BODY)).toBeVisible();

    await page.getByLabel("Note title").fill("Written on a phone");
    await expect(page.getByRole("status")).toHaveText("Saved", { timeout: SAVE_TIMEOUT });

    // The edit survives a reload — the full mobile round trip persisted.
    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue("Written on a phone");
  });
});
