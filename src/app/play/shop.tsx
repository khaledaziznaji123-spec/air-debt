"use client";

/**
 * The between-run shop.
 *
 * PRD Q42 settled that this is a MAJOR surface, not a menu: at a 30-second base
 * tank a session is roughly eight runs, so this screen is proportionally about
 * half the game. It is also where the run's second half is really decided —
 * whether Maya can drink Restoration at 1 HP was chosen here, before she
 * pressed start.
 *
 * Nothing is purchasable yet. Balances are server-owned (ARCH AD-10, FR-15.8)
 * and there is no persistence, so this shows the shape of the economy and its
 * rules rather than pretending to sell anything. Saying so is better than a
 * button that silently does nothing.
 */

import { tuning } from "@/config/tuning";

type Item = {
  name: string;
  detail: string;
  cost: { grade: number; count: number }[];
  tag?: string;
};

const WEAPONS: Item[] = [
  {
    name: "Honed edge",
    detail: "+6 sword damage",
    cost: [{ grade: 1, count: 12 }],
  },
  {
    name: "Longer guard",
    detail: "+2 ticks of parry window",
    cost: [{ grade: 1, count: 18 }],
    tag: "forgiving",
  },
];

const GEAR: Item[] = [
  {
    name: "Padded coat",
    detail: "+20 max health",
    cost: [{ grade: 1, count: 14 }],
  },
  {
    name: "Second tank",
    detail: `+${tuning.air.perUpgrade / 60}s of air`,
    cost: [
      { grade: 1, count: 20 },
      { grade: 2, count: 6 },
    ],
    tag: "the master resource",
  },
];

const POTIONS: Item[] = [
  {
    name: "Restoration",
    detail: "Heals to full, once",
    cost: [
      { grade: 1, count: 4 },
      { grade: 2, count: 1 },
    ],
  },
  {
    name: "Air",
    detail: "+10s mid-run",
    cost: [
      { grade: 1, count: 6 },
      { grade: 2, count: 2 },
    ],
  },
  {
    name: "Passage",
    detail: "Skip to the next environment — forfeits its loot",
    cost: [
      { grade: 1, count: 5 },
      { grade: 3, count: 1 },
    ],
  },
];

function Row({ item, gems }: { item: Item; gems: number }) {
  const grade1 = item.cost.find((c) => c.grade === 1)?.count ?? 0;
  const affordable = gems >= grade1 && item.cost.length === 1;
  const needsHigher = item.cost.length > 1;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#e8edf5]">
          {item.name}
          {item.tag && (
            <span className="ml-2 text-[10px] font-normal tracking-wide text-[#4ecdc4] uppercase">
              {item.tag}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-[#8a94a6]">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2 font-mono text-xs">
          {item.cost.map((c) => (
            <span
              key={c.grade}
              className={
                c.grade === 1 && gems >= c.count
                  ? "text-[#4ecdc4]"
                  : "text-[#8a94a6]"
              }
            >
              {c.count}
              <span className="opacity-60">×g{c.grade}</span>
            </span>
          ))}
        </div>
        <button
          disabled
          title={
            needsHigher
              ? "Needs higher-grade gems — only found deeper in"
              : "Not purchasable yet: balances are server-owned and persistence is not built"
          }
          className={`cursor-not-allowed rounded px-3 py-1 text-xs font-semibold ${
            affordable
              ? "bg-[#4ecdc4]/20 text-[#4ecdc4]"
              : "bg-white/5 text-[#8a94a6]"
          }`}
        >
          {affordable ? "Afford" : needsHigher ? "Deeper" : "Short"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  gems,
}: {
  title: string;
  items: Item[];
  gems: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-1 text-[11px] font-bold tracking-widest text-[#4ecdc4] uppercase">
        {title}
      </p>
      {items.map((i) => (
        <Row key={i.name} item={i} gems={gems} />
      ))}
    </div>
  );
}

export default function Shop({
  gems,
  onClose,
}: {
  gems: number;
  onClose: () => void;
}) {
  const threshold = Math.round(tuning.economy.goldShortfallThreshold * 100);

  return (
    <div className="absolute inset-0 flex flex-col gap-3 overflow-y-auto rounded-lg bg-[#0b0e14]/97 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-[#e8edf5]">Between runs</h2>
        <p className="font-mono text-sm text-[#4ecdc4]">
          {gems} <span className="text-[#8a94a6]">grade-1 gems</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Section title="Weapons" items={WEAPONS} gems={gems} />
        <Section title="Gear" items={GEAR} gems={gems} />
        <Section title="Potions" items={POTIONS} gems={gems} />
      </div>

      <div className="rounded-lg border border-[#f4a259]/30 bg-[#f4a259]/5 p-3">
        <p className="text-xs text-[#f4a259]">
          <span className="font-bold">The {threshold}% rule.</span>{" "}
          <span className="text-[#8a94a6]">
            Gold can cover a shortfall only once you already hold {threshold}%
            of the gems a purchase needs, counted separately for every grade.
            Money never buys more than the last {100 - threshold}% of anything.
          </span>
        </p>
      </div>

      <p className="text-xs text-[#8a94a6]">
        Nothing is buyable yet — balances live on the server and persistence is
        not built. Higher-grade gems only drop deeper in, which is why the
        expensive items say <span className="text-[#e8edf5]">Deeper</span>.
      </p>

      <button
        onClick={onClose}
        className="mt-auto self-start rounded bg-[#4ecdc4] px-5 py-2 font-semibold text-[#0b0e14] transition hover:brightness-110"
      >
        Back
      </button>
    </div>
  );
}
