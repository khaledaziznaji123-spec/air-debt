# Adversarial seam review — Air Debt v1 spine

**Method:** construct two units one level down that each obey every `AD` to the letter and
still build incompatibly. Every such pair is a hole.

**Verdict:** the core simulation contract is tight — AD-1 through AD-7 leave little room to
diverge. The seams are all at the **shell/persistence boundary**, where several entities have
no named owner. Six pairs found; five are real.

---

## CRITICAL — 1. Replays are versioned against tuning but not against the simulation

AD-12 requires every run to record the tuning version it was played under, so a replay is
re-simulated against the numbers that were live. Nothing records the **simulation version**.

**The incompatible pair:** Unit A ships a bug fix to parry resolution. Unit B, months later,
re-simulates a stored run from before the fix. Both obey every AD. The replay diverges from
the original run, the run is flagged as forged, and a real player loses banked loot.

This defeats the exact purpose of FR-15.7, and it fails silently — the corpus rots invisibly
as the sim evolves.

**Fix:** a new AD pinning a simulation version into every run record, with the rule that
replay validation only compares runs whose sim version matches the validator, and that any
change to core resolution bumps it.

---

## HIGH — 2. Two write paths to the `runs` table

AD-8 puts server logic in route handlers. AD-9 requires every **economy** mutation to be a
single Postgres function. The `runs` table is not economy, so it falls between them.

**The incompatible pair:** Unit A inserts the run row directly with the service role at
`/api/run/start`. Unit B awards at `/api/run/end` through the RPC, which also touches the run
row to mark it settled. Two writers, no single owner, and the settle-vs-insert race is real
once retries exist.

**Fix:** name the owner. The run row is created by the handler and mutated only by the award
RPC thereafter.

---

## HIGH — 3. The input vocabulary has no owner

AD-6 says the shell translates device events into abstract intents. It does not say **where
the intent set is defined.**

**The incompatible pair:** `src/render` defines an intent enum for live play. `src/app/api/run`
defines its own for replay validation. Both obey AD-6. They drift by one member, and every
replay containing that intent mis-validates.

**Fix:** the core owns its own input vocabulary. Intents are defined in `src/sim` and imported
by every shell that produces or consumes them.

---

## HIGH — 4. "Depth" is undefined across the checkpoint boundary

FR-15.3 has the client posting depth in checkpoints and FR-15.4 has the server rejecting
impossible progress. The spine never fixes what depth *is*.

**The incompatible pair:** the sim tracks position in world units; the checkpoint API reports
environment index. The server's plausibility bound compares one against the other and either
rejects honest runs or accepts absurd ones. Both units are compliant.

**Fix:** a convention naming the canonical progress unit, used identically by sim, checkpoint
payload, and validation.

---

## MEDIUM — 5. Anonymous players have no identity contract

AD-10 keys the ledger by user. AD-18's note requires play with no account wall. Nothing says
what a user id *is* before an account exists.

**The incompatible pair:** Unit A mints a shadow user row per anonymous session. Unit B keys
progress by a device-local id and reconciles at signup. Both are defensible; only one can be
right, and the other silently loses progress at account linking.

**Fix:** decide now or state it under Deferred with the constraint that whatever is chosen must
survive linking. Deferring is acceptable; leaving it unnamed is not.

---

## LOW — 6. Content identity: slug or row id?

Conventions specify stable string slugs for content; AD-16 has the core dealing in entity
identifiers. If those are the same string, the join is obvious. If content rows also carry a
uuid, two units will pick different join keys.

**Fix:** one line in conventions stating the slug is the join key and the core never sees a
row id.

---

## Not a hole

**Deferred ECS.** Two units building different internal styles inside `src/sim` is mess, not
incompatibility — the reducer contract (AD-1) holds either way. Fine to defer, though it gets
more expensive the longer the core grows.
