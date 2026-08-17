"use client";

import { useState, useSyncExternalStore } from "react";
import {
  ADMIN_OFF,
  isAdmin,
  isAdminOnServer,
  phraseMeans,
  setAdmin,
  subscribeAdmin,
} from "../admin";

/**
 * The developer switch.
 *
 * `useSyncExternalStore` rather than an effect: the flag lives in
 * `localStorage`, which the server cannot see. Reading it in a `useState`
 * initialiser gives a hydration mismatch (server says off, client says on);
 * reading it in an effect gives a flash of the wrong state and a cascading
 * render. This hook exists for exactly this shape of problem — it takes a
 * server snapshot that is always `false` and re-renders once with the truth.
 */
export default function AdminBox() {
  const admin = useSyncExternalStore(subscribeAdmin, isAdmin, isAdminOnServer);
  const [said, setSaid] = useState("");
  const [wrong, setWrong] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const means = phraseMeans(said);
    if (means === null) {
      setWrong(true);
      return;
    }
    setAdmin(means);
    setSaid("");
    setWrong(false);
  }

  return (
    <section
      className={`flex flex-col gap-4 rounded-2xl border-2 border-b-[6px] p-5 ${
        admin ? "border-brass bg-brass/10" : "border-rock-edge bg-rock/70"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xl font-black">Admin</h2>
        <span
          className={`rounded-full border-2 px-3 py-0.5 font-mono text-[11px] font-black tracking-widest uppercase ${
            admin
              ? "border-brass bg-brass text-[#2c1f05]"
              : "border-rock-edge text-foreground/40"
          }`}
        >
          {admin ? "On" : "Off"}
        </span>
      </div>

      {admin ? (
        <p className="text-sm font-semibold text-brass">
          Nothing can end a run. Damage does not kill, the air does not run out,
          and the shop has more money than it has stock. Type{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5">{ADMIN_OFF}</code>{" "}
          to put it back.
        </p>
      ) : (
        <p className="text-sm text-foreground/55">For testing. Say the word.</p>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={said}
          onChange={(e) => {
            setSaid(e.target.value);
            setWrong(false);
          }}
          // Not a password field. It is not protecting anything — see the note
          // in admin.ts — and dots would imply it was.
          placeholder="…"
          aria-label="Admin phrase"
          className="min-w-0 flex-1 rounded-xl border-2 border-rock-edge bg-black/40 px-4 py-2 font-mono text-sm outline-none focus:border-lens"
        />
        <button
          type="submit"
          className="rounded-xl border-2 border-b-4 border-rock-edge px-5 py-2 text-sm font-black transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
        >
          Enter
        </button>
      </form>

      {wrong && <p className="text-xs font-bold text-punch">That is not it.</p>}

      <p className="text-[11px] text-foreground/35">
        This is a switch with a word on it, not a lock — the phrase is in the
        page you are reading. It survives a reload, and only{" "}
        <code>{ADMIN_OFF}</code> turns it off. Runs made with it on are marked
        in the simulation state, so they can never be banked once there is a
        server to bank them to.
      </p>
    </section>
  );
}
