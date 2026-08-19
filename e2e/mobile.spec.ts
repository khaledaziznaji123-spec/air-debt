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

  test("the pad can be arranged, and where it is dragged is where it stays", async ({
    page,
  }) => {
    // Sideways first: the arranger puts the buttons where they will really be,
    // and where they will really be depends on the shape of the screen.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/settings");

    await page.getByRole("button", { name: /arrange on screen/i }).click();
    const jump = page.getByRole("button", { name: /^jump/ });
    await expect(jump).toBeVisible();

    const before = await jump.boundingBox();
    if (!before) throw new Error("the jump button has no box to drag");

    // A real press-move-release rather than `dragTo`, because the arranger is
    // built on pointer capture — the thing that lets a thumb keep dragging a
    // button after it has slid off it.
    await page.mouse.move(
      before.x + before.width / 2,
      before.y + before.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(420, 150, { steps: 8 });
    await page.mouse.up();

    const after = await jump.boundingBox();
    expect(after, "the button did not move").not.toEqual(before);

    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(page.getByRole("button", { name: /^jump/ })).toHaveCount(0);

    // Saved as it goes, and saved on the device — a layout that vanished on
    // reload would be worse than not being arrangeable at all.
    await page.reload();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("airdebt.touch.v1"),
    );
    expect(stored, "the arrangement was not kept").toBeTruthy();
    expect(JSON.parse(stored!).slots.jump.side).toBe("left");
  });

  test("resetting the pad puts every button back", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/settings");
    await page.evaluate(() =>
      window.localStorage.setItem(
        "airdebt.touch.v1",
        JSON.stringify({
          scale: 1.5,
          opacity: 0.3,
          slots: { jump: { side: "left", x: 300, y: 200, size: 130 } },
        }),
      ),
    );
    await page.reload();

    // A stored file missing eight of the nine buttons is read as eight
    // defaults rather than eight missing buttons — the pad is driven by the
    // control list, never by what happened to be in storage.
    await page.getByRole("button", { name: /arrange on screen/i }).click();
    await expect(page.getByRole("button", { name: / — drag to move$/ })).toHaveCount(
      9,
    );

    await page.getByRole("button", { name: /^reset$/i }).click();
    await page.getByRole("button", { name: /^done$/i }).click();
    const cleared = await page.evaluate(() =>
      window.localStorage.getItem("airdebt.touch.v1"),
    );
    expect(cleared, "reset left the old layout behind").toBeNull();
  });
});
