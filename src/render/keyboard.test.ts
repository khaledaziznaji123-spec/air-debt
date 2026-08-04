import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyboardInput } from "./keyboard.ts";
import { Intent, createInitialState, step } from "../sim/index.ts";

/** A window stand-in, so input can be tested without a browser. */
function fakeWindow() {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener(type: string, fn: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string, code: string) {
      for (const fn of listeners.get(type) ?? [])
        fn({ code, preventDefault() {} });
    },
  };
}

test("pressing J produces the attack intent", () => {
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);
  w.fire("keydown", "KeyJ");
  assert.equal(input.read() & Intent.Attack, Intent.Attack);
});

test("pressing K produces the block intent", () => {
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);
  w.fire("keydown", "KeyK");
  assert.equal(input.read() & Intent.Block, Intent.Block);
});

test("releasing a key clears its intent", () => {
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);
  w.fire("keydown", "KeyJ");
  w.fire("keyup", "KeyJ");
  assert.equal(input.read() & Intent.Attack, 0);
});

test("holding attack across ticks still triggers exactly one swing", () => {
  // This is the path the game actually takes: read held intents every tick and
  // let the sim do edge detection. A held key must not machine-gun.
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);
  w.fire("keydown", "KeyJ");

  let state = createInitialState(600);
  let swings = 0;
  for (let i = 0; i < 20; i++) {
    const before = state.player.action.kind;
    state = step(state, input.read());
    if (before !== "attack" && state.player.action.kind === "attack") swings++;
  }
  assert.equal(swings, 1, "one press is one swing, however long it is held");
});

test("a fresh press after release swings again", () => {
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);

  let state = createInitialState(600);
  let swings = 0;
  const tick = () => {
    const before = state.player.action.kind;
    state = step(state, input.read());
    if (before !== "attack" && state.player.action.kind === "attack") swings++;
  };

  w.fire("keydown", "KeyJ");
  tick();
  w.fire("keyup", "KeyJ");
  for (let i = 0; i < 30; i++) tick(); // let the lockout expire
  w.fire("keydown", "KeyJ");
  tick();

  assert.equal(swings, 2);
});

test("moving does not prevent attacking", () => {
  const w = fakeWindow();
  const input = new KeyboardInput();
  input.attach(w as unknown as Window);
  w.fire("keydown", "KeyD");
  w.fire("keydown", "KeyJ");

  const state = step(createInitialState(600), input.read());
  assert.equal(
    state.player.action.kind,
    "attack",
    "running and swinging must compose",
  );
  assert.ok(state.player.vx > 0);
});

test("Q attacks, and J still does too", () => {
  for (const code of ["KeyQ", "KeyJ"]) {
    const w = fakeWindow();
    const input = new KeyboardInput();
    input.attach(w as unknown as Window);
    w.fire("keydown", code);
    assert.equal(
      input.read() & Intent.Attack,
      Intent.Attack,
      `${code} should attack`,
    );
  }
});

test("F slides, and Shift still does too", () => {
  for (const code of ["KeyF", "ShiftLeft"]) {
    const w = fakeWindow();
    const input = new KeyboardInput();
    input.attach(w as unknown as Window);
    w.fire("keydown", code);
    assert.equal(
      input.read() & Intent.Slide,
      Intent.Slide,
      `${code} should slide`,
    );
  }
});

test("R parries, and K still does too", () => {
  for (const code of ["KeyR", "KeyK"]) {
    const w = fakeWindow();
    const input = new KeyboardInput();
    input.attach(w as unknown as Window);
    w.fire("keydown", code);
    assert.equal(
      input.read() & Intent.Block,
      Intent.Block,
      `${code} should block`,
    );
  }
});
