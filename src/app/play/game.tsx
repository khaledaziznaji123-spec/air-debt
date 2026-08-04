"use client";

/**
 * The shell that drives the loop. ARCH AD-1: the core is pure, so *something*
 * has to own the clock — and it is here, never in `src/sim`.
 *
 * The pattern is a fixed-timestep accumulator: real elapsed time goes into a
 * bucket, and the sim advances in whole ticks while the bucket allows. That is
 * what makes a 0.3-second parry identical on a 144Hz desktop and a throttled
 * phone (PRD FR-9.5).
 */

import { useEffect, useRef, useState } from "react";
import {
  createInitialState,
  step,
  Intent,
  type SimState,
  type InputRecord,
} from "@/sim";
import { KeyboardInput } from "@/render/keyboard";
import { Renderer } from "@/render/renderer";
import { TICK_HZ, tuning } from "@/config/tuning";

const MS_PER_TICK = 1000 / TICK_HZ;

/**
 * The on-screen control bar. Temporary scaffolding while there is no tutorial —
 * but it also makes input visible, which is worth keeping around: a key that
 * lights up proves the game registered the press.
 */
const CONTROLS = [
  { key: "A", label: "Left", flag: Intent.Left },
  { key: "D", label: "Right", flag: Intent.Right },
  { key: "W", label: "Jump", flag: Intent.Jump },
  { key: "S", label: "Crouch", flag: Intent.Crouch },
  { key: "Shift", label: "Slide", flag: Intent.Slide },
  { key: "Q", label: "Attack", flag: Intent.Attack },
  { key: "K", label: "Block / Parry", flag: Intent.Block, emphasis: true },
  { key: "L", label: "Stun", flag: Intent.Stun },
] as const;
/** Never simulate more than this in one frame — a backgrounded tab must not
 *  come back and run thousands of ticks at once. */
const MAX_CATCHUP_TICKS = 8;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outcome, setOutcome] = useState<SimState["outcome"]>("running");
  const [debug, setDebug] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [heldIntents, setHeldIntents] = useState(0);
  // Mirrored into a ref so the render loop can read the latest value without
  // being torn down and rebuilt every time the toggle flips.
  const debugRef = useRef(debug);
  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let raf = 0;
    let renderer: Renderer | null = null;

    const input = new KeyboardInput();
    // The replay log every run accumulates (PRD FR-15.5). Not yet submitted —
    // the run lifecycle endpoints come with the persistence story.
    const log: InputRecord[] = [];

    let state = createInitialState(tuning.air.base);
    let previous = state;
    let accumulator = 0;
    let lastFrameMs = 0;

    (async () => {
      try {
        renderer = await Renderer.create(canvas);
      } catch (err) {
        // A renderer that cannot start must say so rather than leaving a blank
        // page — the failure is almost always missing WebGL, not a bug here.
        setRenderError(err instanceof Error ? err.message : String(err));
        return;
      }
      if (disposed) {
        renderer.destroy();
        return;
      }
      renderer.setDebug(debugRef.current);
      input.attach();

      const frame = (nowMs: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);

        if (lastFrameMs === 0) lastFrameMs = nowMs;
        accumulator += nowMs - lastFrameMs;
        lastFrameMs = nowMs;

        let ticksThisFrame = 0;
        while (
          accumulator >= MS_PER_TICK &&
          ticksThisFrame < MAX_CATCHUP_TICKS
        ) {
          const intents = input.read();
          if (intents !== state.previousIntents) {
            log.push({ tick: state.tick, intents });
            // Only on change — this would otherwise be 60 renders a second.
            setHeldIntents(intents);
          }
          previous = state;
          state = step(state, intents);
          accumulator -= MS_PER_TICK;
          ticksThisFrame++;
        }
        // Drop any backlog we refused to simulate rather than owing it forever.
        if (accumulator > MS_PER_TICK * MAX_CATCHUP_TICKS) accumulator = 0;

        renderer?.setDebug(debugRef.current);
        renderer?.draw(state, previous, Math.min(accumulator / MS_PER_TICK, 1));
        setOutcome(state.outcome);
      };

      raf = requestAnimationFrame(frame);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      input.detach();
      renderer?.destroy();
    };
  }, [runKey]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0e14] p-6">
      <div className="relative w-full max-w-[1280px] aspect-[16/9]">
        <canvas ref={canvasRef} className="h-full w-full rounded-lg" />
        {renderError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-[#e56b6f]/40 bg-black/80 p-8 text-center">
            <p className="text-lg font-bold text-[#e56b6f]">
              The renderer could not start
            </p>
            <p className="max-w-md text-sm text-[#8a94a6]">
              This usually means WebGL is unavailable in this browser. The
              simulation is still running underneath.
            </p>
            <code className="mt-2 max-w-md text-xs break-words text-[#8a94a6]">
              {renderError}
            </code>
          </div>
        )}
        {!renderError && outcome !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/70">
            <p className="text-3xl font-bold text-[#e8edf5]">
              {outcome === "transformed"
                ? "You breathed the virus."
                : "You died."}
            </p>
            <p className="text-sm text-[#8a94a6]">
              {outcome === "transformed"
                ? "The air ran out. You are one of them now."
                : "Killed in the dungeon."}
            </p>
            <button
              onClick={() => setRunKey((k) => k + 1)}
              className="rounded bg-[#4ecdc4] px-5 py-2 font-semibold text-[#0b0e14] transition hover:brightness-110"
            >
              Run again
            </button>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-[1280px] flex-wrap items-center justify-center gap-2">
        {CONTROLS.map(({ key, label, flag, ...rest }) => {
          const active = (heldIntents & flag) !== 0;
          const emphasis = "emphasis" in rest && rest.emphasis;
          return (
            <div
              key={key}
              className={[
                "flex min-w-[92px] flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors duration-75",
                active
                  ? "border-[#4ecdc4] bg-[#4ecdc4] text-[#0b0e14]"
                  : emphasis
                    ? "border-[#4ecdc4]/60 bg-[#4ecdc4]/10 text-[#e8edf5]"
                    : "border-white/10 bg-white/5 text-[#8a94a6]",
              ].join(" ")}
            >
              <kbd className="font-mono text-sm font-bold">{key}</kbd>
              <span className="text-[10px] tracking-wide uppercase">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex w-full max-w-[1280px] items-center justify-between text-xs text-[#8a94a6]">
        <p>
          Press <span className="font-bold text-[#4ecdc4]">K</span> the moment a
          goblin&apos;s swing lands — not when its wind-up bar starts.
        </p>
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          debug overlay
        </label>
      </div>
    </div>
  );
}
