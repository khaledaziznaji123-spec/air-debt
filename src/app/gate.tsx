"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authConfigured,
  checkName,
  checkPassword,
  requestReset,
  signIn,
  signUp,
  useAuth,
} from "./auth.ts";

/**
 * The front door: sign up, sign in, or ask for a reset link.
 *
 * One component for all three because they are the same form with different
 * fields showing, and splitting them into three pages would mean three copies
 * of the same layout drifting apart. The mode is local state, not a route —
 * nobody links to "the sign-in tab".
 */

type Mode = "up" | "in" | "forgot";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-[#e7ecf2] placeholder:text-[#5a6875] focus:border-[#5fd9cf]/60 focus:outline-none";

export default function Gate() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!authConfigured) {
    return (
      <p className="mt-10 max-w-md rounded-xl border border-[#e56b6f]/30 bg-[#e56b6f]/10 px-5 py-4 text-sm text-[#e56b6f]">
        Accounts are not configured on this build. Copy{" "}
        <code className="font-mono">.env.example</code> to{" "}
        <code className="font-mono">.env.local</code> and fill in the Supabase
        URL and anon key.
      </p>
    );
  }

  if (auth.status === "loading") {
    return (
      <p className="mt-10 font-mono text-sm tracking-widest text-[#5a6875]">
        …
      </p>
    );
  }

  if (auth.status === "in") {
    return (
      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={() => router.push("/home")}
          className="rounded-full bg-[#5fd9cf] px-12 py-4 font-mono text-lg font-bold tracking-widest text-[#06231f] transition hover:bg-[#8fe9e1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5fd9cf] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
        >
          PLAY
        </button>
        <p className="text-sm text-[#6b7a89]">
          Signed in as <span className="text-[#e7ecf2]">{auth.name}</span>.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNote(null);

    if (mode === "forgot") {
      if (!email.includes("@"))
        return setError("That is not an email address.");
      setBusy(true);
      const r = await requestReset(email);
      setBusy(false);
      return "error" in r ? setError(r.error) : setNote(r.message ?? null);
    }

    if (!email.includes("@")) return setError("That is not an email address.");
    const pwProblem = checkPassword(password);
    if (pwProblem) return setError(pwProblem);

    if (mode === "up") {
      const nameProblem = checkName(name);
      if (nameProblem) return setError(nameProblem);
      setBusy(true);
      const r = await signUp(email, password, name);
      setBusy(false);
      if ("error" in r) return setError(r.error);
      // Confirmation is on, so there is no session yet — the message is the
      // whole result and the form must not look like it did nothing.
      if (r.message) return setNote(r.message);
      return router.push("/home");
    }

    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if ("error" in r) return setError(r.error);
    router.push("/home");
  }

  const titles: Record<Mode, string> = {
    up: "CREATE AN ACCOUNT",
    in: "SIGN IN",
    forgot: "RESET YOUR PASSWORD",
  };

  return (
    <form
      onSubmit={submit}
      className="mt-10 flex w-full max-w-md flex-col gap-3"
    >
      <p className="text-center font-mono text-xs tracking-[0.25em] text-[#5fd9cf]">
        {titles[mode]}
      </p>

      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={FIELD}
      />

      {mode === "up" && (
        <>
          <label htmlFor="name" className="sr-only">
            The name the game calls you
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name in the game"
            maxLength={18}
            autoComplete="nickname"
            className={FIELD}
          />
        </>
      )}

      {mode !== "forgot" && (
        <>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={FIELD}
          />
        </>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-[#5fd9cf] px-10 py-4 font-mono text-lg font-bold tracking-widest text-[#06231f] transition hover:bg-[#8fe9e1] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5fd9cf] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
      >
        {busy
          ? "…"
          : mode === "up"
            ? "PLAY"
            : mode === "in"
              ? "SIGN IN"
              : "SEND LINK"}
      </button>

      {error && (
        <p role="alert" className="text-center text-sm text-[#e56b6f]">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="text-center text-sm text-[#5fd9cf]">
          {note}
        </p>
      )}

      <div className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-[#6b7a89]">
        {mode !== "up" && (
          <button
            type="button"
            className="underline hover:text-[#e7ecf2]"
            onClick={() => {
              setMode("up");
              setError(null);
              setNote(null);
            }}
          >
            Create an account
          </button>
        )}
        {mode !== "in" && (
          <button
            type="button"
            className="underline hover:text-[#e7ecf2]"
            onClick={() => {
              setMode("in");
              setError(null);
              setNote(null);
            }}
          >
            I already have one
          </button>
        )}
        {mode !== "forgot" && (
          <button
            type="button"
            className="underline hover:text-[#e7ecf2]"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setNote(null);
            }}
          >
            Forgot password
          </button>
        )}
      </div>

      {/* Said once, on the screen where it matters. */}
      <p className="text-center text-xs leading-relaxed text-[#5a6875]">
        We will never email you a password. If you forget it we send a one-time
        link, and you choose a new one yourself.
      </p>
    </form>
  );
}
