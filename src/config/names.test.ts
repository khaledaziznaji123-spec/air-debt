/**
 * The name rule.
 *
 * Worth testing on its own because it is the only user-supplied string in the
 * game that ends up on a page other people read, and because it is enforced in
 * two places at once — the form, for a useful message, and the server, before
 * it publishes. Those two have to be the same rule or a name that passed
 * sign-up quietly becomes "scavenger" on the board.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkName, NAME_MAX } from "./names.ts";

test("ordinary names are fine, in any script", () => {
  for (const name of ["Khalid", "ab", "x_y-z.w", "O'Neill", "Ann Marie", "خالد", "さくら", "Ω9"]) {
    assert.equal(checkName(name), null, `${name} was rejected`);
  }
});

test("it refuses what would break a public board", () => {
  // Too short to mean anything, too long to sit in a row, and the whole class
  // of invisible characters — which is a whitelist rather than a list of the
  // ones somebody thought of.
  assert.ok(checkName("a"));
  assert.ok(checkName("x".repeat(NAME_MAX + 1)));
  assert.ok(checkName(""));
  assert.ok(checkName("   "));
  // Zero-width space, right-to-left override, and a name that is only marks.
  assert.ok(checkName("ab\u200bcd"), "a zero-width space got through");
  assert.ok(checkName("ab\u202ecd"), "a direction override got through");
  assert.ok(checkName("<script>x</script>"));
  assert.ok(checkName("nul\u0000l"));
});

test("it is measured after trimming, both ends", () => {
  // Or " a " is a two-character name that displays as one, and eighteen
  // characters plus trailing spaces is over the limit for no visible reason.
  assert.ok(checkName(" a "));
  assert.equal(checkName(`  ${"x".repeat(NAME_MAX)}  `), null);
  assert.ok(checkName(`  ${"x".repeat(NAME_MAX + 1)}  `));
});
