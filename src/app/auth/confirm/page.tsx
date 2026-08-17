"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "../../auth.ts";

/**
 * Where every link we email lands — confirmations and password resets both.
 *
 * This page exists because the first version did not have it, and that is
 * exactly what "the link from the email does not work" was. Supabase verified
 * the address perfectly well and then bounced the player back to the landing
 * page carrying a one-time credential in the URL that nothing was reading. The
 * account was confirmed; the game just never noticed, so it still showed the
 * sign-up form and looked broken.
 *
 * There are two shapes that credential can arrive in, and this handles both,
 * because which one you get depends on a template setting in the dashboard:
 *
 *   token_hash   the link points HERE and we verify it ourselves. Works in any
 *                browser, including the one your mail app opens links in.
 *   code         Supabase verified it already and handed us an exchange code.
 *                Only works in the browser that started the sign-up, because
 *                the other half of the exchange is stored there.
 *
 * The second is the default and is the one that strands people who open their
 * email on a different device. Preferring the first is why the dashboard note
 * in the walkthrough asks for the template change.
 */
export default function ConfirmPage() {
  return (
    <Suspense fallback={<Waiting />}>
      <Confirm />
    </Suspense>
  );
}

function Waiting() {
  return (
    <main className="flex min-h-full items-center justify-center bg-[#0b0e14] px-6 text-[#9fb0c0]">
      <p className="font-mono text-sm tracking-widest">CHECKING THE LINK…</p>
    </main>
  );
}

function Confirm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const sb = supabase();
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const code = params.get("code");
      // Where to go afterwards: a recovery link needs the new-password form,
      // everything else can go straight into the game.
      const next =
        params.get("next") ?? (type === "recovery" ? "/reset" : "/home");

      // Supabase puts its own failures in the query string rather than
      // throwing, and an expired link is the common one.
      const described = params.get("error_description");
      if (described) {
        if (alive) setError(described);
        return;
      }

      if (tokenHash && type) {
        const { error } = await sb.auth.verifyOtp({
          type: type as "signup" | "recovery" | "email_change" | "magiclink",
          token_hash: tokenHash,
        });
        if (!alive) return;
        if (error) return setError(error.message);
        return router.replace(next);
      }

      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (!alive) return;
        if (error) {
          return setError(
            "This link was opened in a different browser from the one you signed up in. Sign in with your email and password instead — your account is confirmed.",
          );
        }
        return router.replace(next);
      }

      // No credential in the URL at all. The older style puts the tokens in the
      // fragment and the client picks them up on its own, so give that a moment
      // before deciding nothing happened.
      const { data } = await sb.auth.getSession();
      if (!alive) return;
      if (data.session) return router.replace(next);
      setError(
        "There was nothing in that link. It may have already been used.",
      );
    })();

    return () => {
      alive = false;
    };
  }, [params, router]);

  if (!error) return <Waiting />;

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-[#0b0e14] px-6 py-20 text-center text-[#e7ecf2]">
      <h1 className="font-mono text-xl tracking-[0.25em]">LINK NOT ACCEPTED</h1>
      <p className="max-w-md text-[#9fb0c0]">{error}</p>
      <button
        onClick={() => router.replace("/")}
        className="rounded-full bg-[#5fd9cf] px-10 py-3.5 font-mono text-sm font-bold tracking-widest text-[#06231f] hover:bg-[#8fe9e1]"
      >
        SIGN IN
      </button>
    </main>
  );
}
