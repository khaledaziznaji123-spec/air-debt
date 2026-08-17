"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkName, displayName, rename, signOut, useAuth } from "../auth.ts";
import {
  readProgress,
  readProgressOnServer,
  subscribeProgress,
} from "../progress.ts";
import { useState, useSyncExternalStore } from "react";
import SignedIn from "../signed-in.tsx";
import { SHOP, levelOf } from "../../config/shop.ts";
import { tuning } from "../../config/tuning.ts";
import { shortcuts } from "../../config/dungeon.ts";

/**
 * The name, and changing it.
 *
 * Sits where the name already was rather than in a settings page of its own,
 * because "what am I called" and "let me change it" are the same thought — and
 * until now the answer to the second one was that you could not, which mattered
 * the moment the name started appearing on a public board.
 *
 * Reads as text until you click it. A form permanently open under your own name
 * invites you to fiddle with the one field on the page that other people see.
 */
function NameField({ current }: { current: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{current}</h1>
        <button
          onClick={() => {
            setDraft(current);
            setNote(null);
            setEditing(true);
          }}
          className="rounded-full border border-white/15 px-4 py-1 font-mono text-[10px] tracking-widest text-[#9fb0c0] uppercase hover:border-[#5fd9cf]/60 hover:text-[#5fd9cf]"
        >
          Change
        </button>
        {note && <span className="text-xs text-[#5fd9cf]">{note}</span>}
      </div>
    );
  }

  const problem = checkName(draft);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem || busy) return;
        setBusy(true);
        const r = await rename(draft);
        setBusy(false);
        if ("error" in r) {
          setNote(r.error);
          return;
        }
        // The heading re-reads from the session, which Supabase updates in
        // place — so there is nothing to refresh, only a form to put away.
        setNote("Saved.");
        setEditing(false);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="rename" className="sr-only">
          The name the game calls you
        </label>
        <input
          id="rename"
          value={draft}
          autoFocus
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          className="w-56 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-2xl font-bold outline-none focus:border-[#5fd9cf]/60"
        />
        <button
          type="submit"
          disabled={!!problem || busy}
          className="rounded-full border border-[#5fd9cf]/40 px-4 py-1.5 font-mono text-[10px] tracking-widest text-[#5fd9cf] uppercase disabled:opacity-40"
        >
          {busy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-white/15 px-4 py-1.5 font-mono text-[10px] tracking-widest text-[#9fb0c0] uppercase"
        >
          Cancel
        </button>
      </div>
      {/* Only once they have typed something, so the rule is not an error
          message the moment the field opens. */}
      {draft !== current && problem && (
        <p className="text-xs text-[#e56b6f]">{problem}</p>
      )}
      {note && <p className="text-xs text-[#e56b6f]">{note}</p>}
    </form>
  );
}

/**
 * The profile: who you are, and what you have got out of the dark so far.
 *
 * Two halves, and the split is the point. The top is the ACCOUNT — email, the
 * name the game calls you, and the way out — which now lives on a server and
 * follows you. The bottom is the RUN PROGRESS — gems, gold, kit, shortcuts —
 * which does not: it is still in this browser, and the page says so rather than
 * letting someone assume their kit is safe because their login is.
 *
 * Moving that second half onto the account is the next piece of work, and it is
 * deliberately not faked here. FR-15.8 wants balances written server-side, and
 * a profile that displayed local numbers as though they were banked would be
 * the exact lie that requirement exists to prevent.
 */

const GRADE_COLOURS = ["#3fe08a", "#5f9bf0", "#b37aea", "#ffb25c", "#e2f4ff"];

export default function ProfilePage() {
  return (
    <SignedIn>
      <Profile />
    </SignedIn>
  );
}

function Profile() {
  const auth = useAuth();
  // Same three-argument shape the game uses. The server snapshot has to be its
  // own function, or the first paint disagrees with the server render.
  const progress = useSyncExternalStore(
    subscribeProgress,
    readProgress,
    readProgressOnServer,
  );
  const router = useRouter();

  const user = auth.status === "in" ? auth.user : null;
  const gems = tuning.loot.gemNames.map((n, i) => ({
    name: n,
    colour: GRADE_COLOURS[i] ?? "#9fb0c0",
    count: progress.gems[i] ?? 0,
  }));

  const owned = SHOP.filter((item) => levelOf(progress, item.id) > 0);
  const airSeconds = Math.round(
    (tuning.air.base + levelOf(progress, "gear.tank") * tuning.air.perUpgrade) /
      60,
  );

  return (
    <main className="min-h-full bg-[#0b0e14] px-6 py-10 text-[#e7ecf2]">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="rounded-full border border-white/15 px-5 py-2 font-mono text-xs tracking-widest hover:border-[#5fd9cf]/60"
          >
            ← HOME
          </Link>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="rounded-full border border-white/15 px-5 py-2 font-mono text-xs tracking-widest text-[#9fb0c0] hover:border-[#e56b6f]/60 hover:text-[#e56b6f]"
          >
            SIGN OUT
          </button>
        </div>

        {/* -------------------------------------------------- the account */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-mono text-xs tracking-[0.25em] text-[#5fd9cf]">
            ACCOUNT
          </p>
          <NameField current={displayName(user)} />
          <p className="mt-1 text-sm text-[#6b7a89]">{user?.email}</p>
          <p className="mt-4 text-xs text-[#5a6875]">
            Signed in. This part follows you to any browser you sign in from —
            and it is the name that goes on the leaderboards, so pick one you do
            not mind other people reading.
          </p>
        </section>

        {/* ------------------------------------------------- what you have */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-mono text-xs tracking-[0.25em] text-[#5fd9cf]">
            BANKED
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {gems.map((g) => (
              <div
                key={g.name}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2"
                title={g.name}
              >
                <span
                  className="h-3 w-3 rotate-45 rounded-sm"
                  style={{ background: g.colour }}
                  aria-hidden
                />
                <span className="font-mono text-sm">{g.count}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-full border border-[#ffd166]/30 px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-[#ffd166]" aria-hidden />
              <span className="font-mono text-sm">{progress.gold}</span>
              <span className="text-xs text-[#6b7a89]">gold</span>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Air" value={`${airSeconds}s`} />
            <Stat
              label="Health"
              value={`${tuning.player.healthBars + levelOf(progress, "gear.plate")} bars`}
            />
            <Stat
              label="Shortcuts"
              value={`${progress.levered.length} / ${shortcuts.length}`}
            />
          </dl>
        </section>

        {/* ------------------------------------------------------- the kit */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-mono text-xs tracking-[0.25em] text-[#5fd9cf]">
            KIT
          </p>
          {owned.length === 0 ? (
            <p className="mt-4 text-sm text-[#6b7a89]">
              Nothing yet. Bring some stone back and spend it in the shop.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {owned.map((item) => {
                const level = levelOf(progress, item.id);
                return (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2 last:border-0"
                  >
                    <span>{item.name}</span>
                    <span className="font-mono text-sm text-[#5fd9cf]">
                      {item.tiers && item.tiers > 1
                        ? `${level}/${item.tiers}`
                        : "owned"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* The honest footnote. */}
        <p className="text-center text-xs leading-relaxed text-[#5a6875]">
          Everything under BANKED and KIT is still stored in this browser, not
          on your account — clearing site data clears it. Moving it onto the
          account is the next job.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-xs tracking-widest text-[#6b7a89]">
        {label.toUpperCase()}
      </dt>
      <dd className="mt-1 text-xl">{value}</dd>
    </div>
  );
}
