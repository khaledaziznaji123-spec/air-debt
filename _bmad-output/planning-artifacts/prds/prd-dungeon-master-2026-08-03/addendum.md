---
title: "PRD Addendum: Air Debt — v1"
status: draft
created: 2026-08-03
updated: 2026-08-03
---

# PRD Addendum — Air Debt v1

Depth that belongs downstream of the PRD: mechanism, technical-how, sourcing options, and
rejected alternatives. The PRD states *what must be true*; this states *how it might be done*
and what was considered. Nothing here is a decision unless the memlog says so.

---

## Hitboxes and combat authoring

### The model

2D action combat is conventionally authored with **three separate volume types**, kept
distinct from the sprite itself:

| Volume | Belongs to | Meaning |
|---|---|---|
| **Hurtbox** | The character | Where this character can be hit |
| **Hitbox** | An attack | Where this attack deals damage, while active |
| **Pushbox** | The character | Physical collision — stops characters overlapping |

Keeping these separate is what makes combat feel fair. A sprite's drawn silhouette is a poor
hurtbox — animation stretches, weapons extend far past the body, and a player hit by a visual
flourish reads it as a cheat. Volumes are authored deliberately, usually smaller than the art.

**Shape:** axis-aligned rectangles (AABB) are sufficient and are what most 2D action games
ship. They are cheap, they are trivially deterministic, and they are easy to author and debug.
Circles are an occasional alternative for projectiles. Polygon or per-pixel collision is not
warranted here and costs determinism and authoring time.

### Attacks are frame windows, not events

Every attack is a timeline divided into three phases, authored in **simulation ticks**
(NFR-2.2):

```
startup  →  active  →  recovery
(wind-up)   (hitbox    (vulnerable,
             is live)   cannot act)
```

This maps directly onto combat decisions already in the PRD:

- **Stun attack (FR-5.6)** — "longer wind-up" is a longer *startup* phase. That is the whole cost of the move, expressed in one number.
- **Mistimed block (FR-5.9)** — the ~0.4s lockout is a *recovery* phase on the block action.
- **Parry window (FR-5.7)** — a short *active* phase on the block action. A parry is a hitbox-vs-parrybox overlap during that window.
- **Combo cancel (FR-5.10)** — the rule that slide or block may interrupt the current action before its recovery phase completes.

The practical consequence is that the entire combat feel of this game reduces to a table of
tick counts per action. That table is exactly what NFR-1.1 says must be server-tunable, and it
is the thing playtest will iterate on hardest.

### Authoring and tooling

- **Author volumes as data, per animation** — a JSON file per character listing, for each action, its phase boundaries and the boxes active in each. Never hardcode boxes in game code.
- **Aseprite slices** are the common pipeline for this: draw the boxes on the sprite timeline, export slice data, consume it as the hitbox file. Works well, cheap, and keeps art and hitboxes in one place for the artist.
- **A runtime debug overlay is close to mandatory.** A key that draws every active hurtbox, hitbox and phase label on screen. For a game whose defining skill is a 0.3-second read, "why did that hit me" must be answerable in one keypress, not by reasoning.
- **A frame-step / slow-motion debug mode** pays for itself the first time a parry window is tuned.

### Why this matters for the renderer choice

**Decided: PixiJS as a pure view layer** (NFR-5.3). The hitbox model was one of the arguments —
collision, timing and state live in a plain TypeScript module, and the renderer draws what the
simulation says. That preserves NFR-2 and keeps deterministic run validation reachable. An
engine's built-in physics and animation-driven collision pulls simulation state into the engine
and closes that door, which is why Phaser with Arcade physics was rejected. The architecture
phase still owns the module boundaries; the constraint is settled.

---

## Art sourcing

### The three realistic paths

| Path | Cost | Speed | Fit for this project |
|---|---|---|---|
| **Free / CC0 asset packs** | None | Immediate | Right answer for prototyping. Wrong answer for ship. |
| **Paid asset packs** | Low | Immediate | Better looking, but shared with every other game that bought them — and usually cannot be resold as cosmetics |
| **Commissioned artist** | Real money | Weeks | The only path compatible with a cosmetics-primary business model |

### Recommended sequence

1. **Prototype on CC0 packs.** Kenney (kenney.nl) is CC0 — public domain, no attribution required, genuinely unencumbered. itch.io and OpenGameArt have large free 2D action libraries. Enough to test the loop, tune the timings, and find out whether the game is fun before spending anything.
2. **Keep art swappable from the start** (NFR-3.1). Do not bake sprite dimensions into game logic or design encounters around a specific pack's proportions. The cost of swapping art later is entirely determined by decisions made now.
3. **Commission once the loop is proven.** Fiverr, Upwork, ArtStation and the r/gameDevClassifieds / pixel-art communities are the usual sources. A defined style guide and a fixed sprite specification make commissioning far cheaper — which is another reason to settle proportions during the placeholder phase.

### The licensing trap worth naming twice

The business model makes cosmetics the primary revenue line. **Most asset-pack licenses —
free and paid — permit use inside a game but prohibit selling the assets as a product.** A
skin is uncomfortably close to selling the art itself. Kenney's CC0 is the notable exception
with no such restriction, which is a strong argument for standing on CC0 during the phase
where the line between placeholder and product is blurriest.

The practical rule: **anything that will ever appear in the store must be owned outright.**
Track it in the asset manifest (NFR-3.2) from the first commit, because reconstructing asset
provenance a year later is miserable and is exactly when it gets asked about.

---

## Audio sourcing

Audio is cheaper and lower-risk than art, and there is more genuinely free material.

**Sound effects**

- **Sonniss GDC bundles** — huge professional royalty-free libraries, released annually and free. The single best starting point.
- **Kenney audio packs** — CC0, game-shaped, immediately usable.
- **Freesound.org** — enormous, but licenses vary per file (CC0, CC-BY, CC-BY-NC). NC files are unusable for a commercial F2P game. Check per file, record per file.
- **ZapSplat / Soundsnap** — subscription libraries, straightforward commercial terms.

**Music**

- Royalty-free libraries for placeholder.
- Commission for ship. Game music commissions are markedly cheaper than art, and a distinct soundtrack does disproportionate work for identity — especially for a game whose atmosphere is a virus-saturated dungeon and a depleting air supply.

**Audio in the browser, specifically**

- Keep total audio weight low (NFR-4.1). Compressed OGG/WebM, short loops, shared one-shots.
- Web Audio API directly, or a small wrapper. Precise scheduling matters if audio cues are ever tied to combat timing — and given a 0.3-second parry, an audio tell for an incoming attack is a likely accessibility and readability feature.
- Browsers block audio until a user gesture. Plan the first-interaction unlock rather than discovering it in playtest.

### One design note that belongs here

The oxygen timer is the game's central pressure and it is currently a **visual** system —
a number and a vignette (FR-1.1, FR-1.2). Audio is the natural second channel for it:
breathing that shortens, a mask hiss, a heartbeat under the final seconds. That is
low-cost, extremely effective, and it supports the "felt continuously, not merely checked"
requirement better than any UI treatment can. Raised as an option for the UX phase.

---

## Live iteration — practical notes

The stated method is to ship online early and add and remove content continuously. Two
practices make that safe, both downstream of NFR-1:

- **Config as data, versioned.** Tuning tables (tick counts, drop rates, prices, gem requirements) served from the backend and versioned, so a bad tuning change can be rolled back without a deploy, and so a run can record which config version it was played under.
- **Content flags rather than deletion.** Retiring an item by disabling it — rather than removing its record — preserves the accounts that own it (NFR-1.2) and keeps historical runs interpretable.

Both are cheap now and expensive to retrofit after real accounts exist.
