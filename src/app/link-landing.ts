"use client";

import { useEffect } from "react";

/**
 * Catch an emailed link that landed on the wrong page.
 *
 * Supabase will only send people to addresses on its own allow-list. Anything
 * else is quietly replaced with the project's Site URL — so a link aimed at
 * `/auth/confirm` arrives at `/` instead, still carrying its one-time
 * credential, and the front page has no idea what to do with it. That is
 * precisely what "the link from the email does not work" looked like.
 *
 * The dashboard setting is still worth doing. But depending on a checkbox in
 * somebody else's console for the sign-up flow to work at all is a bad bargain,
 * so the front page now forwards anything that looks like an auth credential to
 * the page that handles it. With the setting, links go straight there; without
 * it, they get there one hop later. Either way they work.
 *
 * `window.location.replace` rather than the router, because the older style of
 * link puts its tokens in the URL **fragment** and a client-side navigation
 * would drop it.
 */
export function useAuthLinkLanding(): void {
  useEffect(() => {
    const { search, hash, pathname } = window.location;
    if (pathname.startsWith("/auth/confirm")) return;

    const query = new URLSearchParams(search);
    // The fragment carries `access_token` in the implicit style; strip the `#`
    // before parsing it as a query string.
    const fragment = new URLSearchParams(
      hash.startsWith("#") ? hash.slice(1) : hash,
    );

    const carries =
      query.has("code") ||
      query.has("token_hash") ||
      query.has("error_description") ||
      fragment.has("access_token") ||
      fragment.has("error_description");
    if (!carries) return;

    // A recovery link has to end at the new-password form; everything else can
    // go into the game.
    const type = query.get("type") ?? fragment.get("type");
    const next = type === "recovery" ? "/reset" : "/home";
    const forward = new URLSearchParams(search);
    if (!forward.has("next")) forward.set("next", next);

    window.location.replace(`/auth/confirm?${forward.toString()}${hash}`);
  }, []);
}
