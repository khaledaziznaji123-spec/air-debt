/**
 * What the shop sells.
 *
 * PRD Q42 settled that the shop is a MAJOR surface rather than a menu: at a
 * 30-second base tank a session is roughly eight runs, so this screen is
 * proportionally about half the game, and it is where the second half of a run
 * is really decided.
 *
 * Four shelves — weapons, gear, potions, cosmetics — and the split is not
 * cosmetic itself. Each one answers a different question, and a player standing
 * here with 40 gems is choosing between them:
 *
 *   weapons    kill faster  → less time spent fighting → more air for depth
 *   gear       last longer  → survive the depth you already reach
 *   potions    a way out of one specific disaster, once
 *   cosmetics  nothing. Which is why it is the only shelf gold buys outright.
 *
 * Prices are in GEMS BY GRADE, not in one number. A grade-1 emerald and a
 * grade-5 diamond are not interchangeable, and pricing everything in a single
 * total would quietly undo FR-10: depth is what pays, and a price that only a
 * deep run's stones can meet is how depth pays.
 */

import { tuning } from "./tuning.ts";

export type ShopCategory = "weapons" | "gear" | "potions" | "cosmetics";

export type Price = {
  /** Gems required, indexed by grade - 1. Sparse: absent means none. */
  gems: readonly number[];
  gold: number;
};

/**
 * What owning a thing changes, as DELTAS against the tuning table.
 *
 * Deltas rather than absolute values so that two items touching the same stat
 * add up rather than one silently winning, and so that retuning the base number
 * carries the upgrade with it — an item that hardcoded "attack damage becomes
 * 20" would quietly become a downgrade the day the sword is buffed.
 *
 * This lives next to the price on purpose. What a thing costs and what it does
 * are one decision, and splitting them across two files is how a shop ends up
 * selling something for twelve emeralds that turns out to do nothing.
 */
export type ShopEffect = {
  attackDamage?: number;
  attackReach?: number;
  /** Ticks shaved off the swing's recovery. Faster, not stronger. */
  attackRecovery?: number;
  riposteDamage?: number;
  stunDamage?: number;
  smashDamage?: number;
  smashRadius?: number;
  /** Extra health bars. The bar SIZE never changes, so damage stays countable. */
  healthBars?: number;
  walkSpeed?: number;
  climbSpeed?: number;
  /** Multiplies the speed you slide down a wall. Zero means you stop dead. */
  wallSlideScale?: number;
  /**
   * Multiplies what catching fire costs. Zero at the bottom means fire cannot
   * take hold at all, the same way the boots' wall slide bottoms out at a stop.
   */
  burnScale?: number;
  /**
   * Multiplies what being poisoned costs. The burn's twin, and zero at the
   * bottom for the same reason.
   */
  venomScale?: number;
  /**
   * Multiplies EVERY point of damage the player takes, from any source.
   *
   * The only stat in the table that touches all of them at once, which is why
   * it is legendary and why there is exactly one item with it. Everything else
   * on the gear shelf answers one question — this one answers the question
   * behind all of them, and a second copy would stack into immunity.
   */
  damageScale?: number;
  /**
   * Multiplies every point of damage the player DEALS — swing, riposte, stun
   * and smash together.
   *
   * The mirror of `damageScale`, and the same argument: the weapons shelf sells
   * reach, recovery and flat damage one at a time, and this is the one thing
   * that lifts the whole set at once.
   *
   * Half again rather than a quarter. It is priced across all five
   * environments — near enough ten complete clears — and a reward that far away
   * has to change how the game plays rather than shave a tick off a kill.
   */
  attackScale?: number;
  /**
   * How much further ahead the camera leads, in world units.
   *
   * The one stat on this list the SIMULATION never reads. It is a view
   * concern end to end — where the camera sits changes nothing about what
   * happens, only about how much warning you get — and keeping it out of the
   * sim is what stops a cosmetic-feeling item quietly becoming a thing a replay
   * has to reproduce (ARCH AD-1).
   *
   * It is still an advantage, and a real one: the parkour and the fire are read
   * a beat late at the default lead, and a beat is the difference between
   * jumping a crusher and walking into it.
   */
  sightAhead?: number;
  /**
   * Multiplies what falling in a pit costs.
   *
   * A pit normally takes everything above your last bar. This scales that loss
   * — it never scales the FLOOR, so no amount of buying makes a pit free, and
   * falling in on one bar still ends the run.
   */
  pitCostScale?: number;
};

export type ShopItem = {
  id: string;
  category: ShopCategory;
  name: string;
  /** What it does, in the player's terms, not the system's. */
  blurb: string;
  price: Price;
  /** What owning it changes. Absent for potions and cosmetics. */
  effect?: ShopEffect;
  /**
   * A consumable carried into a run rather than a permanent change. One is
   * granted per run, and spending it is the whole item.
   */
  potion?:
    "restoration" | "breath" | "haste" | "venom" | "ward" | "milk" | "shield";
  /** A recolour of the player. Renderer only — it changes nothing in the sim. */
  /**
   * A full alternate sprite family, not a tint.
   *
   * The first attempt at cosmetics was six multiply-tints over the ordinary
   * player, on the grounds that fifteen animations recoloured five ways is four
   * hundred frames to regenerate. It was cheap and it looked it — the same man
   * slightly the wrong colour. A skin is a different SILHOUETTE now: heavier
   * plate, a crested helm, a bigger blade, generated as its own sheets.
   */
  skin?: "crimson" | "pale" | "void" | "leviathan" | "revenant";
  /**
   * A second creature that follows you around. Purely decorative — it is drawn
   * by the view and the simulation does not know it exists, which is what makes
   * it safe to give one physics of its own.
   */
  pet?: "moth" | "pup" | "rat";
  /**
   * Not for sale at any price — earned instead.
   *
   * There is exactly one, and it exists because the shop is the wrong shape for
   * this reward: everything else on the shelves is a decision about money, and
   * the Revenant's coat is a decision about whether you can beat the thing at
   * the bottom. A price on it would say "this is worth eleven diamonds", and
   * what it is actually worth is that you went down there.
   *
   * It sits on the cosmetics shelf either way, so the shape of the thing you
   * have not got yet is visible from the first run.
   */
  earned?: "revenant";
  /**
   * Deep stones on the top of the ladder.
   *
   * The last level of anything is endgame, and it should cost what the endgame
   * holds. Without this it could not: `priceOf` scales the level-1 price
   * uniformly, so a grade that starts at zero stays at zero however high the
   * ladder goes — every ladder in the shop was payable start to finish with the
   * stones of the first two environments.
   *
   * `from` is the zero-based level the deep stones begin at, and the amounts
   * are PER LEVEL beyond it, so the requirement ramps rather than appearing
   * whole. The air tank is the deliberate exception: ten tiers, and the deep
   * stones only start at the seventh and stay small, because the tank is the
   * one thing a player must always be able to keep buying.
   */
  deep?: { from: number; topaz: number; diamond: number };
  /**
   * True when buying it changes the game.
   *
   * The shelves are stocked ahead of the systems that would honour them, on
   * purpose: the prices are the design, and a price cannot be judged against an
   * empty shelf. But a button that takes gems and does nothing is a lie, so
   * everything not wired up says so and cannot be bought.
   */
  live: boolean;
  /**
   * How many times it can be bought.
   *
   * Everything on the weapons and gear shelves is a LADDER rather than a
   * switch: you buy level 1, then level 2 costs more and does more. That is
   * what keeps a shelf worth returning to after the first good run, and it is
   * why the effect below is stated per level rather than in total.
   *
   * Potions and cosmetics have no tiers — a second copy of a look is nothing,
   * and a potion is restocked every run rather than upgraded.
   */
  tiers?: number;
  /**
   * What each level past the first adds to the price, as a multiplier on the
   * base. Level n costs `price * (1 + (n - 1) * step)`, rounded.
   *
   * Climbing, because the first level of anything is the cheapest way to get
   * better and the last should be a real decision against a different shelf.
   */
  priceStep?: number;
};

/** Grades are 1-indexed in the fiction and 0-indexed here. */
function gems(...byGrade: number[]): readonly number[] {
  const out = new Array(tuning.loot.grades).fill(0);
  byGrade.forEach((n, i) => (out[i] = n));
  return out;
}

/**
 * The shelves.
 *
 * Six on each, and the order within a shelf is the order they are drawn in —
 * `items.png` is indexed by position here, so inserting one in the middle moves
 * every icon after it.
 *
 * Weapons and gear are LADDERS: three or ten levels, each costing more than the
 * last. Potions and cosmetics are switches — a potion is restocked every run
 * rather than upgraded, and a second copy of a look is nothing.
 */
export const SHOP: readonly ShopItem[] = [
  // ------------------------------------------------------------- weapons
  {
    id: "weapon.honed",
    category: "weapons",
    name: "Honed edge",
    blurb: "Five more damage a swing. Three of them, and a goblin dies to one.",
    price: { gems: gems(30), gold: 0 },
    deep: { from: 2, topaz: 7, diamond: 4 },
    tiers: 3,
    priceStep: 0.8,
    effect: { attackDamage: 5 },
    live: true,
  },
  {
    id: "weapon.long",
    category: "weapons",
    name: "Longer blade",
    blurb:
      "Ten more reach a level. Stand where a goblin's swing cannot answer.",
    price: { gems: gems(32, 22), gold: 0 },
    deep: { from: 2, topaz: 8, diamond: 5 },
    tiers: 3,
    priceStep: 0.7,
    effect: { attackReach: 10 },
    live: true,
  },
  {
    id: "weapon.counter",
    category: "weapons",
    name: "Riposte plate",
    blurb: "A parry hits back harder. Reading an attack becomes the attack.",
    price: { gems: gems(32, 22), gold: 0 },
    deep: { from: 2, topaz: 8, diamond: 5 },
    tiers: 3,
    priceStep: 0.8,
    effect: { riposteDamage: 5 },
    live: true,
  },
  {
    id: "weapon.pommel",
    category: "weapons",
    name: "Weighted pommel",
    blurb:
      "The guard-breaker starts doing real damage as well as opening them up.",
    price: { gems: gems(28), gold: 0 },
    deep: { from: 2, topaz: 6, diamond: 4 },
    tiers: 3,
    priceStep: 0.7,
    effect: { stunDamage: 4 },
    live: true,
  },
  {
    id: "weapon.breaker",
    category: "weapons",
    name: "Breaker head",
    blurb: "The smash lands heavier and wider. The answer to being surrounded.",
    price: { gems: gems(34, 24), gold: 0 },
    deep: { from: 2, topaz: 9, diamond: 6 },
    tiers: 3,
    priceStep: 0.8,
    effect: { smashDamage: 6, smashRadius: 10 },
    live: true,
  },

  // ---------------------------------------------------------------- gear
  {
    id: "weapon.igris",
    category: "weapons",
    name: "Sovereign edge",
    blurb: "Legendary. Every attack you have lands half again as hard.",
    // Every attack, which is the point: the rest of this shelf sells reach,
    // recovery and flat damage one at a time, and each of those is a decision
    // about which verb you are investing in. This one is a decision about the
    // whole set, and it costs like one.
    price: { gems: gems(70, 80, 50, 20, 30), gold: 60 },
    tiers: 1,
    effect: { attackScale: 1.5 },
    live: true,
  },
  {
    id: "gear.tank",
    category: "gear",
    name: "Air tank",
    blurb: "Thirty more seconds on the clock. Ten of these, and no more.",
    price: { gems: gems(32), gold: 0 },
    deep: { from: 6, topaz: 3, diamond: 2 },
    tiers: tuning.air.upgradeTiers,
    priceStep: 0.35,
    live: true,
  },
  {
    id: "gear.plate",
    category: "gear",
    name: "Rib plate",
    blurb: "A whole extra health bar. Everything still costs what it costs.",
    price: { gems: gems(38, 25), gold: 0 },
    deep: { from: 2, topaz: 10, diamond: 6 },
    tiers: 3,
    priceStep: 1,
    effect: { healthBars: 1 },
    live: true,
  },
  {
    id: "gear.boots",
    category: "gear",
    name: "Gripped boots",
    blurb:
      "Slide down a wall slower, then not at all. Climb a shaft in your own time.",
    price: { gems: gems(34, 23), gold: 0 },
    deep: { from: 1, topaz: 8, diamond: 5 },
    tiers: 2,
    priceStep: 1.2,
    // A multiplier, not a switch. At zero both levels were identical — you
    // stopped dead the moment you bought the first one and the second sold you
    // nothing, which the ladder test caught. At 0.35 the first level is a slow
    // scrape and the second falls under the floor in `statsFor` and stops.
    effect: { wallSlideScale: 0.35 },
    live: true,
  },
  {
    id: "gear.stride",
    category: "gear",
    name: "Long stride",
    blurb:
      "Walk faster. The cheapest air there is, because you spend less of it.",
    price: { gems: gems(35, 23), gold: 0 },
    deep: { from: 2, topaz: 8, diamond: 5 },
    tiers: 3,
    priceStep: 0.8,
    effect: { walkSpeed: 0.5 },
    live: true,
  },
  {
    id: "gear.scale",
    category: "gear",
    name: "Cinder scale",
    // Deliberately overlapping with the draught, and deliberately slower to get
    // there. The draught is total and lasts thirty seconds; this is partial and
    // lasts forever, and only its last level stops a burn outright. So the
    // draught is what you drink at the mouth of the fire before you can afford
    // the scale, and the scale is what eventually makes the draught something
    // you stop buying — which is what an upgrade is supposed to do to a
    // consumable.
    blurb: "Fire takes less hold each time. At the last level, none at all.",
    price: { gems: gems(0, 28, 26), gold: 0 },
    deep: { from: 2, topaz: 8, diamond: 5 },
    tiers: 3,
    priceStep: 0.9,
    effect: { burnScale: 0.5 },
    live: true,
  },
  {
    id: "gear.lantern",
    category: "gear",
    name: "Hooded lamp",
    blurb: "Throws light well ahead of you. Each level, further and brighter.",
    // The cheapest thing on the shelf, deliberately. What it buys is WARNING,
    // and warning is the thing a new player is short of — an item that only
    // makes sense once you already know the layout would be the wrong item at
    // the wrong price.
    price: { gems: gems(26), gold: 0 },
    deep: { from: 2, topaz: 6, diamond: 4 },
    tiers: 3,
    priceStep: 0.8,
    // Two hundred and forty a level, up from ninety. Ninety was a fifth of a
    // screen — technically more warning and not enough of it to notice you had
    // bought anything. At three levels this now leads most of a screen ahead,
    // which is a different game in the parkour and the fire.
    effect: { sightAhead: 240 },
    live: true,
  },
  {
    id: "gear.antivenom",
    category: "gear",
    name: "Verdigris weave",
    blurb: "Poison takes less hold each time. At the last level, none at all.",
    // Priced under the Cinder scale, deliberately. The poison is the second
    // environment and the fire is the fifth, so this is the plate you can
    // afford when you need it and that one is the plate you work towards.
    price: { gems: gems(0, 30), gold: 0 },
    deep: { from: 2, topaz: 7, diamond: 4 },
    tiers: 3,
    priceStep: 0.9,
    effect: { venomScale: 0.5 },
    live: true,
  },
  {
    id: "gear.aegis",
    category: "gear",
    name: "Aegis plate",
    blurb: "Legendary. Everything that hits you does half what it would.",
    // One tier, and it must stay one tier. Two of these multiply to a quarter
    // and three to an eighth, and at an eighth the health bar stops being a
    // thing the player is playing around — which is the whole game.
    //
    // Priced in the deep stones on purpose: FR-10 says depth is what pays, and
    // this is the clearest statement of it on any shelf. You cannot buy it with
    // anything the first three environments hold.
    price: { gems: gems(0, 0, 0, 32, 28), gold: 0 },
    tiers: 1,
    effect: { damageScale: 0.5 },
    live: true,
  },
  {
    id: "gear.soles",
    category: "gear",
    name: "Padded soles",
    blurb:
      "A pit costs a fraction of what it should. It still costs something.",
    price: { gems: gems(29, 22), gold: 0 },
    deep: { from: 2, topaz: 7, diamond: 4 },
    tiers: 3,
    priceStep: 0.7,
    effect: { pitCostScale: 0.6 },
    live: true,
  },

  // ------------------------------------------------------------- potions
  //
  // Restocked every run rather than upgraded: one of each owned, spent or not.
  {
    id: "potion.restoration",
    category: "potions",
    name: "Restoration",
    blurb: "Press 1. Back to full health, once a run.",
    price: { gems: gems(8, 2), gold: 0 },
    potion: "restoration",
    live: true,
  },
  {
    id: "potion.breath",
    category: "potions",
    name: "Second breath",
    blurb: "Press 2. Ten more seconds on the clock, once a run.",
    price: { gems: gems(14), gold: 0 },
    potion: "breath",
    live: true,
  },
  {
    id: "potion.haste",
    category: "potions",
    name: "Quickstep",
    blurb: "Press 3. Eight seconds at a sprint, whatever you are doing.",
    price: { gems: gems(11, 2), gold: 0 },
    potion: "haste",
    live: true,
  },
  {
    id: "potion.venom",
    category: "potions",
    name: "Etched blade",
    blurb: "Press 4. Double damage for ten seconds.",
    price: { gems: gems(12, 4), gold: 0 },
    potion: "venom",
    live: true,
  },
  {
    id: "potion.ward",
    category: "potions",
    name: "Spike ward",
    // No button. It spends itself on the trap that would have taken you down,
    // which is the moment you would have pressed it anyway — a trap gives half
    // a second to react, which is not enough time to also choose an item.
    blurb: "Spends itself on the next trap. You walk out of that one standing.",
    price: { gems: gems(10, 3), gold: 0 },
    potion: "ward",
    live: true,
  },
  {
    // The Quench draught, which was fire only. Fire and poison run on identical
    // arithmetic — same tick-down, same floor at one bar, same refusal to stack
    // — so two draughts were two buttons for a question the environment had
    // already answered before you walked into it. One thing, both effects.
    id: "potion.milk",
    category: "potions",
    name: "Milk",
    blurb:
      "Press 5. Thirty seconds where fire and poison still hurt but cannot take hold.",
    price: { gems: gems(0, 9, 4), gold: 0 },
    potion: "milk",
    live: true,
  },
  {
    id: "potion.shield",
    category: "potions",
    name: "Ward of stillness",
    blurb: "Press 6. Seven seconds where nothing at all gets through.",
    // The most expensive consumable in the game, and it should be. Everything
    // else on this shelf softens something; this switches the game off, and the
    // price is most of what stops it being the only potion anybody buys.
    price: { gems: gems(0, 0, 10, 5), gold: 60 },
    potion: "shield",
    live: true,
  },
  // Iron skin used to sit here: "spends itself on the next hit you take, that
  // one does nothing". It is gone, and it deserved to go — by the time the
  // shelf had a spike ward that eats a trap and a ward of stillness that eats
  // seven seconds of everything, this was the third item on one page whose
  // whole description was "something does not happen to you", and the weakest
  // of the three. One hit is not a decision; it is a rounding error you paid
  // thirteen emeralds for.
  {
    id: "pet.moth",
    category: "cosmetics",
    name: "Cave moth",
    blurb: "Pale and slow. Follows you down, bumps into things, never learns.",
    price: { gems: gems(), gold: 118 },
    pet: "moth",
    live: true,
  },
  {
    id: "pet.pup",
    category: "cosmetics",
    name: "Cinder pup",
    blurb: "Four legs and a temper. Keeps up, mostly.",
    price: { gems: gems(), gold: 126 },
    pet: "pup",
    live: true,
  },
  {
    id: "pet.rat",
    category: "cosmetics",
    name: "Tank rat",
    blurb:
      "Wears its own little canister. Down here on the same terms you are.",
    price: { gems: gems(), gold: 134 },
    pet: "rat",
    live: true,
  },
  {
    id: "skin.crimson",
    category: "cosmetics",
    name: "Crimson knight",
    blurb:
      "Full plate, crested helm, and a greatsword that does not fit the frame.",
    price: { gems: gems(), gold: 160 },
    skin: "crimson",
    live: true,
  },
  {
    id: "skin.void",
    category: "cosmetics",
    name: "Void shroud",
    blurb:
      "A hood with nothing in it but two lights, and a blade like a needle.",
    price: { gems: gems(0, 2), gold: 190 },
    skin: "void",
    live: true,
  },
  {
    id: "skin.leviathan",
    category: "cosmetics",
    name: "Deep leviathan",
    blurb:
      "Blue-black slab plate, horns, and a cleaver. The heaviest thing down here that is not a wall.",
    price: { gems: gems(0, 3, 1), gold: 220 },
    skin: "leviathan",
    live: true,
  },
  {
    id: "skin.revenant",
    category: "cosmetics",
    name: "The one who came first",
    blurb:
      "Taken off the thing at the bottom. The same coat you are wearing, drowned and gone green.",
    // No price, because it is not for sale. `afford` never sees it — the shop
    // draws it as locked until the run that beats the Revenant says otherwise.
    price: { gems: gems(), gold: 0 },
    skin: "revenant",
    earned: "revenant",
    live: true,
  },
  {
    id: "skin.pale",
    category: "cosmetics",
    name: "Pale knight",
    blurb: "The same plate, bleached. Someone wore this a very long time ago.",
    price: { gems: gems(), gold: 180 },
    skin: "pale",
    live: true,
  },
];

export const CATEGORIES: readonly {
  key: ShopCategory;
  label: string;
  hint: string;
}[] = [
  {
    key: "weapons",
    label: "Weapons",
    hint: "Kill faster. Spend less air fighting.",
  },
  { key: "gear", label: "Gear", hint: "Last longer, and reach further in." },
  { key: "potions", label: "Potions", hint: "One way out of one disaster." },
  {
    key: "cosmetics",
    label: "Cosmetics",
    hint: "No advantage. That is the point.",
  },
];

/**
 * What a player owns and is taking down with them.
 *
 * Part of the RUN, not of the shell: it goes into `createInitialState` and
 * lives in `SimState`, so replaying a run reproduces the loadout it was played
 * with. A loadout applied from outside the reducer would mean the same seed and
 * the same inputs produced different fights, and every replay guarantee in
 * ARCH AD-1 would quietly stop holding.
 */
export type Loadout = {
  /**
   * Item id to the level owned. Absent or zero means not owned.
   *
   * A map rather than a list, because almost everything is a ladder now: the
   * air tank was always ten levels deep and the rest of the weapons and gear
   * shelves have joined it. A list of ids could only say whether you had a
   * honed edge, not whether you had the third one.
   */
  levels: Readonly<Record<string, number>>;
  /** The armour worn. The sim carries it and never reads it. */
  skin: string | null;
  /** The pet at your heels. Also carried and never read. */
  pet: string | null;
};

export const EMPTY_LOADOUT: Loadout = { levels: {}, skin: null, pet: null };

/** How many of a thing is owned. Zero for anything never bought. */
export function levelOf(loadout: Loadout, id: string): number {
  return loadout.levels[id] ?? 0;
}

/** What the next level of a thing costs, or null if it is already maxed. */
export function priceOf(item: ShopItem, level: number): Price | null {
  const tiers = item.tiers ?? 1;
  if (level >= tiers) return null;
  const step = item.priceStep ?? 0;
  const scale = 1 + level * step;
  const gems = item.price.gems.map((n) => Math.round(n * scale));
  // And the deep stones, which do not scale — they ramp, from the level they
  // start at. Added rather than multiplied so a ladder's shallow half is
  // untouched and only its top asks for the fire.
  if (item.deep && level >= item.deep.from) {
    const steps = level - item.deep.from + 1;
    gems[3] = (gems[3] ?? 0) + item.deep.topaz * steps;
    gems[4] = (gems[4] ?? 0) + item.deep.diamond * steps;
  }
  return { gems, gold: Math.round(item.price.gold * scale) };
}

/**
 * The stats a loadout produces: the tuning table plus every effect owned.
 *
 * Derived rather than stored, so the arithmetic happens in exactly one place
 * and a saved loadout can never disagree with the items in it.
 */
export function statsFor(loadout: Loadout) {
  const P = tuning.player;
  const stats = {
    // Widened from the literal types the tuning table gives them, because the
    // legendary blade multiplies all four and the result is not the literal.
    attackDamage: P.attackDamage as number,
    attackReach: P.attackReach as number,
    attackRecovery: P.attackRecovery as number,
    riposteDamage: tuning.parry.riposteDamage as number,
    stunDamage: P.stunDamage as number,
    smashDamage: P.smashDamage as number,
    smashRadius: P.smashRadius,
    healthBars: P.healthBars as number,
    walkSpeed: tuning.movement.walkSpeed,
    climbSpeed: tuning.movement.climbSpeed,
    wallSlideSpeed: tuning.movement.wallSlideSpeed as number,
    pitCostScale: 1,
    burnScale: 1,
    sightAhead: 0,
    venomScale: 1,
    damageScale: 1,
    attackScale: 1,
    maxHp: P.maxHp as number,
    perBar: P.maxHp / P.healthBars,
  };

  for (const item of SHOP) {
    const level = levelOf(loadout, item.id);
    if (!item.effect || level === 0) continue;
    const e = item.effect;
    // Per level, so a ladder actually climbs. Two items touching the same stat
    // add up rather than one silently winning.
    stats.attackDamage += (e.attackDamage ?? 0) * level;
    stats.attackReach += (e.attackReach ?? 0) * level;
    stats.attackRecovery += (e.attackRecovery ?? 0) * level;
    stats.riposteDamage += (e.riposteDamage ?? 0) * level;
    stats.stunDamage += (e.stunDamage ?? 0) * level;
    stats.smashDamage += (e.smashDamage ?? 0) * level;
    stats.smashRadius += (e.smashRadius ?? 0) * level;
    stats.healthBars += (e.healthBars ?? 0) * level;
    stats.walkSpeed += (e.walkSpeed ?? 0) * level;
    stats.climbSpeed += (e.climbSpeed ?? 0) * level;
    stats.sightAhead += (e.sightAhead ?? 0) * level;
    // Repeated multiplication rather than `Math.pow`. The exponent is a small
    // integer, and IEEE 754 specifies multiplication exactly while pow is
    // implementation-defined — two players on different devices must not end up
    // with different wall-slide speeds from the same purchase. The lint rule
    // over `src/config` catches this, and it caught this.
    for (let n = 0; n < level; n++) {
      if (e.wallSlideScale !== undefined)
        stats.wallSlideSpeed *= e.wallSlideScale;
      if (e.pitCostScale !== undefined) stats.pitCostScale *= e.pitCostScale;
      if (e.burnScale !== undefined) stats.burnScale *= e.burnScale;
      if (e.venomScale !== undefined) stats.venomScale *= e.venomScale;
      if (e.damageScale !== undefined) stats.damageScale *= e.damageScale;
      if (e.attackScale !== undefined) stats.attackScale *= e.attackScale;
    }
  }

  // The bar SIZE is fixed and health follows the bar count. That is the whole
  // reason `healthBars` is the stat rather than `maxHp`: a rib plate has to add
  // a bar you can count, not stretch the ones you already had.
  stats.maxHp = stats.perBar * stats.healthBars;
  // A swing cannot recover in negative time, and spikes that heal you would be
  // a very funny bug to ship.
  stats.attackRecovery = Math.max(4, stats.attackRecovery);
  stats.pitCostScale = Math.max(0, stats.pitCostScale);
  // Three levels of 0.5 come to 0.125, which is a burn you would not notice and
  // would still have to watch. Below an eighth it is nothing.
  stats.burnScale = stats.burnScale < 0.2 ? 0 : stats.burnScale;
  stats.venomScale = stats.venomScale < 0.2 ? 0 : stats.venomScale;
  // The multipliers are applied to the flat numbers HERE rather than at the
  // eight places that read them. A percentage that four call sites have to
  // remember to apply is a percentage three of them will get wrong.
  stats.attackDamage = Math.round(stats.attackDamage * stats.attackScale);
  stats.riposteDamage = Math.round(stats.riposteDamage * stats.attackScale);
  stats.stunDamage = Math.round(stats.stunDamage * stats.attackScale);
  stats.smashDamage = Math.round(stats.smashDamage * stats.attackScale);
  // Nothing buys immunity. Half is the legendary plate on its own; anything
  // under a third means the run has stopped being a game about health.
  stats.damageScale = Math.max(0.3, stats.damageScale);
  // Below this a wall slide is a fifth of a pixel a tick, which is hanging
  // still with extra steps. Snapped to zero so the boots can honestly say they
  // stop you rather than "very nearly stop you".
  if (stats.wallSlideSpeed < 0.3) stats.wallSlideSpeed = 0;
  return stats;
}

/** The potions a loadout brings into a run: one of each owned. */
export function potionsFor(loadout: Loadout): string[] {
  return SHOP.filter((i) => i.potion && levelOf(loadout, i.id) > 0).map(
    (i) => i.potion!,
  );
}

export type Purse = { gems: readonly number[]; gold: number };

export type Affordability = {
  affordable: boolean;
  /** Gems still short, by grade. */
  shortBy: readonly number[];
  /** Gold this purchase would spend covering a gem shortfall. */
  goldForGems: number;
  /**
   * True when the only thing stopping the purchase is FR-13.2a: the player has
   * the gold but not the 70% of gems that lets gold count. Worth distinguishing
   * in the UI, because "come back with more gold" and "come back with more
   * gems" are different instructions.
   */
  blockedByThreshold: boolean;
};

/**
 * What one gem of each grade costs in gold, when gold is allowed to stand in
 * for it at all. Climbs steeply, because a grade-5 diamond is a whole run's
 * worth of depth and gold is what you pick up off the floor.
 */
const GOLD_PER_GEM = [6, 14, 34, 80, 190];

/**
 * Can this be bought, and what would it cost?
 *
 * PRD FR-13.2a/13.2b, the anti-pay-to-win guarantee, stated as arithmetic:
 * gold may cover a gem shortfall ONLY once the player already holds 70% of the
 * gems required at that grade. Below the line, gold is worth nothing towards
 * it — so no amount of grinding the easy ground substitutes for going deep.
 *
 * Checked per grade rather than on the total. On the total, a pile of grade-1
 * emeralds would satisfy the threshold for a grade-3 price, which is exactly
 * the substitution the rule exists to prevent.
 */
export function afford(price: Price, purse: Purse): Affordability {
  const threshold = tuning.economy.goldShortfallThreshold;
  const shortBy: number[] = [];
  let goldForGems = 0;
  let blockedByThreshold = false;

  for (let g = 0; g < price.gems.length; g++) {
    const need = price.gems[g] ?? 0;
    const have = purse.gems[g] ?? 0;
    const short = Math.max(0, need - have);
    shortBy.push(short);
    if (short === 0 || need === 0) continue;
    if (have < need * threshold) {
      blockedByThreshold = true;
      continue;
    }
    // The exchange rate. Deliberately poor: gold is the consolation prize for a
    // run that did not go deep, not a second route to the same goods.
    goldForGems += short * GOLD_PER_GEM[g];
  }

  // Every shortfall is either covered by gold or has already set the block, so
  // the whole question reduces to these two.
  const affordable =
    !blockedByThreshold && purse.gold >= price.gold + goldForGems;

  return { affordable, shortBy, goldForGems, blockedByThreshold };
}

/** Spend it. Returns the purse afterwards, or null if it cannot be paid. */
export function pay(price: Price, purse: Purse): Purse | null {
  const check = afford(price, purse);
  if (!check.affordable) return null;
  const gems = purse.gems.map((have, g) =>
    Math.max(0, have - (price.gems[g] ?? 0)),
  );
  return { gems, gold: purse.gold - price.gold - check.goldForGems };
}

/**
 * The loadout a RANKED run is played on.
 *
 * Every weapon and every piece of gear at its top tier, for everybody. A board
 * where the winner is whoever has played longest is a board that measures hours
 * rather than skill, and the shop is a progression system for Story — bringing
 * it into a competitive mode makes the competition about the shop.
 *
 * POTIONS ARE REMOVED ENTIRELY — not maxed, not left as owned. Nobody carries
 * one.
 *
 * Leaving them as the account owned them was the first attempt and it was
 * wrong for the reason the whole mode exists: a player who has bought a
 * restoration goes into the same run with a bar of health more than a player who
 * has not, and the board then measures the shop again, just in a smaller way.
 * Handing everybody a full belt is the other end of the same mistake — it makes
 * every ranked run a potion run and flattens the in-run decision instead.
 * Nobody having any is the only version that is actually equal.
 *
 * COSMETICS stay as they are, which means you play ranked wearing what you
 * already own and nothing else. They change nothing in the simulation — a skin
 * is drawn by the view and a pet does not exist to it — so there is nothing to
 * equalise, and a mode that handed them out would make the shelf pointless.
 *
 * Built from `SHOP` rather than written down, so an item added tomorrow is
 * included the day it is added rather than the day somebody remembers this.
 */
export function rankedLoadout(owned: Loadout): Loadout {
  const levels: Record<string, number> = { ...owned.levels };
  for (const item of SHOP) {
    if (item.id.startsWith("weapon.") || item.id.startsWith("gear.")) {
      // `tiers` absent means a single-purchase item: owning it is level one.
      levels[item.id] = item.tiers ?? 1;
      continue;
    }
    // Every potion off the belt, whether it was bought or not.
    if (item.potion) delete levels[item.id];
  }
  return { levels, skin: owned.skin, pet: owned.pet };
}
