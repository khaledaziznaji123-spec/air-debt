"use client";

import { useEffect, useState } from "react";
import { supabase } from "../auth.ts";

/**
 * Write to the person who made this, without leaving the page.
 *
 * The contact page has always listed real channels — a number, a Discord — and
 * every one of them asks the reader to go somewhere else and start a
 * conversation with a stranger. A form asks for a sentence. They are not the
 * same thing to somebody reporting that their gems vanished, and the ones who
 * would never open WhatsApp about a bug are exactly the ones whose bug reports
 * are worth having.
 *
 * The message is recorded in the database and emailed onward. Recorded FIRST,
 * so a mail provider having a bad day cannot turn "sent" into "lost" — see
 * `src/server/support.ts`.
 */
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If they are signed in, their address is already known and typing it again
  // is a small insult. Still editable — a person may want a reply somewhere
  // else, and the account is attached server-side regardless.
  useEffect(() => {
    let live = true;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      const known = data.session?.user?.email;
      if (live && known) setEmail((e) => e || known);
      const known_name = data.session?.user?.user_metadata?.name;
      if (live && typeof known_name === "string")
        setName((n) => n || known_name);
    })();
    return () => {
      live = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { data } = await supabase().auth.getSession();
      const jwt = data.session?.access_token;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Optional. Signed out is a perfectly good way to send this.
          ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ name, email, body }),
      });
      const json = (await res.json()) as { ok?: true; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "That did not send.");
        return;
      }
      setSent(true);
      setBody("");
    } catch {
      setError("That did not send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-[#5fd9cf]/30 bg-[#5fd9cf]/[0.06] p-5">
        <h3 className="font-mono text-xs font-bold tracking-[0.2em] text-[#5fd9cf] uppercase">
          Sent
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#c7d2dc]">
          It is written down and on its way to me. One person reads these, so a
          reply comes from a person — give it a day or two.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 font-mono text-xs tracking-[0.16em] text-[#6b7a89] uppercase underline decoration-[#2b3644] underline-offset-4 transition-colors hover:text-[#e7ecf2]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#6b7a89] uppercase">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            autoComplete="name"
            className="rounded-lg border border-[#2b3644] bg-[#10151d] px-3 py-2 text-sm text-[#e7ecf2] outline-none transition-colors focus:border-[#5fd9cf]"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#6b7a89] uppercase">
            Your email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
            className="rounded-lg border border-[#2b3644] bg-[#10151d] px-3 py-2 text-sm text-[#e7ecf2] outline-none transition-colors focus:border-[#5fd9cf]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#6b7a89] uppercase">
          What happened
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          maxLength={4000}
          placeholder="A bug, an idea, a score you think is wrong, or a question."
          className="resize-y rounded-lg border border-[#2b3644] bg-[#10151d] px-3 py-2 text-sm leading-relaxed text-[#e7ecf2] outline-none transition-colors placeholder:text-[#4a5765] focus:border-[#5fd9cf]"
        />
      </label>

      {error && (
        <p className="text-sm text-[#e56b6f]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={sending}
          className="rounded-full border border-[#5fd9cf]/50 bg-[#5fd9cf]/10 px-5 py-2 font-mono text-xs font-bold tracking-[0.16em] text-[#5fd9cf] uppercase transition-colors hover:bg-[#5fd9cf]/20 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        {/* Only once it is worth knowing about.
            It used to appear on the first keystroke, which is a number counting
            up next to somebody's sentence for no reason they can see — the
            first question it gets asked is "what is that", and a control whose
            first question is "what is that" is doing harm. A limit nobody is
            near is not information. */}
        {body.length > 3200 && (
          <span
            className={
              body.length >= 4000
                ? "text-xs font-semibold text-[#e56b6f]"
                : "text-xs text-[#8a94a6]"
            }
          >
            {4000 - body.length} characters left
          </span>
        )}
      </div>
    </form>
  );
}