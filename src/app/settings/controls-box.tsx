"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bindings } from "../../render/keyboard.ts";
import type { IntentFlag } from "../../sim/index.ts";
import {
  ACTIONS,
  bind,
  keyLabel,
  keysFor,
  readBindings,
  resetBindings,
  unbind,
  writeBindings,
} from "../keybinds.ts";

/**
 * The controls, and changing them.
 *
 * Doubles as the reference that used to sit under the game canvas. That row was
 * removed because it gave the play page something to scroll to and put three
 * rows of chrome under the game in every screenshot — but the information was
 * worth keeping, and this is where somebody goes looking for it.
 *
 * Bindings are per-machine rather than per-account (see `keybinds.ts`), so this
 * is entirely client-side and touches nothing the server owns.
 */
export default function ControlsBox() {
  const [bindings, setBindings] = useState<Bindings | null>(null);
  const [listening, setListening] = useState<{
    intent: IntentFlag;
    replacing?: string;
  } | null>(null);

  // Read after mount rather than in an initialiser: `localStorage` does not
  // exist on the server, and a `useState` initialiser that touches it is a
  // hydration mismatch waiting to happen.
  //
  // Queued rather than set straight from the effect body, because a synchronous
  // setState there is a second render of a component that has not painted once
  // — the lint rule that catches it is right, and the queue costs a frame that
  // nobody can see.
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) setBindings(readBindings());
    });
    return () => {
      live = false;
    };
  }, []);

  const capture = useCallback(
    (e: KeyboardEvent) => {
      if (!listening || !bindings) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListening(null);
        return;
      }
      const next = bind(bindings, e.code, listening.intent, listening.replacing);
      setBindings(next);
      writeBindings(next);
      setListening(null);
    },
    [listening, bindings],
  );

  useEffect(() => {
    if (!listening) return;
    // Capture phase, so this sees the key before anything else on the page can
    // act on it — otherwise binding Space scrolls the settings page as well.
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [listening, capture]);

  if (!bindings) {
    return (
      <section className="rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
        <p className="text-sm text-foreground/50">Reading your controls…</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
          Controls
        </h2>
        <button
          onClick={() => {
            resetBindings();
            setBindings(readBindings());
            setListening(null);
          }}
          className="rounded-full border-2 border-rock-edge px-3 py-1 font-mono text-[10px] font-black tracking-[0.16em] text-foreground/60 uppercase hover:border-brass/60 hover:text-brass"
        >
          Reset to default
        </button>
      </div>

      <p className="text-xs leading-relaxed text-foreground/50">
        Click a key to change it, then press the one you want.{" "}
        <span className="text-foreground/70">Esc</span> cancels. A key can only
        mean one thing, so binding a key that is already in use takes it from
        whatever had it.
      </p>

      <ul className="flex flex-col divide-y divide-rock-edge/60">
        {ACTIONS.map((action) => {
          const keys = keysFor(bindings, action.intent);
          return (
            <li
              key={action.name}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
            >
              <span className="text-sm">
                <span className="font-semibold text-foreground/90">
                  {action.name}
                </span>
                {action.note && (
                  <span className="ml-2 text-xs text-foreground/40">
                    {action.note}
                  </span>
                )}
              </span>

              <span className="flex flex-wrap items-center gap-1.5">
                {keys.map((code) => (
                  <span key={code} className="flex items-center">
                    <button
                      onClick={() =>
                        setListening({ intent: action.intent, replacing: code })
                      }
                      className={`min-w-11 rounded-lg border-2 border-b-4 px-2.5 py-1 font-mono text-xs font-black transition-transform active:translate-y-0.5 active:border-b-2 ${
                        listening?.replacing === code
                          ? "animate-pulse border-brass bg-brass/20 text-brass"
                          : "border-rock-edge bg-black/20 text-foreground/80 hover:border-brass/50"
                      }`}
                    >
                      {listening?.replacing === code
                        ? "press…"
                        : keyLabel(code)}
                    </button>
                    {/* Only offered while more than one key is bound. Removing
                        the last one leaves an action nobody can perform, and
                        "why can I not jump" is a bad puzzle. */}
                    {keys.length > 1 && (
                      <button
                        onClick={() => {
                          const next = unbind(bindings, code);
                          setBindings(next);
                          writeBindings(next);
                        }}
                        aria-label={`Remove ${keyLabel(code)}`}
                        className="ml-0.5 px-1 text-xs text-foreground/30 hover:text-punch"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}

                <button
                  onClick={() => setListening({ intent: action.intent })}
                  className={`rounded-lg border-2 border-dashed px-2 py-1 font-mono text-xs font-black ${
                    listening?.intent === action.intent && !listening.replacing
                      ? "animate-pulse border-brass text-brass"
                      : "border-rock-edge/70 text-foreground/35 hover:border-brass/50 hover:text-brass/70"
                  }`}
                >
                  {listening?.intent === action.intent && !listening.replacing
                    ? "press…"
                    : "+"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-foreground/40">
        Controls are saved on this computer rather than to your account — a
        keymap belongs to the desk you are sitting at. They cannot affect a
        score: the game is handed actions rather than keys, so a run replays the
        same however it was played.
      </p>
    </section>
  );
}