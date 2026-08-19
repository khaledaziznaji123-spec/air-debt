"use client";

import { useState } from "react";
import { checkPassword, setPassword, useAuth } from "../auth.ts";

/**
 * Changing the password from inside the account.
 *
 * There was already a way to do this and it went the long way round: sign out,
 * say you have forgotten it, wait for an email, click a link. That is the flow
 * for somebody LOCKED OUT. Somebody signed in who simply wants a different
 * password should not have to pretend to be locked out to get one, and telling
 * them to is how people end up never changing it.
 *
 * The session is the proof. Supabase allows `updateUser` on a live session, so
 * being signed in on this device IS the authorisation — the same fact that lets
 * the reset link work, arrived at by a shorter road.
 *
 * Two fields rather than one: a mistyped password nobody can see locks you out
 * of your own account, and the second box is the only chance to catch it.
 */
export default function SecurityBox() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status !== "in") return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const problem = checkPassword(pw);
    if (problem) return setError(problem);
    if (pw !== again) return setError("Those two do not match.");
    setBusy(true);
    const r = await setPassword(pw);
    setBusy(false);
    if ("error" in r) return setError(r.error);
    setDone(true);
    setPw("");
    setAgain("");
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
      <div>
        <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
          Security
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-foreground/45">
          Signed in as{" "}
          <span className="text-foreground/80">{auth.user.email}</span>. Changing
          your password here signs nothing else out — if you think somebody else
          is in your account, change it and then say so on the support page.
        </p>
      </div>

      {done ? (
        <p className="rounded-xl border-2 border-lens/30 bg-lens/[0.06] p-4 text-sm text-foreground/85">
          Done. That is your password from now on.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full border-2 border-b-4 border-rock-edge px-4 py-1.5 font-mono text-[10px] font-black tracking-[0.16em] text-foreground/70 uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
        >
          Change password
        </button>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/45 uppercase">
              New password
            </span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded-lg border-2 border-rock-edge bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-lens"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/45 uppercase">
              Once more
            </span>
            <input
              type="password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded-lg border-2 border-rock-edge bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-lens"
            />
          </label>

          {error && (
            <p className="text-sm text-punch" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full border-2 border-b-4 border-lens/50 bg-lens/10 px-4 py-1.5 font-mono text-[10px] font-black tracking-[0.16em] text-lens uppercase active:translate-y-0.5 active:border-b-2 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="font-mono text-[10px] tracking-[0.16em] text-foreground/45 uppercase hover:text-foreground/80"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/*
        NOT HERE, AND NOT PRETENDING TO BE.
        Language: the game and the site are English throughout, and a picker
        offering a translation that does not exist is worse than no picker.
        Notifications: nothing in this game sends anything — no email but the
        sign-up and the reset link, and no push at all. Both appear the day they
        are real, like volume did and like the on-screen pad did.
      */}
      <p className="text-xs leading-relaxed text-foreground/40">
        No language setting yet: the site is English throughout, and a menu
        offering a translation nobody has written is a lie with a flag next to
        it. No notification settings either, because nothing in this game sends
        you anything — the only mail it will ever send you is a sign-up
        confirmation or a password reset you asked for.
      </p>
    </section>
  );
}