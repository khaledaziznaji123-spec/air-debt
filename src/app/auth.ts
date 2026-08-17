"use client";

/**
 * Accounts, for real this time.
 *
 * The previous version of this file stored a name in `localStorage` and said so
 * on the sign-up form, because there was nothing behind it. There is now: the
 * Supabase project the architecture always named. So this is email and
 * password, held by a service that can actually hold them.
 *
 * Two things are deliberate and worth knowing before changing anything here.
 *
 * NO PASSWORD IS EVER EMAILED. The ask was "send them a new password", and that
 * is the one part of the request this does not do. Email is not a secure
 * channel — it sits in plain text on several machines that are not ours — and a
 * system that can email you your password is a system that knows your password,
 * which a good one never should. What `requestReset` does instead is send a
 * one-time link that proves you can read the inbox, and that link is the only
 * thing that lets you choose a new password. Same outcome for the player, none
 * of the exposure.
 *
 * THE ANON KEY IS SUPPOSED TO BE PUBLIC. It ships to the browser by design and
 * is safe there because row-level security decides what it can touch. The
 * SERVICE ROLE key is the opposite — it bypasses row-level security entirely,
 * and FR-15.8 exists because currency has to be written with it, server-side.
 * It must never be imported into a client component. This file is client-only
 * and touches the anon key alone.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether accounts are switched on at all.
 *
 * A missing key is a deployment that has not been configured, not a bug, and
 * the game should say so plainly rather than throwing on first paint.
 */
export const authConfigured = Boolean(URL && ANON);

let client: SupabaseClient | null = null;

/** The one browser client. Created lazily so an unconfigured build can load. */
export function supabase(): SupabaseClient {
  if (!authConfigured) {
    throw new Error("Supabase is not configured — see .env.example");
  }
  client ??= createBrowserClient(URL!, ANON!);
  return client;
}

/** What the game calls you. Kept on the account, so it follows you. */
export function displayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as { name?: unknown } | undefined;
  const name = typeof meta?.name === "string" ? meta.name.trim() : "";
  // Falls back to the local part of the email rather than to a blank, so the
  // HUD always has something to print even on an account made elsewhere.
  return name || (user.email ?? "").split("@")[0] || "scavenger";
}

export type AuthState =
  /** Still asking Supabase. The first paint, and after a refresh. */
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; user: User; name: string };

/**
 * Who is signed in.
 *
 * Three states rather than two on purpose. "We do not know yet" is a real
 * condition — the session lives in storage and is read asynchronously — and
 * collapsing it into "signed out" is what makes an app flash its login screen
 * at somebody who is already signed in.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(
    authConfigured ? { status: "loading" } : { status: "out" },
  );

  useEffect(() => {
    if (!authConfigured) return;
    let alive = true;
    const sb = supabase();

    const settle = (session: Session | null) => {
      if (!alive) return;
      setState(
        session?.user
          ? {
              status: "in",
              user: session.user,
              name: displayName(session.user),
            }
          : { status: "out" },
      );
    };

    sb.auth.getSession().then(({ data }) => settle(data.session));
    // Covers sign-in, sign-out, token refresh, and the recovery link landing.
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      settle(session),
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** What is wrong with a password, or null. */
export function checkPassword(pw: string): string | null {
  // Supabase enforces its own minimum; this is so the player hears about it
  // before a round trip rather than after one.
  if (pw.length < 8) return "At least eight characters.";
  if (pw.length > 72) return "That is longer than the maximum of 72.";
  return null;
}

/** What is wrong with a display name, or null. */
// Moved to `src/config/names.ts` so the server can use it too — a public board
// has to check a name before it publishes it, and this is a client module.
// Re-exported so every existing import here keeps working.
export { checkName, NAME_MAX } from "../config/names.ts";
import { checkName } from "../config/names.ts";

/**
 * Change what the game calls you.
 *
 * Written client-side, from the player's own session, and that is the right
 * place for it — `user_metadata` is the one part of an account Supabase
 * deliberately lets its owner write. It is a display name, not a balance: the
 * reason `progress` goes through server code is that a browser writing `gold`
 * can write a million, and there is no equivalent of a million here.
 *
 * The name is checked here so the player gets a useful message, and checked
 * AGAIN on the server before it goes on a public board — the API can be called
 * without this form, so this validation is a courtesy rather than a defence.
 */
export async function rename(raw: string): Promise<Outcome> {
  const problem = checkName(raw);
  if (problem) return { error: problem };
  const { error } = await supabase().auth.updateUser({
    data: { name: raw.trim() },
  });
  if (error) return { error: say(error.message) };
  return { ok: true, message: "That is your name now." };
}

export type Outcome = { error: string } | { ok: true; message?: string };

/** Turn whatever came back into something worth reading. */
function say(message: string | undefined): string {
  if (!message) return "Something went wrong. Try again.";
  // Supabase's own wording is mostly fine; these two are not.
  if (/invalid login credentials/i.test(message))
    return "That email and password do not match an account.";
  if (/user already registered/i.test(message))
    return "There is already an account on that email. Sign in instead.";
  return message;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<Outcome> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: {
      data: { name: name.trim() },
      // Every emailed link lands on the one page that knows how to finish the
      // job. Pointing it at "/" is what made confirmation look broken: the
      // address was verified and the game never noticed.
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/home`,
    },
  });
  if (error) return { error: say(error.message) };
  // The project requires confirmation, so a fresh sign-up comes back with a
  // user and no session. Saying "check your email" is the whole of the UX here
  // — without it the form looks like it silently failed.
  if (!data.session) {
    return {
      ok: true,
      message: "Check your email and open the link to finish signing up.",
    };
  }
  return { ok: true };
}

export async function signIn(
  email: string,
  password: string,
): Promise<Outcome> {
  const { error } = await supabase().auth.signInWithPassword({
    email,
    password,
  });
  return error ? { error: say(error.message) } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

/**
 * Start a password reset.
 *
 * Always reports success, even for an address with no account. Telling a
 * stranger which emails are registered is a way of enumerating your users, and
 * it buys the player nothing — they either get the email or they mistyped.
 */
export async function requestReset(email: string): Promise<Outcome> {
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/confirm?next=/reset`,
  });
  if (error && !/rate limit/i.test(error.message)) {
    return { error: say(error.message) };
  }
  if (error) {
    // An hour, not a minute. Supabase's built-in sender allows only a couple of
    // messages an hour, and saying "wait a minute" sends the player back to
    // press the button four more times and burn the allowance further.
    return {
      error:
        "Too many emails have gone out from this project in the last hour. Wait an hour and try again, or connect a proper email sender in Supabase.",
    };
  }
  return {
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  };
}

/** Finish a reset, from the page the emailed link lands on. */
export async function setPassword(password: string): Promise<Outcome> {
  const { error } = await supabase().auth.updateUser({ password });
  return error ? { error: say(error.message) } : { ok: true };
}
