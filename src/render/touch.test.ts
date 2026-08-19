import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTROLS,
  DEFAULT_LAYOUT,
  DEFAULT_SLOTS,
  LIMITS,
  placed,
  type TouchLayout,
} from "./touch.ts";

/**
 * The pad's arithmetic, which is the only part of it a test can reach — the
 * buttons themselves are DOM and there is no DOM here.
 *
 * That is a smaller loss than it sounds. What can actually go wrong with an
 * arranged layout is geometry: a button off the edge of a smaller screen, a
 * right-hand button that stops being a right-hand button, two buttons on top of
 * each other so one of them can never be pressed. All of that is `placed()`, and
 * `placed()` is pure.
 */

/** A phone on its side, which is the only way this game is played on one. */
const PHONE = { width: 844, height: 390 };

test("every control has a default slot, and no default slot is a stray", () => {
  for (const c of CONTROLS) {
    assert.ok(DEFAULT_SLOTS[c.id], `${c.id} has nowhere to go`);
  }
  assert.equal(Object.keys(DEFAULT_SLOTS).length, CONTROLS.length);
});

test("no two buttons overlap on a landscape phone", () => {
  // The bug this exists for: a default pad that looks fine on a laptop and puts
  // two circles on top of each other on the device it is FOR, where the one
  // underneath can never be pressed.
  const boxes = CONTROLS.map((c) => ({
    id: c.id,
    ...placed(DEFAULT_SLOTS[c.id], DEFAULT_LAYOUT, PHONE),
  }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const apart =
        a.left + a.size <= b.left ||
        b.left + b.size <= a.left ||
        a.bottom + a.size <= b.bottom ||
        b.bottom + b.size <= a.bottom;
      assert.ok(apart, `${a.id} and ${b.id} overlap`);
    }
  }
});

test("a right-hand button stays on the right when the screen narrows", () => {
  const wide = placed(DEFAULT_SLOTS.jump, DEFAULT_LAYOUT, {
    width: 1280,
    height: 720,
  });
  const narrow = placed(DEFAULT_SLOTS.jump, DEFAULT_LAYOUT, PHONE);
  // Same distance from the right edge on both, which is the entire reason a
  // slot remembers which side it was measured from.
  assert.equal(1280 - (wide.left + wide.size), 844 - (narrow.left + narrow.size));
});

test("a layout arranged on a big screen still fits on a small one", () => {
  // Saved on a tablet, opened on a phone. Clamping happens here rather than at
  // save time on purpose: rotating a device must not destroy a layout.
  const far: TouchLayout = {
    ...DEFAULT_LAYOUT,
    slots: { ...DEFAULT_SLOTS, jump: { side: "left", x: 1100, y: 600, size: 88 } },
  };
  const p = placed(far.slots.jump, far, PHONE);
  assert.ok(p.left >= 0 && p.left + p.size <= PHONE.width, "off the side");
  assert.ok(p.bottom >= 0 && p.bottom + p.size <= PHONE.height, "off the top");
});

test("the size multiplier reaches every button and stays within its limits", () => {
  const big: TouchLayout = { ...DEFAULT_LAYOUT, scale: LIMITS.scale.max };
  for (const c of CONTROLS) {
    const one = placed(DEFAULT_SLOTS[c.id], DEFAULT_LAYOUT, PHONE);
    const scaled = placed(DEFAULT_SLOTS[c.id], big, PHONE);
    assert.ok(scaled.size > one.size, `${c.id} ignored the size slider`);
    // Still a button and not the whole screen: the pad has to leave the game
    // visible behind it at any setting the slider allows.
    assert.ok(scaled.size < PHONE.height / 2, `${c.id} swallowed the screen`);
  }
});

test("a zero-sized area does not produce a negative position", () => {
  // The first frame, before the stage has been measured. It has to survive that
  // rather than place nine buttons at -68px and vanish.
  const p = placed(DEFAULT_SLOTS.jump, DEFAULT_LAYOUT, { width: 0, height: 0 });
  assert.equal(p.left, 0);
  assert.equal(p.bottom, 0);
});