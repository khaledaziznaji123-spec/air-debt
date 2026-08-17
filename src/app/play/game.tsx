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

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createInitialState,
  step,
  totalGems,
  type SimState,
  type InputRecord,
  type Carried,
} from "@/sim";
import { KeyboardInput } from "@/render/keyboard";
import { readBindings } from "../keybinds";
import { readPrefs } from "../prefs";
import { Renderer } from "@/render/renderer";
import { GameAudio } from "@/render/audio";
import { ui } from "../ui-audio";
import { TICK_HZ, tuning } from "@/config/tuning";
import { shortcuts } from "@/config/dungeon";
import Shop from "./shop";
import { SHOP, levelOf, pay, priceOf, type Loadout } from "@/config/shop";
import {
  readProgress,
  readProgressOnServer,
  subscribeProgress,
  writeProgress,
} from "../progress";
import {
  buy,
  closeRun,
  openRun,
  pull,
  wear,
  type OpenRun,
} from "../sync";
import {
  ADMIN_PURSE,
  isAdmin,
  isAdminOnServer,
  subscribeAdmin,
} from "../admin";

const MS_PER_TICK = 1000 / TICK_HZ;

/** Never simulate more than this in one frame — a backgrounded tab must not
 *  come back and run thousands of ticks at once. */
const MAX_CATCHUP_TICKS = 8;

/**
 * How long the run holds on the body before the shell takes over.
 *
 * Long enough for the collapse to finish. A death that cuts straight to a menu
 * never happened to anybody, and the revive offer has to arrive after the thing
 * it is offering to undo.
 */
const DEATH_HOLD_TICKS = 78;

/**
 * What a second chance costs. Gold only — it is the currency that buys time.
 *
 * Two, not ten. Gold stopped trickling out of every chest when the loot table
 * became four fixed outcomes: it now comes from legendaries (5%) and the boss,
 * and a full clear averages about six. At ten, reviving was something you could
 * afford roughly once a session, which is not a second chance, it is a lottery.
 */
const REVIVE_COST = 2;

export default function Game({
  openShop = false,
  tutorial = false,
  ranked = false,
}: {
  openShop?: boolean;
  /**
   * A ranked run: maxed weapons and gear, every shortcut open, and the only
   * kind of run that appears on a leaderboard.
   *
   * Arrives as `/play?ranked=1` from the board. The flag only ASKS — what a
   * ranked run is made of is decided server-side and frozen onto the row before
   * a tick is played, because a browser that could name its own loadout would
   * be naming its own score.
   */
  ranked?: boolean;
  /**
   * Run the tutorial hall instead of the dungeon. Arrives as `/play?tutorial=1`
   * from the home screen, resolved server-side for the same reason `openShop`
   * is: an effect would set it after the first paint.
   *
   * Nothing it earns is real. The hall pays four grade-one gems so the shop
   * station has something to open with, and a tutorial you can replay from the
   * menu that banked into your account would be a gem farm with a goblin in it.
   */
  tutorial?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  /**
   * Off by default. It is a development readout — tick counts, velocities, the
   * sprite-manifest check — and it sat over the left third of the dungeon,
   * which is where the player is looking. The toggle stays: it is how the art
   * size mismatch and more than one collision bug were caught.
   */
  /**
   * View preferences, from Settings. Read once when the loop is built.
   *
   * Nothing in here can touch a run — they are what the player SEES, and the
   * simulation is a pure reducer over intents that knows nothing about any of
   * it. That is why they are safe to keep on the machine rather than the
   * account.
   */
  const [prefs] = useState(readPrefs);
  const debug = prefs.debugOverlay;
  /**
   * Developer mode, from Settings. See `src/app/admin.ts`.
   *
   * Read through `useSyncExternalStore` because it lives in `localStorage`,
   * which the server cannot see — an effect would flash the wrong state and a
   * `useState` initialiser would be a hydration mismatch.
   */
  const admin = useSyncExternalStore(subscribeAdmin, isAdmin, isAdminOnServer);
  const adminRef = useRef(admin);
  useEffect(() => {
    adminRef.current = admin;
  }, [admin]);
  const router = useRouter();
  const [runKey, setRunKey] = useState(0);
  /**
   * What the server said this run starts from, or null if it could not be
   * asked — signed out, offline, or the tutorial.
   *
   * A ref rather than state because the loop reads it, and the loop cannot see
   * React state. Null is a playable run that simply will not appear on a board:
   * losing the leaderboard is the right failure for a dropped connection, and
   * refusing to let somebody play is not.
   */
  const runRef = useRef<OpenRun | null>(null);
  /**
   * This run cannot bank, because the server never opened it.
   *
   * Shown BEFORE the run rather than explained after it. A player who walks out
   * with a full bag and is then told it did not count has already spent the run
   * believing it did, and that is a worse experience than not being allowed to
   * start — which is why the lobby says so up front and the banner stays up the
   * whole way down.
   */
  const [practice, setPractice] = useState(false);
  /** A ranked run has ended and the board is where the player is going. */
  const [backToBoard, setBackToBoard] = useState(false);
  /**
   * Back to the board after a ranked run.
   *
   * Delayed by a beat rather than immediate, because the score is submitted as
   * the run ends and the board is read on arrival — navigate on the same frame
   * and the player lands on a page that does not have their run on it yet, which
   * looks exactly like the run not counting.
   */
  useEffect(() => {
    if (!backToBoard) return;
    const t = setTimeout(() => router.push("/leaderboard"), 1400);
    return () => clearTimeout(t);
  }, [backToBoard, router]);
  const [renderError, setRenderError] = useState<string | null>(null);

  /**
   * The shop is not a page — it is an overlay over the lobby, because it spends
   * the same session bank a run banks into. The home screen's Shop corner
   * therefore arrives as `/play?shop=1`, and the route resolves that into this
   * prop server-side.
   */
  const [shopOpen, setShopOpen] = useState(openShop);
  // Opening and closing the shop are the two biggest state changes in the shell,
  // so they get their own noises rather than a plain click.
  useEffect(() => {
    if (shopOpen) ui.open();
  }, [shopOpen]);
  /**
   * The hub. A finished run puts the player back at the mouth and waits here,
   * so starting a run is always a deliberate press rather than something that
   * happens to you when the page loads.
   */
  const [inLobby, setInLobby] = useState(true);
  const [lastRun, setLastRun] = useState<{
    outcome: SimState["outcome"];
    depth: number;
    /** Levers flicked on that run — the part a failed run still keeps. */
    levered: number;
    /** What was in the bag when it ended — banked or forfeited by `banked`. */
    gems: number;
    gold: number;
    legendaries: number;
    banked: boolean;
  } | null>(null);

  /**
   * The account's gems and gold.
   *
   * In memory only, like `levered`. ARCH AD-10 and FR-15.8 put this server-side
   * in a balance the client may never write — the run reports what it carried
   * and the server decides what that was worth, because a client that could
   * name its own balance is a client that has already beaten the economy. This
   * ref is the shape of that call, not a substitute for it.
   */
  /**
   * A run that has ended but is still on screen — the body is lying there and
   * the shell has not banked or forfeited anything yet, because the player may
   * still pay to stand back up.
   */
  const [pendingDeath, setPendingDeath] = useState(false);
  /**
   * Commands from React into the render loop, which owns the simulation state.
   * A ref rather than state because the loop reads it every frame and must not
   * be rebuilt to see a change.
   */
  const commandRef = useRef<"revive" | "surrender" | null>(null);

  /**
   * Air tanks bought. FR-19.2 — each one is thirty more seconds, up to ten.
   *
   * Held here rather than in the sim because it is an ACCOUNT fact, not a run
   * fact: the reducer is handed a starting-air figure and has never needed to
   * know where it came from. Session-only, like the bank, until there is a
   * server to own it (FR-15.8, ARCH AD-10).
   */
  /**
   * Everything the account owns, and what it has banked.
   *
   * Persisted, because it used to live in a React ref and every refresh — the
   * dev server does one on each file change — silently reset it. The failure
   * looked exactly like the shop being broken: buy a sword, page reloads, start
   * a run, nothing happened. See `src/app/progress.ts` for why this is
   * temporary and what replaces it.
   */
  const progress = useSyncExternalStore(
    subscribeProgress,
    readProgress,
    readProgressOnServer,
  );

  const loadout: Loadout = {
    levels: progress.levels,
    skin: progress.skin,
    pet: progress.pet,
  };
  const loadoutRef = useRef(loadout);
  useEffect(() => {
    loadoutRef.current = {
      levels: progress.levels,
      skin: progress.skin,
      pet: progress.pet,
    };
  }, [progress]);

  const tanks = levelOf(loadout, "gear.tank");
  const tanksRef = useRef(tanks);
  useEffect(() => {
    tanksRef.current = tanks;
  }, [tanks]);

  const bank: Carried = {
    gems: progress.gems.length
      ? progress.gems
      : new Array(tuning.loot.grades).fill(0),
    gold: progress.gold,
    legendaries: progress.legendaries,
  };
  /**
   * Bank what a run came out with.
   *
   * Written locally first so the number on screen changes the instant the
   * player walks out, then sent to the server as a DELTA — what this run added,
   * not what the total should now be. The server owns the total; a client that
   * announced its own total would be a client that could announce any total.
   *
   * The reply overwrites the local copy, so if the server trims the claim the
   * player sees the trimmed number rather than a total that quietly disagrees
   * with their account.
   */
  const setBank = (next: Carried) => {
    const before = readProgress();
    const held = before.gems.length
      ? before.gems
      : new Array(tuning.loot.grades).fill(0);

    writeProgress({
      ...before,
      gems: [...next.gems],
      gold: next.gold,
      legendaries: next.legendaries,
    });

    // ...and that is all it does now.
    //
    // It used to work out what this run had added and post that to the server
    // as a claim, which the server clamped and credited. The claim is gone:
    // loot arrives from `closeRun`, out of a replay of the run, because a
    // request that adds to a balance by asking is a request anyone can send
    // without playing. What is written here is optimistic display so the tally
    // does not sit blank waiting on a round trip — the server's answer
    // overwrites it a moment later.
    void held;
  };
  // Mirrored for the render loop, which owns the run and cannot re-read React
  // state. Keyed on `progress`, the thing that actually changes — `bank` is
  // derived fresh every render, so depending on it would refire every frame.
  const bankRef = useRef(bank);
  useEffect(() => {
    const p = readProgress();
    bankRef.current = {
      gems: p.gems.length ? p.gems : new Array(tuning.loot.grades).fill(0),
      gold: p.gold,
      legendaries: p.legendaries,
    };
  }, [progress]);

  /** What the server last said, when it disagreed with the optimistic view. */
  const [syncNote, setSyncNote] = useState<string | null>(null);

  // Pull the account's save over the local one when the game opens. The server
  // is the truth; the local copy is a cache of it that the run reads per frame.
  useEffect(() => {
    void pull();
  }, []);

  const inLobbyRef = useRef(inLobby);
  useEffect(() => {
    inLobbyRef.current = inLobby;
  }, [inLobby]);

  /**
   * Which shortcuts this player has levered (PRD FR-3.3).
   *
   * Permanent progress, so it outlives the run — and deliberately outlives a
   * FAILED run too. Death and transformation cost the run's loot; a lever is
   * not loot, it is ground that was walked, and FR-3.3 makes flicking it
   * permanent without qualification.
   *
   * In memory only for now. This is exactly the record ARCH AD-10 and FR-3.3
   * put server-side in an append-only table, so it reads from a ref today and
   * from the account when the persistence story lands — nothing else changes.
   */
  /**
   * Which shortcuts this player has levered (PRD FR-3.3).
   *
   * Permanent progress, so it outlives the run — and deliberately outlives a
   * FAILED run too. Death and transformation cost the run's loot; a lever is
   * not loot, it is ground that was walked.
   */
  const levered = progress.levered;
  const setLevered = (next: readonly string[]) =>
    writeProgress({ ...readProgress(), levered: [...next] });
  const leveredRef = useRef(levered);
  useEffect(() => {
    leveredRef.current = progress.levered;
  }, [progress]);

  // Mirrored into a ref so the render loop can read the latest value without
  // being torn down and rebuilt every time the toggle flips.
  const debugRef = useRef(debug);
  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    /**
     * The renderer gets a canvas of its own, created here and thrown away with
     * it. Pixi's `destroy` removes the canvas from the DOM, so handing it one
     * React owns leaves the ref pointing at a detached element that React never
     * rebuilds — and every renderer after the first draws somewhere invisible.
     * That bit twice: once on StrictMode's double mount, once per run start.
     */
    const canvas = document.createElement("canvas");
    canvas.className = "block h-full w-full";
    host.appendChild(canvas);

    let disposed = false;
    let raf = 0;
    let renderer: Renderer | null = null;

    // Whatever this machine has bound. Read once per run rather than watched:
    // rebinding mid-run would change what a held key means halfway through, and
    // the input log records intents rather than keys anyway.
    const input = new KeyboardInput(readBindings());

    /**
     * Sound. Suspended until a gesture resumes it, because every browser blocks
     * audio that starts on its own — and pressing Play is that gesture.
     */
    const audio = new GameAudio();
    audio.setVolume(prefs.volume);
    audio.setMuted(prefs.muted);
    audio.resume();
    // Live, rather than read once. A volume slider you have to restart a run to
    // hear is a volume slider nobody believes is working.
    const onPrefs = () => {
      const now = readPrefs();
      audio.setVolume(now.volume);
      audio.setMuted(now.muted);
    };
    window.addEventListener("airdebt-prefs", onPrefs);
    // The camera is the renderer's, and sound needs it to know what is nearby.
    const cameraOf = (r: Renderer | null) => (r ? r.cameraLeft() : 0);
    // The replay log every run accumulates (PRD FR-15.5). Not yet submitted —
    // the run lifecycle endpoints come with the persistence story.
    const log: InputRecord[] = [];

    // The tank the next run starts with. `testingOverride` still wins outright
    // — it exists to look at the environment, and upgrades on top of it would
    // make the figure it prints meaningless.
    const startingAir = () =>
      tuning.air.testingOverride ??
      Math.min(
        tuning.air.base + tanksRef.current * tuning.air.perUpgrade,
        tuning.air.max,
      );

    // The server's numbers win where it gave any. They have to: the replay it
    // verifies against runs from exactly these, so a client that quietly used
    // its own tank would have every honest run rejected.
    const opened = runRef.current;
    let state = createInitialState(opened?.air ?? startingAir(), {
      seed: opened?.seed,
      // The server's list where there is one. A ranked run has every shortcut
      // open and did not earn any of them, so this cannot come from the account.
      openShortcuts: opened?.openShortcuts ?? leveredRef.current,
      // The SERVER's verdict where there is one. Admin is a column now rather
      // than a browser setting, because an invincible run can rank — so the run
      // being played has to match the run that will be replayed, or an honest
      // admin run gets scored as the death it never had. The local toggle still
      // drives a practice run that nothing is riding on.
      god: opened ? opened.admin : adminRef.current,
      // Likewise: ranked hands out equipment the account does not own, and the
      // replay that scores the run is run against exactly this.
      loadout: (opened?.loadout as typeof loadoutRef.current) ?? loadoutRef.current,
      tutorial,
    });
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
      // Damped rather than removed: the flash marks a real event and deleting it
      // outright would take away information. See `setReduceFlashes`.
      renderer.setReduceFlashes(prefs.reduceFlashes);
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
          // In the hub the character stands still: input is ignored until the
          // run is actually started.
          const intents = inLobbyRef.current ? 0 : input.read();
          // Recorded only on CHANGE, which is also the shape the replay expects:
          // a gap in the log means "still holding the same keys". A full entry
          // per tick would be seventy-two thousand of them for a long run.
          if (intents !== state.previousIntents) {
            log.push({ tick: state.tick, intents });
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
        // The same frame, heard. Reads the event stream the renderer just drew
        // from, so a noise and the particle it belongs to cannot disagree about
        // whether the thing happened.
        audio.frame(state, previous, cameraOf(renderer));
        const depth = Math.max(
          0,
          Math.round(state.deepestX - tuning.room.entranceX),
        );
        // A finished run stays on screen for the collapse. Only then does the
        // shell decide what happened to the loot — because reviving means none
        // of it was lost after all.
        if (
          state.outcome === "died" &&
          !inLobbyRef.current &&
          commandRef.current === null &&
          state.endedTick !== null &&
          state.tick - state.endedTick > DEATH_HOLD_TICKS
        ) {
          setPendingDeath(true);
        }

        // Staying down is not simply declining. PRD FR-1.3: the thing that
        // happens to you down here is that you become one of them — so the
        // transformation plays, and the run ends as a transformation rather
        // than as a death.
        if (commandRef.current === "surrender") {
          commandRef.current = null;
          setPendingDeath(false);
          state = {
            ...state,
            outcome: "transformed",
            endedTick: state.tick,
          };
          previous = state;
        }

        if (commandRef.current === "revive") {
          commandRef.current = null;
          setPendingDeath(false);
          // Full health, the same air, and the run picks up where it fell over.
          state = {
            ...state,
            outcome: "running",
            endedTick: null,
            player: { ...state.player, hp: tuning.player.maxHp },
          };
          previous = state;
        }

        const held =
          state.endedTick !== null &&
          state.tick - state.endedTick <= DEATH_HOLD_TICKS;
        const finished =
          state.outcome !== "running" &&
          !inLobbyRef.current &&
          !held &&
          state.outcome !== "died";

        if (finished) {
          // Run over: bank the result, then put the player back at the mouth.
          // Levers survive whatever the outcome was — see the note on `levered`.
          const earned = state.leversFlicked;
          if (earned.length > 0) {
            const merged = [...leveredRef.current, ...earned];
            leveredRef.current = merged;
            setLevered(merged);
          }

          // And what was beaten, which survives the same way a lever does and
          // for the same reason: it is not loot, it is something you DID. A
          // player who kills the Revenant and then drowns on the way home has
          // still killed the Revenant.
          const felled = state.enemies.some(
            (e) => e.kind === "enemy.revenant" && e.phase === "dead",
          );
          if (felled) {
            const was = readProgress();
            if (!was.beaten.includes("revenant")) {
              writeProgress({ ...was, beaten: [...was.beaten, "revenant"] });
            }
          }

          // The extraction decision, resolved. FR-4.2: walking out banks the
          // whole bag, untaxed. FR-21.1: death and transformation cost exactly
          // the same thing, and it is this — the loot, and only the loot.
          const banked = state.outcome === "extracted";
          const carried = state.carried;
          // Only a run the server opened may touch the tally, even locally.
          //
          // The local write is optimistic display over a balance the server
          // owns — so on a run that will never be submitted it is not optimism,
          // it is a number that appears, is believed, and is gone on the next
          // reload. The tutorial is the same case for a different reason: its
          // gems exist so the shop station has something to open with, and
          // banking them would make a replayable tutorial a gem farm.
          const willBank = banked && !tutorial && runRef.current !== null;
          if (willBank) {
            const before = bankRef.current;
            const after: Carried = {
              gems: before.gems.map((n, i) => n + (carried.gems[i] ?? 0)),
              gold: before.gold + carried.gold,
              legendaries: before.legendaries + carried.legendaries,
            };
            bankRef.current = after;
            setBank(after);
          }

          setLastRun({
            outcome: state.outcome,
            depth,
            levered: earned.length,
            gems: totalGems(carried),
            gold: carried.gold,
            legendaries: carried.legendaries,
            banked,
          });
          setInLobby(true);
          inLobbyRef.current = true;
          setPendingDeath(false);
          // The last station, and the only one that is not geometry: finishing
          // the hall opens the shop. Everything before this taught a control;
          // this teaches what the controls were FOR, which is the one thing a
          // room full of gates cannot demonstrate on its own.
          if (tutorial && banked) setShopOpen(true);
          // A ranked run came FROM the board and goes back to it. Dropping the
          // player into the lobby instead leaves them looking at a Play button
          // wondering where their time went — the score is the point of the
          // mode, so the score is what they should be looking at.
          if (ranked) setBackToBoard(true);

          // Hand in the log. Fire and forget on purpose: the run is over, the
          // loot is already banked by the code above, and a leaderboard that
          // cannot be reached should not hold up the lobby. Nothing here is
          // told to the player unless it fails in a way they can act on.
          const open = runRef.current;
          runRef.current = null;
          if (open && !tutorial) {
            // Hand in the log. This is now the ONLY way loot reaches the
            // account, so the reply is worth reading: it carries the credited
            // balances back and `closeRun` writes them over the local copy.
            const submission = [...log];
            void closeRun(open.runId, submission).then((r) => {
              if ("error" in r) setSyncNote(`Run not recorded: ${r.error}`);
            });
          } else if (!tutorial && banked) {
            // A practice run that walked out with something. Nothing was
            // banked, because nothing opened it — and saying so is the whole
            // job here. Silence would read as loot going missing.
            setSyncNote(
              "Practice run — the server was not reachable when it started, so nothing was banked.",
            );
          }
          state = createInitialState(startingAir(), {
            openShortcuts: leveredRef.current,
            god: adminRef.current,
            // Re-read every run, so a potion bought between runs is carried on
            // the next one and a spent one comes back.
            loadout: loadoutRef.current,
            tutorial,
          });
          previous = state;
        }
      };

      raf = requestAnimationFrame(frame);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      input.detach();
      window.removeEventListener("airdebt-prefs", onPrefs);
      audio.destroy();
      renderer?.destroy();
      // A no-op once `destroy` has removed it, but the renderer may never have
      // finished starting — the canvas must not outlive this effect either way.
      canvas.remove();
    };
    // `tutorial` is a prop resolved from the URL on the server and never
    // changes for the life of the page, so listing it cannot cause the loop to
    // be torn down and rebuilt — but leaving it out would be a lie about what
    // the effect reads, and the next person to make it a piece of state would
    // find out the hard way.
  }, [runKey, tutorial, ranked, prefs.reduceFlashes, prefs.volume, prefs.muted]);

  const startRun = async () => {
    setLastRun(null);
    setShopOpen(false);
    // Asked BEFORE the run begins, because the seed decides the layout and the
    // whole point of the server issuing it (FR-15.1) is that the client cannot
    // pick a dungeon it has already mapped. A failure here is not fatal — the
    // run goes ahead on the default seed and scores nothing.
    runRef.current = tutorial ? null : await openRun(ranked);
    // Everything still starts. What changes is whether it can pay: a run the
    // server did not open cannot be replayed, and a run that cannot be replayed
    // cannot be believed. Refusing to let anyone play while the connection is
    // down would be the stricter answer and the worse one.
    setPractice(!tutorial && runRef.current === null);
    setInLobby(false);
    setRunKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0e14] p-6">
      {/* What the server said, when it disagreed with what the screen showed.
          Rare by design — it means a purchase was refused or a run's haul was
          trimmed — and silent failure there would be far worse than a line of
          text. */}
      {syncNote && (
        <p
          role="status"
          className="w-full max-w-[1280px] rounded-lg border border-[#e56b6f]/30 bg-[#e56b6f]/10 px-4 py-2 text-center text-sm text-[#e56b6f]"
        >
          {syncNote}{" "}
          <button
            onClick={() => setSyncNote(null)}
            className="underline hover:text-[#e7ecf2]"
          >
            dismiss
          </button>
        </p>
      )}

      {/* The way out. Without it the only route back to the menu is the browser
          chrome, which is not a thing a game should make anyone reach for. */}
      <div className="flex w-full max-w-[1280px] items-center gap-3">
        <Link
          href="/home"
          className="rounded-full border border-[#2b3644] px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#8a94a6] uppercase transition-colors hover:border-[#4ecdc4]/50 hover:text-[#4ecdc4]"
        >
          ← Home
        </Link>
        {/* Leaving the tutorial, said in the one place nobody can miss it.
            There are doors at both ends of the hall and they work at any point,
            but every station in there is a wall to a player who has not learnt
            its verb — and somebody beaten by the wall jump is exactly the
            player least likely to go looking for a door. The button costs
            nothing and it is the difference between a hard lesson and a trap. */}
        {ranked && (
          <span className="rounded-full border border-lens/40 bg-lens/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-lens uppercase">
            Ranked — full gear, no potions
          </span>
        )}
        {practice && !tutorial && (
          <span className="rounded-full border border-brass/40 bg-brass/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-brass uppercase">
            Practice — nothing banks
          </span>
        )}
        {tutorial && (
          <Link
            href="/play"
            className="rounded-full border border-brass/40 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-brass uppercase transition-colors hover:border-brass hover:bg-brass/10"
          >
            Skip tutorial — play →
          </Link>
        )}
      </div>
      <div className="relative w-full max-w-[1280px] aspect-[16/9]">
        <div
          ref={hostRef}
          className="absolute inset-0 overflow-hidden rounded-lg"
        />
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
        {/* Down, but not yet gone. FR-21.1 costs the run's loot — so the offer
            has to be made before any of that is settled, and taking it means
            none of it was ever lost. */}
        {!renderError && pendingDeath && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55">
            <p className="text-3xl font-bold text-[#e56b6f]">You went down.</p>
            <p className="text-sm text-[#8a94a6]">
              The air is still in the mask. Everything you are carrying is still
              on you.
            </p>
            <div className="flex items-center gap-3">
              <button
                disabled={bank.gold < REVIVE_COST}
                onClick={() => {
                  const after = {
                    ...bankRef.current,
                    gold: bankRef.current.gold - REVIVE_COST,
                  };
                  bankRef.current = after;
                  setBank(after);
                  commandRef.current = "revive";
                }}
                className={
                  bank.gold >= REVIVE_COST
                    ? "rounded-lg bg-[#ffd479] px-8 py-3 text-lg font-bold text-[#0b0e14] shadow-lg transition hover:brightness-110"
                    : "cursor-not-allowed rounded-lg bg-[#2a2f3a] px-8 py-3 text-lg font-bold text-[#6a7581]"
                }
              >
                Get up — {REVIVE_COST} gold
              </button>
              <button
                onClick={() => {
                  commandRef.current = "surrender";
                }}
                className="rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-[#8a94a6] transition hover:bg-white/5"
              >
                Stay down
              </button>
            </div>
            <p className="text-xs text-[#6a7581]">
              {bank.gold >= REVIVE_COST
                ? "Full health, and the clock carries on from where it stopped."
                : `You have ${bank.gold} gold. Getting up costs ${REVIVE_COST}.`}
            </p>
          </div>
        )}

        {!renderError && inLobby && !shopOpen && (
          <>
            {/* `z-10` is load-bearing. The lobby panel below is `inset-0` and
                comes after this in the DOM, so without it the panel paints over
                the button and swallows every click — the button looked fine and
                simply did not work. It stayed hidden through testing because a
                scripted `.click()` fires straight at the element and skips the
                hit-test a real cursor does. */}
            <button
              onClick={() => setShopOpen(true)}
              className="absolute top-4 left-4 z-10 rounded border border-[#4ecdc4]/50 bg-[#0b0e14]/80 px-4 py-2 text-sm font-semibold text-[#4ecdc4] transition hover:bg-[#4ecdc4]/10"
            >
              Shop
            </button>

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              {lastRun && (
                <div className="flex flex-col items-center gap-1">
                  <p
                    className={
                      lastRun.outcome === "extracted"
                        ? "text-2xl font-bold text-[#4ecdc4]"
                        : "text-2xl font-bold text-[#e8edf5]"
                    }
                  >
                    {lastRun.outcome === "extracted"
                      ? "Escaped the dungeon."
                      : lastRun.outcome === "transformed"
                        ? "You breathed the virus."
                        : "You died."}
                  </p>
                  <p className="text-sm text-[#8a94a6]">
                    {lastRun.outcome === "extracted"
                      ? "Made it out from " + lastRun.depth + "m in."
                      : lastRun.outcome === "transformed"
                        ? "The air ran out. You are one of them now."
                        : "Killed in the dungeon. The run's loot stays down there."}
                  </p>

                  {/* What the run was actually worth. The same sentence has to
                      work both ways round — banked is the reward, and forfeited
                      is the whole reason banking felt like a decision. */}
                  {lastRun.gems + lastRun.gold > 0 && (
                    <p
                      className={
                        lastRun.banked
                          ? "text-sm font-semibold text-[#7fd8f5]"
                          : "text-sm font-semibold text-[#e56b6f] line-through decoration-2"
                      }
                    >
                      {lastRun.gems} gems
                      {lastRun.gold > 0 && ", " + lastRun.gold + " gold"}
                      {lastRun.legendaries > 0 &&
                        ", " +
                          lastRun.legendaries +
                          (lastRun.legendaries === 1
                            ? " legendary"
                            : " legendaries")}
                      {lastRun.banked ? " banked." : " lost down there."}
                    </p>
                  )}
                  {lastRun.banked && lastRun.legendaries > 0 && (
                    <p className="text-xs font-semibold tracking-widest text-[#ffd479] uppercase">
                      A legendary came out with you.
                    </p>
                  )}
                  {/* The consolation that makes a failed run worth having made:
                      loot is lost, ground is not. */}
                  {lastRun.levered > 0 && (
                    <p className="text-sm font-semibold text-[#f4a259]">
                      {lastRun.levered === 1
                        ? "One lever flicked. That shortcut is open for good."
                        : lastRun.levered +
                          " levers flicked. Those shortcuts are open for good."}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={startRun}
                className="rounded-lg bg-[#4ecdc4] px-10 py-4 text-lg font-bold text-[#0b0e14] shadow-lg transition hover:brightness-110"
              >
                Start the run
              </button>

              {/* Permanent progress, readable as a fraction of a known whole —
                  PRD FR-2: "I have levered four of eight". */}
              <p className="font-mono text-xs tracking-widest text-[#8a94a6] uppercase">
                {levered.length} / {shortcuts.length} shortcuts open
              </p>

              {/* The balance. Everything that has ever been walked out with. */}
              <p className="font-mono text-xs tracking-widest text-[#7fd8f5] uppercase">
                {totalGems(bank)} gems · {bank.gold} gold
                {bank.legendaries > 0 && (
                  <span className="text-[#ffd479]">
                    {" "}
                    · {bank.legendaries} legendary
                  </span>
                )}
              </p>

              <p className="text-xs text-[#8a94a6]">
                The air only burns once you are inside.
              </p>
            </div>
          </>
        )}

        {!renderError && shopOpen && (
          <Shop
            onClose={() => setShopOpen(false)}
            purse={
              admin
                ? {
                    gems: bank.gems.map(() => ADMIN_PURSE),
                    gold: ADMIN_PURSE,
                  }
                : bank
            }
            levels={progress.levels}
            beaten={progress.beaten}
            skin={progress.skin}
            pet={progress.pet}
            onWear={(id) => {
              const item = SHOP.find((i) => i.id === id);
              const now = readProgress();
              // Two slots, and a thing knows which one it goes in. Armour and a
              // pet are worn at the same time, so wearing one must not take the
              // other off.
              if (item?.pet) writeProgress({ ...now, pet: id });
              else writeProgress({ ...now, skin: id });
              void wear(item?.pet ? { pet: id } : { skin: id });
            }}
            onBuy={(id) => {
              const item = SHOP.find((i) => i.id === id);
              if (!item || !item.live) return;

              // Re-read rather than trust the button. The button is a view of a
              // state that could have changed under it, and the purse is the
              // thing that must not go negative.
              const now = readProgress();
              const level = now.levels[id] ?? 0;

              // Earned, not bought. It costs nothing and it cannot be taken
              // until the thing it came off is down — checked HERE and not only
              // in the shop's rendering, because a disabled button is a view
              // and this is the state.
              if (item.earned !== undefined) {
                if (!now.beaten.includes(item.earned) || level > 0) return;
                writeProgress({
                  ...now,
                  levels: { ...now.levels, [id]: 1 },
                  skin: item.skin ? item.id : now.skin,
                  pet: item.pet ? item.id : now.pet,
                });
                return;
              }

              const cost = priceOf(item, level);
              if (!cost) return;

              // In developer mode everything is free: the purse the shop was
              // shown is not the real one, so charging the real one would empty
              // a balance the player never saw.
              let gems = now.gems;
              let gold = now.gold;
              if (!adminRef.current) {
                const left = pay(cost, {
                  gems: now.gems.length
                    ? now.gems
                    : new Array(tuning.loot.grades).fill(0),
                  gold: now.gold,
                });
                if (!left) return;
                gems = [...left.gems];
                gold = left.gold;
              }

              writeProgress({
                ...now,
                gems,
                gold,
                levels: { ...now.levels, [id]: level + 1 },
                // Worn the moment it is bought. Buying a look and then having
                // to go and put it on is a step nobody wants.
                skin: item.skin ? item.id : now.skin,
                pet: item.pet ? item.id : now.pet,
              });

              // And ask the server to make it real. It holds the price list, so
              // the request carries the item id and nothing else — there is no
              // number in it worth tampering with. If it refuses, its answer
              // replaces the optimistic one above.
              //
              // ALWAYS, including in developer mode. This used to be skipped for
              // an admin, which meant the purchase existed only in this browser
              // — fine while a run read its gear from here, and broken the day a
              // run started reading it from the server. Buying ten air tanks and
              // still getting thirty seconds was that bug. The server knows who
              // is an admin now and hands it over without charging.
              void buy(id).then((r) => {
                if ("error" in r) {
                  // Refused. The optimistic write above is about to be undone,
                  // so the sound is the only warning that arrives on time.
                  ui.no();
                  setSyncNote(r.error);
                } else {
                  ui.ok();
                }
              });
            }}
          />
        )}
      </div>

      {/* NOTHING UNDER THE CANVAS.
          There used to be a key legend, a line of parry coaching and a debug
          checkbox down here. The legend was scaffolding from before there was a
          tutorial, and the tutorial teaches the controls properly now by making
          you use them — so what the row actually did was give the page something
          to scroll to, and put three rows of chrome under the game in every
          screenshot and every demo. The debug overlay is still there for anyone
          who wants it; it is a renderer toggle rather than a thing to hang off
          the page. */}
    </div>
  );
}
