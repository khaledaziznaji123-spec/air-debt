"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkPassword, setPassword, useAuth } from "../auth.ts";

/**
 * Where the emailed reset link lands.
 *
 * Opening that link signs the browser in with a short-lived recovery session,
 * which is what makes `updateUser` allowed here and nowhere else. So this page
 * has no token handling of its own — the SDK has already done it by the time
 * this renders, and all that is left is choosing the new password.
 *
 * If somebody navigates here without the link, they are not in a recovery
 * session and the page says so rather than showing a form that cannot work.
 */
export default function Reset() {
  const auth = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
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
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-[#0b0e14] px-6 py-20 text-[#e7ecf2]">
      <h1 className="font-mono text-2xl tracking-[0.25em]">NEW PASSWORD</h1>

      {auth.status === "loading" && (
        <p className="mt-8 font-mono text-sm text-[#5a6875]">…</p>
      )}

      {auth.status === "out" && (
        <div className="mt-8 max-w-md text-center">
          <p className="text-[#9fb0c0]">
            This page only works from the link in the reset email, and that link
            has either expired or was already used.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-full border border-white/15 px-8 py-3 font-mono text-sm tracking-widest hover:border-[#5fd9cf]/60"
          >
            START AGAIN
          </button>
        </div>
      )}

      {auth.status === "in" &&
        (done ? (
          <div className="mt-8 flex max-w-md flex-col items-center text-center">
            <p className="text-[#5fd9cf]">
              Done. That is your password from now on.
            </p>
            <button
              onClick={() => router.push("/home")}
              className="mt-6 rounded-full bg-[#5fd9cf] px-10 py-3.5 font-mono text-sm font-bold tracking-widest text-[#06231f] hover:bg-[#8fe9e1]"
            >
              PLAY
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 flex w-full max-w-sm flex-col gap-3"
          >
            <label htmlFor="pw" className="sr-only">
              New password
            </label>
            <input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 placeholder:text-[#5a6875] focus:border-[#5fd9cf]/60 focus:outline-none"
            />
            <label htmlFor="again" className="sr-only">
              The same password again
            </label>
            <input
              id="again"
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              placeholder="And again"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 placeholder:text-[#5a6875] focus:border-[#5fd9cf]/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#5fd9cf] px-10 py-3.5 font-mono text-sm font-bold tracking-widest text-[#06231f] hover:bg-[#8fe9e1] disabled:opacity-60"
            >
              {busy ? "…" : "SET IT"}
            </button>
            {error && (
              <p role="alert" className="text-center text-sm text-[#e56b6f]">
                {error}
              </p>
            )}
          </form>
        ))}
    </main>
  );
}
