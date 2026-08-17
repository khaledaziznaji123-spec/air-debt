import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests, against a real browser.
 *
 * The 282 unit tests cover the simulation, and they cover it well — but every
 * one of them runs in Node with no page, no bundle and no network. Nothing in
 * that suite could have caught a single one of the failures that actually cost
 * time getting this deployed: an environment variable with `/rest/v1` on the
 * end, a route answering 500 because the server could not reach the database, or
 * a landing page still describing a version of the game from nine days ago.
 *
 * That is what this is for. It asks the questions a person asks: does the page
 * load, does it say the right thing, does the API answer, is the game canvas
 * actually there.
 *
 * `BASE_URL` points it at the live site instead of localhost:
 *
 *   BASE_URL=https://air-debt-game.vercel.app npm run e2e
 *
 * which is the form worth running after a deploy, because "it works on my
 * machine" is exactly the failure mode this exists to catch.
 */
export default defineConfig({
  testDir: "./e2e",
  // Serial rather than parallel. There are few enough of these that the
  // parallelism buys nothing, and a shared dev server is happier for it.
  workers: 1,
  // A local dev server is slower to first paint than a built one, and the game
  // page in particular has to download a sprite sheet before it settles.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    // Kept only for failures. A trace per passing test is a lot of disk for
    // something nobody opens.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Started automatically unless BASE_URL was given, so `npm run e2e` works
  // from a cold checkout with no instructions.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});