"use client";

/**
 * The between-run shop.
 *
 * PRD Q42 settled that this is a MAJOR surface rather than a menu: at a
 * 30-second base tank a session is roughly eight runs, so this screen is
 * proportionally about half the game. It is also where the run's second half is
 * really decided — whether the player can drink Restoration at 1 HP was chosen
 * here, before they pressed start.
 *
 * What is on the shelves, what it costs, and the rule about gold all live in
 * `src/config/shop.ts`. This file is only how you look at it.
 *
 * Two rules about how it looks:
 *
 * GRADES ARE NEVER NUMBERS. Internally a price is an array indexed by grade,
 * and that is the wrong thing to put on screen — "12·g1" is a database row. A
 * player holds a green emerald and a violet amethyst, and the shop shows the
 * stone: its own cut, its own colour, its own name. The number is how many.
 *
 * IT IS WARM, AND IT IS THE ONLY WARM ROOM. The dungeon is cold and dark
 * because you are running out of air in it; the menu is bright because it wants
 * to be pressed. The shop is neither — it is the one place in the game nothing
 * is chasing you, so it gets cream shelves and brown ink and honey for anything
 * that matters. The pixel icons all carry their own dark outlines, which is the
 * reason they still read against cream instead of dissolving into it.
 */

import { useState } from "react";
import {
  CATEGORIES,
  SHOP,
  afford,
  priceOf,
  type ShopCategory,
  type ShopItem,
  type Purse,
} from "@/config/shop";
import { tuning } from "@/config/tuning";

const GEM_NAME = tuning.loot.gemNames;
/** `prop-loot.png` is six 20px frames: five gems, then the coin. */
const LOOT_FRAMES = tuning.loot.grades + 1;
const COIN = tuning.loot.grades;

/** One stone or coin from the loot sheet, at whatever size is asked for. */
function Coin({ frame, size = 22 }: { frame: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        backgroundImage: "url(/art/prop-loot.png)",
        backgroundSize: `${size * LOOT_FRAMES}px ${size}px`,
        backgroundPosition: `${-size * frame}px 0`,
      }}
    />
  );
}

/** The item's own picture, from `items.png`, indexed by its place in `SHOP`. */
function ItemArt({ index, size = 64 }: { index: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-2xl border-2 border-shop-line/60 bg-shop-card-2"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        backgroundImage: "url(/art/items.png)",
        backgroundSize: `${size * SHOP.length}px ${size}px`,
        backgroundPosition: `${-size * index}px 0`,
      }}
    />
  );
}

/** A stone and how many of it. Never a grade number. */
function Cost({
  frame,
  need,
  have,
  label,
}: {
  frame: number;
  need: number;
  have: number;
  label: string;
}) {
  const enough = have >= need;
  return (
    <span
      title={`${need} ${label} — you have ${have}`}
      className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 ${
        enough
          ? "border-shop-line bg-shop-card-2"
          : "border-shop-line/40 bg-shop-card-2/50"
      }`}
    >
      <Coin frame={frame} size={20} />
      {/* The icon carries the colour; the number is ink. A mint-green count on
          a cream chip is unreadable, and a gold one is worse — the whole point
          of putting the stone here is that the stone is what identifies it. */}
      <span
        className="font-mono text-sm font-black text-shop-ink"
        style={{ opacity: enough ? 1 : 0.4 }}
      >
        {need}
      </span>
    </span>
  );
}

function Card({
  item,
  index,
  purse,
  level,
  beaten,
  worn,
  onBuy,
  onWear,
}: {
  item: ShopItem;
  index: number;
  purse: Purse;
  /** What has been beaten, which is what unlocks the one earned item. */
  beaten: readonly string[];
  /** How many of this one is already owned. */
  level: number;
  /** Whether THIS item is the one currently equipped in its slot. */
  worn: boolean;
  onBuy: () => void;
  onWear: () => void;
}) {
  const tiers = item.tiers ?? 1;
  const have = level > 0;
  const maxed = level >= tiers;
  // The price of the NEXT one, which climbs with every level already bought.
  const cost = priceOf(item, level);
  const check = afford(cost ?? item.price, purse);
  // Earned, not bought. There is exactly one of these and it is never for sale
  // at any price — what unlocks it is having beaten the thing it came off.
  const locked = item.earned !== undefined && !beaten.includes(item.earned);
  const canBuy =
    item.live && !maxed && !locked && item.earned === undefined
      ? cost !== null && check.affordable
      : item.earned !== undefined && !locked && !have;
  // Something you own but have not equipped gets a button that puts it on.
  const equippable = Boolean(item.skin || item.pet);
  const wearable = equippable && have && !worn;

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-b-[6px] border-shop-line bg-shop-card p-4">
      <div className="flex items-center gap-4">
        <ItemArt index={index} />

        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-lg font-black text-shop-ink">
              {item.name}
            </span>
            {tiers > 1 && (
              <span className="font-mono text-sm font-bold text-shop-mint">
                {level}/{tiers}
              </span>
            )}
            {tiers === 1 && have && (
              <span className="rounded-full border-2 border-shop-mint bg-shop-mint/20 px-2 text-[10px] font-black tracking-widest text-[#1d5138] uppercase">
                {worn ? "Equipped" : "Owned"}
              </span>
            )}
            {locked && (
              <span className="rounded-full border-2 border-shop-line bg-shop-card-2 px-2 text-[10px] font-black tracking-widest text-shop-ink-soft uppercase">
                beat the one at the bottom
              </span>
            )}
            {!item.live && (
              <span className="rounded-full border-2 border-shop-honey/70 bg-shop-honey/15 px-2 text-[10px] font-black tracking-widest text-shop-ink-soft uppercase">
                not wired up
              </span>
            )}
          </div>
        </div>

        {/* What it costs, on the right, as stones rather than as grades. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.earned === undefined &&
            (cost ?? item.price).gems.map((n, g) =>
              n === 0 ? null : (
                <Cost
                  key={g}
                  frame={g}
                  need={n}
                  have={purse.gems[g] ?? 0}
                  label={GEM_NAME[g]}
                />
              ),
            )}
          {item.earned === undefined && (cost ?? item.price).gold > 0 && (
            <Cost
              frame={COIN}
              need={(cost ?? item.price).gold}
              have={purse.gold}
              label="gold"
            />
          )}
        </div>

        <button
          disabled={!canBuy && !wearable}
          onClick={wearable ? onWear : canBuy ? onBuy : undefined}
          title={
            !item.live
              ? "The shelf is priced; the system behind it is not built yet."
              : maxed && !wearable
                ? "Nothing more to fit."
                : undefined
          }
          className={
            canBuy || wearable
              ? "w-28 shrink-0 rounded-2xl border-2 border-b-4 border-[#b9752f] bg-shop-honey px-3 py-2 text-sm font-black text-[#3d2408] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
              : "w-28 shrink-0 cursor-not-allowed rounded-2xl border-2 border-b-4 border-shop-line/60 bg-shop-card-2/60 px-3 py-2 text-sm font-black text-shop-ink-soft/60"
          }
        >
          {wearable
            ? "Wear"
            : maxed
              ? tiers > 1
                ? "Maxed"
                : worn
                  ? "Equipped"
                  : "Owned"
              : canBuy
                ? have
                  ? "Upgrade"
                  : "Buy"
                : item.live
                  ? "Short"
                  : "Soon"}
        </button>
      </div>

      <p className="text-xs font-semibold text-shop-ink-soft">{item.blurb}</p>

      {/* FR-13.2a made visible, and only to someone holding gold — told to an
          empty purse it appears on every row of every shelf, and a warning that
          is always on screen is not read. */}
      {check.blockedByThreshold && purse.gold > 0 && (
        <p className="text-[11px] font-bold text-shop-coral">
          Gold cannot cover this one. Bring back more of the stone itself.
        </p>
      )}
      {!check.blockedByThreshold && check.goldForGems > 0 && (
        <p className="text-[11px] font-bold text-[#a9752c]">
          + {check.goldForGems} gold to cover what you are short.
        </p>
      )}
    </div>
  );
}

export default function Shop({
  onClose,
  purse,
  levels,
  beaten,
  skin,
  pet,
  onBuy,
  onWear,
}: {
  onClose: () => void;
  purse: Purse;
  /** Item id to level owned. */
  levels: Readonly<Record<string, number>>;
  /** What has been beaten. The one earned item is locked until it is in here. */
  beaten: readonly string[];
  /** The armour currently worn, and the pet currently out. */
  skin: string | null;
  pet: string | null;
  onBuy: (id: string) => void;
  onWear: (id: string) => void;
}) {
  const [tab, setTab] = useState<ShopCategory>("gear");

  return (
    <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden rounded-lg bg-shop-bg p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="rounded-full border-2 border-b-4 border-shop-line bg-shop-card px-5 py-2 text-xs font-black tracking-wider text-shop-ink uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
        >
          Back
        </button>

        {/* The purse, always on screen. Deciding what to buy is the whole
            activity here and it cannot be done from memory. */}
        <div className="flex flex-wrap items-center gap-3 rounded-full border-2 border-shop-line bg-shop-card px-4 py-2">
          {purse.gems.map((n, g) => (
            <span
              key={g}
              title={GEM_NAME[g]}
              className="flex items-center gap-1"
              style={{ opacity: n > 0 ? 1 : 0.3 }}
            >
              <Coin frame={g} size={18} />
              <span className="font-mono text-sm font-black text-shop-ink">
                {n}
              </span>
            </span>
          ))}
          <span className="flex items-center gap-1" title="gold">
            <Coin frame={COIN} size={18} />
            <span className="font-mono text-sm font-black text-shop-ink">
              {purse.gold}
            </span>
          </span>
        </div>
      </div>

      {/* Four shelves, across the whole width. Equal columns, because they are
          equal choices — a tab strip bunched at the left reads as a filter. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setTab(c.key)}
            className={
              tab === c.key
                ? "rounded-2xl border-2 border-b-[6px] border-[#b9752f] bg-shop-honey px-4 py-3 text-sm font-black text-[#3d2408]"
                : "rounded-2xl border-2 border-b-[6px] border-shop-line bg-shop-card px-4 py-3 text-sm font-black text-shop-ink-soft transition-transform hover:-translate-y-0.5"
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-shop-card/70">
        {CATEGORIES.find((c) => c.key === tab)?.hint}
      </p>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {SHOP.map((item, index) =>
          item.category !== tab ? null : (
            <Card
              key={item.id}
              item={item}
              index={index}
              purse={purse}
              level={levels[item.id] ?? 0}
              beaten={beaten}
              worn={item.pet ? pet === item.id : skin === item.id}
              onBuy={() => onBuy(item.id)}
              onWear={() => onWear(item.id)}
            />
          ),
        )}
      </div>

      {/* This said nothing here survived closing the tab, and that balances
          belonged to a server that did not exist. Both were true in early August
          and neither has been true for a while — the balance is the server's
          now, exactly as FR-15.8 asks, and it is credited from a replay of the
          run that earned it rather than from anything this browser claims. */}
      <p className="text-[11px] text-shop-card/35">
        Potions come back every run. Everything else is kept on your account —
        loot is credited from the run itself, on the server, so it follows you to
        any browser you sign in from.
      </p>
    </div>
  );
}
