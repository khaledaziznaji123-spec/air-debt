/**
 * Developer mode: on, off, and where the switch is kept.
 *
 * Turned on by typing a phrase into Settings, off by typing another. It
 * survives a reload — which is the whole point, since the alternative is
 * re-enabling it every time you refresh to look at something.
 *
 * THIS IS NOT SECURITY, and it is worth being plain about that rather than
 * letting the passphrase imply otherwise. The phrase is in the client bundle,
 * the flag is in `localStorage`, and anyone with the developer console open can
 * set it in one line. It is a switch with a word on it: enough to stop it being
 * hit by accident, and nothing more.
 *
 * That is fine while the game is single-player and nothing persists. It stops
 * being fine the moment there is a server, and the answer then is not a better
 * phrase — it is that `SimState.god` travels with the run, so the server can
 * refuse to credit anything from a run that had it set. The cheat is allowed to
 * be trivially enabled precisely because it is also trivially detectable.
 */

/** Types this to turn it on. */
export const ADMIN_ON = "anayemene";
/** And this to turn it off again. Nothing else does. */
export const ADMIN_OFF = "anayemene2";

const KEY = "air-debt.admin";

/**
 * Subscribers, so `useSyncExternalStore` can re-render every reader when the
 * flag changes — including across tabs, which `storage` covers.
 */
const listeners = new Set<() => void>();

export function subscribeAdmin(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function isAdmin(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === "1";
  } catch {
    // Private browsing, or storage disabled. Not being able to cheat is a
    // survivable outcome; throwing on every render is not.
    return false;
  }
}

/**
 * What the server renders. Always off.
 *
 * `useSyncExternalStore` needs this to be a constant: the server has no
 * `localStorage`, and returning anything that could differ from run to run is
 * how you get a hydration mismatch instead of a re-render.
 */
export function isAdminOnServer(): boolean {
  return false;
}

export function setAdmin(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(KEY, "1");
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    return;
  }
  for (const fn of listeners) fn();
}

/**
 * What a phrase does, if anything.
 *
 * Returns null for anything that is not one of the two, so Settings can say
 * "that is not it" rather than silently doing nothing — a switch that gives no
 * feedback is a switch you cannot tell is broken.
 */
export function phraseMeans(input: string): boolean | null {
  const said = input.trim().toLowerCase();
  // OFF is checked first. It has ON as a prefix, so testing the other way round
  // would match "anayemene2" as an ON and the mode could never be turned off.
  if (said === ADMIN_OFF) return false;
  if (said === ADMIN_ON) return true;
  return null;
}

/**
 * The purse developer mode hands you.
 *
 * A big number rather than a real infinity: it is added, subtracted and
 * rendered like any other balance, and `Infinity - 12` printed in a shop chip
 * is worse than a number nobody will ever spend.
 */
export const ADMIN_PURSE = 999_999;
