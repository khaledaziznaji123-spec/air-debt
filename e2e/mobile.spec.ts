import { test, expect } from "@playwright/test";

// A phone-sized Chromium rather than `devices["iPhone 13"]`, which is a WebKit
// device and WebKit is not installed here. What is being measured is layout at
// a phone's width, and that does not need Safari to be honest.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});

test.describe("on a phone", () => {
  for (const path of ["/", "/leaderboard", "/contact", "/settings"]) {
    test(`${path} fits the screen`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(path);
      // The single worst mobile bug: the page is wider than the phone, so the
      // whole thing scrolls sideways and every line is cut off.
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      expect(
        overflow.doc,
        `${path} is ${overflow.doc}px wide on a ${overflow.win}px screen`,
      ).toBeLessThanOrEqual(overflow.win + 1);
      expect(errors, errors.join(" | ")).toHaveLength(0);
    });
  }

  test("/play renders and asks to be turned when held upright", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("body")).toBeVisible();
    // The nudge is CSS-only, on `(orientation: portrait) and (pointer: coarse)`,
    // so what is asserted is that it is in the document and actually displayed
    // at this size — a rule that silently does not match is the failure mode.
    const nudge = page.locator(".rotate-nudge");
    await expect(nudge).toHaveCount(1);
    await expect(nudge).toBeVisible();
  });

  test("in landscape the nudge goes away and the stage takes the screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/play");
    await expect(page.locator(".rotate-nudge")).toBeHidden();
    // The chrome above the canvas is three hundred and ninety pixels of height
    // that a phone on its side does not have to spare.
    await expect(page.locator(".play-chrome")).toBeHidden();
  });
});
