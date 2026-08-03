---
title: "PRD Quality Review — Dungeon Master v1"
status: complete
created: 2026-08-04
---

# PRD Quality Review — Dungeon Master (working title) v1

Reviewed against the PRD quality rubric. Run inline during Finalize.

## Overall verdict

This PRD is unusually strong on **strategic coherence** and **decision-readiness** — it has a
real thesis (the timer degrades decision quality, and combat is where that damage lands), and
almost every requirement can be traced back to it. The economy is the standout: the 70% rule
converts an unfalsifiable "not pay-to-win" promise into checkable arithmetic, and the time
budget is solved to the second rather than gestured at. The main risks are **done-ness on the
qualitative half of combat** (feel cannot be specified and the PRD knows it, but downstream
stories will still need acceptance criteria) and a **thin enemy roster** relative to a design
whose difficulty axis is enemy verb breadth.

## Decision-readiness — **strong**

Decisions are stated as decisions and their costs are named. Several places explicitly record
what was given up: full server simulation rejected on recurring cost (Run Validation), universal
timing accepted at the price of tuning to the weakest surface (FR-9.5/9.6), Passage skipping
mini-bosses accepted as the price of not walling players (FR-12.6). The Open Items table is a
genuine audit trail rather than decoration — 47 items raised, each closed with the requirement
that closed it.

Trade-offs are not smoothed. The PRD states plainly that the maximum air tank is *deliberately
insufficient*, that the boss *inverts* the timer thesis, and that the 70% rule *monetizes the
near-miss*. That last one is the test case: a weaker PRD would have omitted it.

### Findings
- **low** Open Items table is now entirely struck through (§ Open Items) — it reads as history rather than a live register. *Fix:* acceptable for a finalized PRD; downstream phases should open their own.

## Substance over theater — **strong**

No persona theater — one user journey, one named protagonist, and it is load-bearing rather than
decorative: UJ-1 is cited in four separate sections as evidence. No innovation theater — the
"What makes this different" framing is inherited from the brief, which is honest that the
differentiation is combination and execution, not novelty.

NFRs are product-specific with real thresholds rather than boilerplate: NFR-5.2 names a retention
policy, NFR-2 is justified by three named dependencies, NFR-3.3 identifies a concrete licensing
risk rather than saying "assets must be licensed."

### Findings
- **low** NFR-4.1 ("small enough for a browser player to start quickly") is the one adjective-bound requirement (§ NFR-4). *Fix:* set a byte budget or a time-to-first-input target during architecture.

## Strategic coherence — **strong**

The thesis is explicit and the features follow it. The clearest evidence is that three
independently-motivated requirements converge on the same conclusion: FR-9.5 (device parity),
FR-15.7 (replay validation) and hitbox authoring all require NFR-2's deterministic simulation.
That is a sign the design is genuinely unified rather than assembled.

The strongest single piece of coherence is the time economy: shortcuts, Passage, exits and the
air tank all trade in seconds, and FR-20's arithmetic ties them into one solvable budget. The
second is the lever rule becoming the win condition — a constraint written for anti-exploit
reasons turning out to be the progression spine.

Success Metrics validate the thesis rather than measuring activity, and seven counter-metrics are
named, including one (session length rising while runs-per-session falls) that guards against the
specific incentive web portals create.

### Findings
- **medium** The brief names **distribution as the top risk** and calls it harder than any technical problem. The PRD touches it only through the organic-sharing metric (§ Success Metrics). *Fix:* out of scope for a v1 product PRD, but it should not stay unowned — it belongs in a go-to-market plan before launch.

## Done-ness clarity — **adequate**

Most FRs carry testable consequences. Timing values are numeric (FR-5.7, FR-5.9, FR-19), the time
budget is arithmetic (FR-20), and the validation model specifies who computes what (FR-15.6).

The gap is the qualitative half of combat. "Responsive," "readable," and "satisfying" are the
brief's own words for the differentiator, and they cannot be specified. The PRD handles this
honestly — provisional timings, server-side tuning — but downstream story creation will still
need acceptance criteria for combat feel, and this document does not supply them.

### Findings
- **high** **Enemy roster is three entries** (goblin, corrupt archer, an unnamed late monster) for a game whose difficulty axis is enemy verb breadth across five environments (§ FR-7). *Fix:* a roster pass belongs in the epics/stories phase — at minimum, which verbs each environment's enemies hold, and five mini-boss concepts.
- **high** **No acceptance criteria for combat feel** (§ FR-5, FR-6). *Fix:* define measurable proxies during architecture — input-to-response latency budget, frames of animation before a hitbox activates, a target parry success rate for a competent player in playtest.
- **medium** **FR-14.2/14.4 do not say how many grades exist.** Gem grades are referenced as 1..n throughout with n never fixed (§ Loot, § FR-14). *Fix:* set the grade count before economy tuning; it determines recipe space.
- **medium** **Boss and mini-boss designs are unspecified** beyond duration and stun-immunity (§ FR-8, FR-19.4). *Fix:* content work for epics.
- **low** FR-23's modifier set is `[ASSUMPTION]`-tagged and unconfirmed (§ FR-23).

## Scope honesty — **strong**

Omissions are explicit rather than inferred. v2/v3 boundaries are marked inline where they bite
(FR-13.4, FR-16.5, FR-24's Nightmare note). Accepted gaps are stated as accepted: bots are named
as an unhandled threat with the reasoning for why that is tolerable (§ Run Validation), and the
air economy is stated to terminate.

The PM's own error is recorded rather than hidden — the reconciliation file notes that Q9 was
closed without specifying modifiers, and FR-23 was added during finalize to fix it.

### Findings
- **low** No dedicated Non-Goals section (§ *absent*). *Fix:* the scope header plus inline v2/v3 markers cover it adequately for this document's size; not worth adding.

## Downstream usability — **adequate**

Cross-references resolve and IDs are unique. The numbering policy is stated up front, which is
the right call after two renumbers — but it means IDs do not run in document order (FR-17 and
FR-19 appear in The Timer, FR-23 in Dungeon Structure, FR-26 before FR-14). A reader following
sequence will be confused; a reader following sections will not.

### Findings
- **medium** **No glossary** (§ *absent*). Terms like *frontier*, *known ground*, *run intent*, *Passage*, *lever*, *grade*, *environment*, *bag* carry precise meanings established across different sections. UX and architecture will source-extract these. *Fix:* add a short glossary before the UX phase.
- **low** ID ordering does not match document order (§ noted in the header). *Fix:* documented and intentional; leave it.
- **low** Only one user journey. For a consumer product this is thin — a second journey covering a new player's first three runs would exercise onboarding, which is where two Success Metrics targets sit (reaching environment 2, levering a first shortcut).

## Shape fit — **strong**

Correct shape for a consumer product: user journey with a named protagonist, capability-level
requirements with technical depth pushed to `addendum.md`, and rigor calibrated to commercial
stakes. Game-specific sections (Run Intent, the time budget, the reshuffle) were invented rather
than forced into a generic template, which is what the method asks for.

Not over-formalized. The PRD runs long, but the length is FR density and worked arithmetic, not
padding.

## Mechanical notes

- **Glossary:** absent — flagged above as the main downstream gap.
- **ID continuity:** FR-1 through FR-26 present, no duplicates, no gaps. Sub-IDs occasionally use letter suffixes (FR-13.2a, FR-13.3a, FR-11.1a) where requirements were inserted; unambiguous but slightly untidy.
- **Cross-references:** spot-checked; all resolve to existing IDs.
- **Assumptions index:** one `[ASSUMPTION]` tag inline (FR-23), no index section. At a count of one, an index is unnecessary.
- **UJ protagonists:** UJ-1 has a named protagonist (Maya, 24) with context carried inline. No floating UJs.
- **Open items:** 47 raised, 47 closed.

## Recommended before the next phase

1. **Glossary** — cheapest fix with the largest downstream payoff.
2. **Enemy roster and verb table per environment** — the difficulty axis has no content behind it.
3. **Combat-feel acceptance proxies** — during architecture, while the simulation is being designed.
4. **Confirm the FR-23 modifier set** — one conversation.
