import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The support form's back end.
 *
 * `import "server-only"` for the same reason `progress.ts` has it: this holds
 * the service key, and the service key bypasses row-level security completely.
 * Importing this from a client component fails the build rather than shipping
 * the key to a browser.
 *
 * TWO DESTINATIONS, AND THE ORDER MATTERS. Every message is written to the
 * database first and emailed second. Email is the part that can fail — a
 * provider outage, an expired key, a spending cap — and a support form that
 * loses the message when the mail fails is worse than one that never emailed at
 * all, because the sender was told it arrived. The row is the record; the email
 * is a notification about the record.
 *
 * That also means the form works before the mail provider is configured at all,
 * which is deliberate: the feature is not blocked on somebody signing up for
 * something.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Where support mail goes, and who it appears to come from. */
const TO = process.env.SUPPORT_EMAIL ?? "luminymoonstars@gmail.com";
const RESEND = process.env.RESEND_API_KEY;
/** Resend's shared sender, which works with no domain set up. */
const FROM = process.env.SUPPORT_FROM ?? "Air Debt <onboarding@resend.dev>";

let admin: SupabaseClient | null = null;

function service(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error(
      "Supabase service credentials are missing — see .env.example",
    );
  }
  admin ??= createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** What a message may contain. Bounds, not taste. */
export const LIMITS = {
  name: 80,
  email: 200,
  body: 4000,
  agent: 300,
} as const;

export type Message = {
  name: string;
  email: string;
  body: string;
  userId?: string | null;
  agent?: string | null;
};

/**
 * Good enough for a form, and no more.
 *
 * Deliberately not a strict address parser. The purpose of checking is to catch
 * a typo before somebody waits a week for a reply that could never arrive — a
 * regex that rejects a legal-but-unusual address to prove a point costs a real
 * person their answer.
 */
export function checkMessage(m: Message): string | null {
  const name = m.name.trim();
  const email = m.email.trim();
  const body = m.body.trim();
  if (name.length < 1) return "Tell me what to call you.";
  if (name.length > LIMITS.name) return "That name is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "That email address does not look right.";
  if (email.length > LIMITS.email) return "That email address is too long.";
  if (body.length < 10) return "A little more detail would help.";
  if (body.length > LIMITS.body)
    return `Messages are capped at ${LIMITS.body} characters.`;
  return null;
}

/**
 * One message per minute per address.
 *
 * A public form is a public endpoint. This is not a defence against anybody
 * determined — the address is theirs to change — it is the cheap guard that
 * stops an accidental double submission and a bored person with a keyboard from
 * filling the table before anybody notices.
 */
const GAP_MS = 60_000;

export async function send(
  m: Message,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const problem = checkMessage(m);
  if (problem) return { ok: false, error: problem };

  const name = m.name.trim().slice(0, LIMITS.name);
  const email = m.email.trim().slice(0, LIMITS.email);
  const body = m.body.trim().slice(0, LIMITS.body);
  const agent = m.agent?.slice(0, LIMITS.agent) ?? null;

  const db = service();

  const { data: recent } = await db
    .from("messages")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = recent?.[0]?.created_at;
  if (last && Date.now() - new Date(last).getTime() < GAP_MS) {
    return {
      ok: false,
      error: "That was sent a moment ago. Give it a minute before the next one.",
    };
  }

  const { error } = await db.from("messages").insert({
    name,
    email,
    body,
    agent,
    user_id: m.userId ?? null,
  });
  if (error) return { ok: false, error: "The message could not be saved." };

  // Best effort, and never the reason the sender is told it failed — the
  // message is already recorded by the time this runs.
  await notify({ name, email, body }).catch(() => {});
  return { ok: true };
}

async function notify(m: { name: string; email: string; body: string }) {
  if (!RESEND) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      // So hitting reply in a mail client writes to the person who asked,
      // rather than to the robot that forwarded it.
      reply_to: m.email,
      subject: `Air Debt — ${m.name}`,
      text: `${m.name} <${m.email}>\n\n${m.body}`,
    }),
  });
}