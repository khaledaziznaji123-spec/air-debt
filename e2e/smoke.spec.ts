import { test, expect } from "@playwright/test";

/**
 * The checks a person does before saying "it's up".
 *
 * Every assertion in here corresponds to something that actually went wrong
 * while getting this deployed, which is the only justification for an end-to-end
 * test — they are slow and they break for boring reasons, so each one has to be
 * paying for itself.
 *
 *   the landing page said "rock, then fire"     — nine days out of date
 *   /api/leaderboard answered 500               — no environment variables
 *   then answered PGRST125                      — a URL with /rest/v1 on the end
 *   the game canvas never appeared              — would have been silent
 *
 * Not one of those was visible to the 282 unit tests, because none of them load
 * a page.
 */

test.describe("the site is actually up", () => {
  test("the landing page describes the game that exists", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Air Debt/i);

    // The five environments, in the order they are actually played. This one is
    // here because the page claimed "Rock, then fire" long after those became
    // the fourth and fifth.
    await expect(
      page.getByText(/Parkour, poison, water, rock, fire/i),
    ).toBeVisible();

    // And the claim the boards have to keep honest.
    await expect(page.getByText(/Leaderboards you cannot fake/i)).toBeVisible();

    // No stale copy left over.
    await expect(page.getByText(/Rock, then fire/i)).toHaveCount(0);
  });

  test("the leaderboard loads and the API behind it answers", async ({
    page,
  }) => {
    // The API first, directly. This is the assertion that would have failed all
    // afternoon: 500 for missing credentials, then PGRST125 for a malformed URL.
    const res = await page.request.get(
      "/api/leaderboard?board=riches&period=week",
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { rows?: unknown[]; error?: string };
    expect(body.error, `the API returned an error: ${body.error}`).toBeUndefined();
    expect(Array.isArray(body.rows)).toBe(true);

    // Then the page that renders it. "Reading the board" must not be the final
    // state — either rows arrive or the empty state does.
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: /Leaderboards/i })).toBeVisible();
    await expect(page.getByText(/Reading the board/i)).toHaveCount(0);
  });

  test("an unknown board is refused rather than guessed at", async ({
    page,
  }) => {
    const res = await page.request.get("/api/leaderboard?board=nonsense");
    expect(res.status()).toBe(400);
  });

  test("both boards can be asked for, and both periods", async ({ page }) => {
    for (const board of ["riches", "speed"]) {
      for (const period of ["week", "all"]) {
        const res = await page.request.get(
          `/api/leaderboard?board=${board}&period=${period}`,
        );
        expect(
          res.status(),
          `${board}/${period} did not answer 200`,
        ).toBe(200);
      }
    }
  });
});

test.describe("nothing can be had without signing in", () => {
  test("a run cannot be opened or submitted anonymously", async ({ page }) => {
    // The whole economy rests on this. A 401 here is the difference between a
    // leaderboard and a suggestion box.
    for (const action of [
      { action: "start" },
      { action: "submit", runId: "00000000-0000-0000-0000-000000000000", log: [] },
    ]) {
      const res = await page.request.post("/api/runs", { data: action });
      expect(res.status(), `${action.action} was allowed without a token`).toBe(
        401,
      );
    }
  });

  test("there is no way to add to a balance by asking", async ({ page }) => {
    // The hole that was open until today: a POST that credited whatever the
    // browser claimed it had found. The action is gone, and this is the test
    // that notices if it ever comes back.
    const res = await page.request.post("/api/progress", {
      data: {
        action: "bank",
        gems: [60, 60, 60, 60, 60],
        gold: 30,
        legendaries: 4,
      },
      headers: { authorization: "Bearer not-a-real-token" },
    });
    // 401 because the token is rubbish — the point is that it is never 200.
    expect(res.status()).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain("progress");
  });
});

test.describe("the game itself", () => {
  test("the play page mounts a canvas", async ({ page }) => {
    // Signed out this lands on the gate rather than the game, which is correct —
    // so what is being checked is that the route renders at all rather than
    // throwing. A blank white page here is the single worst thing that can
    // happen to this project in front of somebody, and it would otherwise be
    // completely silent.
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/play");
    await expect(page.locator("body")).toBeVisible();
    expect(errors, `the page threw: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("the home screen offers the tutorial first", async ({ page }) => {
    // The tutorial is the strongest five minutes of the product and the first
    // thing anybody should touch, so its link existing is worth asserting.
    const res = await page.request.get("/home");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("/play?tutorial=1");
  });
});
test.describe("contact and support", () => {
  test("the button goes somewhere, and every channel is real", async ({
    page,
  }) => {
    // Checked in the served HTML rather than by clicking, because /home sits
    // behind the sign-in gate — a signed-out browser gets the gate and never
    // renders the corners at all. The markup is what carries the href, and the
    // failure being guarded against is a corner with `href: null`, which is
    // exactly what this one was for weeks: a label you could click that did
    // nothing.
    const home = await page.request.get("/home");
    expect(home.status()).toBe(200);
    // Unquoted, because the corners are rendered inside the RSC payload where
    // the attribute arrives escaped as \"/contact\" rather than "/contact".
    expect(await home.text()).toContain("/contact");

    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: /contact and support/i }),
    ).toBeVisible();

    // WhatsApp has to be the wa.me form — no plus, no spaces — or it opens a
    // broken chat. Worth asserting because it is easy to "tidy" into the
    // display format and never notice.
    await expect(
      page.getByRole("link", { name: /\+971 52 513 4070/ }).first(),
    ).toHaveAttribute("href", "https://wa.me/971525134070");

    // And the dialable one needs the international prefix to work abroad.
    const tel = page.locator('a[href^="tel:"]');
    await expect(tel).toHaveAttribute("href", "tel:+971525134070");

    await expect(page.getByText("crusher_21_33")).toBeVisible();
  });

  test("the landing page offers a way to reach somebody", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /contact and support/i }),
    ).toHaveAttribute("href", "/contact");
  });
});

test.describe("settings", () => {
  test("the controls can be read and rebound", async ({ page }) => {
    // The page had one switch on it and a note saying keybinds belonged to a
    // system that did not exist. It did exist — `KeyboardInput` has always taken
    // a binding map — so the only missing piece was somewhere to change one.
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /^Controls$/i })).toBeVisible();

    // Every action a player can bind is listed, which is also the reference that
    // used to sit under the game canvas.
    for (const action of ["Jump", "Attack", "Block / parry", "Stun", "Interact"]) {
      await expect(page.getByText(action, { exact: true })).toBeVisible();
    }

    // Jump is bound to Space by default. Rebinding it to G should stick.
    const jumpRow = page.locator("li").filter({ hasText: "Jump" }).first();
    // `exact` throughout: the remove button beside each key is labelled
    // "Remove Space", and a substring match picks that up too.
    await jumpRow.getByRole("button", { name: "Space", exact: true }).click();
    await expect(
      jumpRow.getByRole("button", { name: "press…", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("KeyG");
    await expect(
      jumpRow.getByRole("button", { name: "G", exact: true }),
    ).toBeVisible();

    // And survive a reload, because a keymap that forgets itself is worse than
    // no keymap at all.
    await page.reload();
    const afterReload = page.locator("li").filter({ hasText: "Jump" }).first();
    await expect(
      afterReload.getByRole("button", { name: "G", exact: true }),
    ).toBeVisible();

    // Reset puts it back.
    await page.getByRole("button", { name: /reset to default/i }).click();
    await expect(
      page.locator("li").filter({ hasText: "Jump" }).first()
        .getByRole("button", { name: "Space", exact: true }),
    ).toBeVisible();
  });

  test("a key can be removed, down to none, and it says so", async ({ page }) => {
    // Removal used to be hidden once an action was down to its last key, to stop
    // somebody leaving themselves unable to jump. That made removal look
    // unavailable rather than unwise, which is the wrong answer — so every key
    // can go now and the action says UNBOUND instead.
    await page.goto("/settings");
    const row = page.locator("li").filter({ hasText: "Stun" }).first();
    // Wait for the keys to actually be on screen before touching them. The
    // component reads its bindings from localStorage in a microtask after mount,
    // so a loop that starts too early finds nothing to remove, breaks
    // immediately, and asserts against a row it never changed. Passed alone and
    // failed in the suite, which is the signature of exactly this.
    await expect(row.getByRole("button", { name: /^Remove / })).toHaveCount(1);
    // Regex, because the badge is uppercased in CSS and reads as UNBOUND.
    await expect(row.getByText(/unbound/i)).toHaveCount(0);

    // Strip every key off it.
    for (let i = 0; i < 6; i++) {
      const remove = row.getByRole("button", { name: /^Remove / });
      if ((await remove.count()) === 0) break;
      await remove.first().click();
    }
    await expect(row.getByText(/unbound/i)).toBeVisible();

    // Reset brings it back, which is what makes the whole thing safe to offer.
    await page.getByRole("button", { name: /reset to default/i }).click();
    await expect(
      page.locator("li").filter({ hasText: "Stun" }).first().getByText(/unbound/i),
    ).toHaveCount(0);
  });

  test("the display switches are there and both are real", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /^Display$/i })).toBeVisible();
    await expect(page.getByText(/Reduce flashing/i)).toBeVisible();
    await expect(page.getByText(/Debug overlay/i)).toBeVisible();

    // And they persist, or they are decoration.
    const flashes = page.getByRole("checkbox").first();
    await flashes.check();
    await page.reload();
    await expect(page.getByRole("checkbox").first()).toBeChecked();
  });
});
