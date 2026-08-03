---
title: "Input reconciliation — product brief vs. PRD"
status: complete
created: 2026-08-04
---

# Reconciliation: `brief.md` → `prd.md`

Finalize step 2. Every commitment in the product brief checked against the PRD and addendum.

## Gaps found and closed during finalize

| Brief commitment | Status before | Action taken |
|---|---|---|
| **Random modifiers** (v1 scope; "double loot, darkness, exploding enemies, faster timer") | **Missing entirely.** Q9 named "the modifier set" but was closed on run length and reshuffle alone | Added **FR-23** with the brief's own examples, tagged `[ASSUMPTION]` pending confirmation |
| **Bosses + Hard Mode** (v1 scope) | Mini-bosses and the final boss were specified; Hard Mode was absent | Added **FR-24**, scaling by enemy verb breadth rather than stat inflation |
| **Free training mode** (v1 scope) | Absent | Added **FR-25**, with no-progression rule so it cannot be farmed |
| **Gear: swords, bows, potions** | Potions specified; weapons/armour never enumerated as shop categories | Added **FR-26** |
| **"Mostly horizontal traversal, ascending near the end"** | Absent — the PRD used "depth" without defining geometry | Added **FR-2.4** |
| **Success criteria: D1 ≥30%, D7 ≥10%** | PRD proposed lower web-stage figures with no reconciliation | Added an explicit reconciliation subsection naming the conflict and recommending brief figures as app-stage targets |
| **"≥40% who finish a first run start a second"** | Absent | Carried into Success Metrics unchanged |
| **Organic sharing measurable** | Absent | Named in Success Metrics as instrument-from-launch |

## Verified as carried through

- Core loop (enter / fight inward / collect / extract / spend / return) — **all six steps** have FRs
- Death penalty: run's loot lost, gear and purchases kept — **FR-21.1**, extended to cover transformation
- Re-traversal solved by shortcuts + skip items — **FR-3**, **FR-12**; strengthened into the win condition (FR-20)
- Fixed layout, shuffled encounters — **FR-18**
- Timer as pressure, difficulty curve and progression gate — **The Timer**, **FR-17**, **FR-19**
- No purchase-exclusive power — **FR-13.2a** (the 70% rule), the strongest form of this commitment in the document
- Purchasable gold accelerates only what could be earned — **FR-13**
- Competitive normalization (PvP fixed loadouts, Endless common baseline) — v2/v3, not foreclosed; **FR-13.4** and **FR-16.5** designed forward
- Server-authoritative economy — **FR-15**, **FR-16**, **NFR-5**
- Web first, native mobile later — **FR-9**, **NFR-4**, and Success Metrics staged accordingly
- Instant play, no install — preserved; no account wall specified before first run
- Mid-range mobile browser performance — **NFR-4.2**

## Qualitative intent the FR structure risks flattening

The rubric warns that FR structure silently drops tone and feel. Three brief statements are
qualitative and load-bearing, and are called out here so downstream work does not lose them:

1. **"The real moat is feel: responsive combat, readable enemies, a satisfying extraction. That is execution, and it cannot be specced — only tuned."** The PRD specifies combat thoroughly, but no requirement can guarantee feel. The provisional-timings note (FR-5) and NFR-1.1 (server-side tuning) exist to keep tuning cheap; that is the mitigation, not a substitute.
2. **"A game people open on their phone for five minutes and lose an hour to."** The 30-second base run and the 6–10 runs-per-session target serve this directly. Worth restating in the UX phase, because the between-run screen is where an hour is either lost or interrupted.
3. **Near-miss pull as the primary retention layer.** The brief names dying 10 seconds from the exit as the core "one more run" reflex. FR-19's deliberately-insufficient tank and FR-13.2a's 70% rule both produce near-miss states structurally. This is the most psychologically potent part of the design and is flagged for ethics in the PRD (near-miss note under the 70% rule).

## Deliberate divergences from the brief

| Divergence | Rationale |
|---|---|
| Brief's D1/D7 targets lowered for the web stage | Browser has no install commitment; brief figures kept as app-stage targets |
| Brief's "≥2% paying conversion" moved to app stage | Confirmed by Crusher: web is a validation stage, interim revenue acceptable |
| Brief describes gems and gold as parallel currencies | PRD makes gems specific (three jobs) and gold generic (shortfall cover only) — a sharpening, not a contradiction |
| Brief lists "shortcut items" as purchasable | PRD makes them potions bought with earned gems, never real money (FR-11.1) — closes a pay-to-skip hole the brief left open |

## Unresolved

**None blocking.** One item carries an `[ASSUMPTION]` tag: the modifier set in FR-23 is
reconstructed from the brief's examples and has not been confirmed in detail by Crusher.
