"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth.ts";

/**
 * Wraps a page that you have to have signed up to see.
 *
 * A client guard rather than middleware, because what it is checking lives in
 * `localStorage` and the server cannot see it. That also means the honest
 * behaviour on the first paint is "we do not know yet" rather than "no": the
 * server render and the first client render must agree or React replaces the
 * page, so this holds a blank frame for one tick instead of flashing the
 * sign-up form at somebody who is already signed in.
 *
 * It is a routing convenience and NOT a security boundary. Nothing here is
 * secret — the game runs entirely on the player's machine — and when there is a
 * server, the things that actually need protecting (balances, leaderboards)
 * will be protected there, by it, and not by a redirect.
 */
export default function SignedIn({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "out") router.replace("/");
  }, [auth.status, router]);

  // "Loading" holds a blank frame rather than redirecting: the session is read
  // asynchronously, and treating "not yet known" as "signed out" bounces people
  // who are perfectly well signed in.
  if (auth.status !== "in") {
    return (
      <main
        className="min-h-full bg-[#0b0e14]"
        aria-busy="true"
        aria-label="Checking who is playing"
      />
    );
  }
  return <>{children}</>;
}
