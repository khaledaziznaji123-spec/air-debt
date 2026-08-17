/**
 * What survives a refresh: the balance, what has been bought, and which
 * shortcuts have been levered.
 *
 * TEMPORARY, and the architecture says so in two places. FR-15.8 and ARCH AD-10
 * both put this in a server-owned account that the client may never write —
 * because a client that can name its own balance has already beaten the
 * economy. This module is the shape of that account, not a substitute for it,
 * and the day there is a server it is deleted rather than migrated.
 *
 * It exists because the alternative was worse. Progress lived in a React ref,
 * which meant every page refresh — including the ones the dev server does by
 * itself on a file change — silently reset the player to nothing bought. The
 * failure mode was indistinguishable from the shop being broken: you buy a
 * sword, the page reloads, you start a run, and nothing happened.
 */

export type Progress = {
  /** Item id to level. Absent or 0 means not owned. */
  levels: Record<string, number>;
  /** Gems by grade, and gold. */
  gems: number[];
  gold: number;
  legendaries: number;
  /** Shortcut ids flicked, which FR-3.3 makes permanent. */
  levered: string[];
  /** The armour worn. */
  skin: string | null;
  /** The pet at your heels. */
  pet: string | null;
  /**
   * Things beaten, which unlock things no amount of money can.
   *
   * Separate from `levels` on purpose. A level is something you BOUGHT and the
   * shop can price; this is something you DID, and the only price it has is the
   * run you spent doing it — putting the two in one record would make an earned
   * reward look like a purchase with the cost field left blank.
   */
  beaten: string[];
};

const KEY = "air-debt.progress";

export const EMPTY_PROGRESS: Progress = {
  levels: {},
  gems: [],
  gold: 0,
  legendaries: 0,
  levered: [],
  skin: null,
  pet: null,
  beaten: [],
};

const listeners = new Set<() => void>();

export function subscribeProgress(fn: () => void): () => void {
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

/**
 * Cached, because `useSyncExternalStore` compares snapshots by identity and
 * will loop forever if every read parses a fresh object out of storage.
 */
let cache: Progress = EMPTY_PROGRESS;
let cachedRaw: string | null = null;

export function readProgress(): Progress {
  try {
    const raw = globalThis.localStorage?.getItem(KEY) ?? null;
    if (raw === cachedRaw) return cache;
    cachedRaw = raw;
    cache = raw ? { ...EMPTY_PROGRESS, ...JSON.parse(raw) } : EMPTY_PROGRESS;
    return cache;
  } catch {
    // Private browsing, disabled storage, or a value someone hand-edited into
    // nonsense. Losing progress is survivable; throwing on every render is not.
    return EMPTY_PROGRESS;
  }
}

/** What the server renders. Always empty, so hydration cannot mismatch. */
export function readProgressOnServer(): Progress {
  return EMPTY_PROGRESS;
}

export function writeProgress(next: Progress): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    return;
  }
  cachedRaw = null;
  for (const fn of listeners) fn();
}

export function clearProgress(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    return;
  }
  cachedRaw = null;
  for (const fn of listeners) fn();
}
