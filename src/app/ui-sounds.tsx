"use client";

import { useEffect } from "react";
import { ui } from "./ui-audio.ts";

/**
 * Sound on every button in the shell, from one place.
 *
 * Two global listeners rather than an `onClick` added to sixty components. That
 * is not laziness — a per-component approach means every new button is silent
 * until somebody remembers, and "the shop makes noises but the profile does not"
 * is exactly the kind of inconsistency that reads as unfinished. A delegated
 * listener covers what exists and what has not been written yet.
 *
 * Mounted once, in the root layout, so it covers every page including ones added
 * later. The game canvas is deliberately excluded: a run has its own sound and a
 * menu blip over a parry would be noise on top of the thing it is meant to be
 * pointing at.
 */
export default function UiSounds() {
  useEffect(() => {
    const isControl = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      // Inside the game itself: leave it alone, the run has its own voice.
      if (target.closest("canvas")) return false;
      const el = target.closest(
        "button, a[href], input[type='checkbox'], input[type='range'], summary, [role='button']",
      );
      return el !== null && !el.hasAttribute("disabled");
    };

    const onClick = (e: MouseEvent) => {
      if (isControl(e.target)) ui.click();
    };
    // `pointerover` rather than `mouseenter`: it bubbles, which is the whole
    // point of doing this from one listener.
    const onOver = (e: PointerEvent) => {
      if (isControl(e.target)) ui.hover();
    };
    // A range slider is dragged rather than clicked, so it needs its own hook or
    // the one control people fiddle with most is the one that stays silent.
    const onInput = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === "range") ui.hover();
    };

    window.addEventListener("click", onClick);
    window.addEventListener("pointerover", onOver);
    window.addEventListener("input", onInput);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("input", onInput);
    };
  }, []);

  return null;
}