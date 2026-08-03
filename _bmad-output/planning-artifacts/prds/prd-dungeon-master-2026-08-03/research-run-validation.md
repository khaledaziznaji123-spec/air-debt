---
title: "Research digest: server-authoritative run validation and anti-cheat"
status: reference
created: 2026-08-03
---

# Research: server-authoritative run validation

Web research digest gathered during PRD discovery. Reference material — not decisions.
Addresses the brief's hard constraint: currency is purchasable with real money, so a
client that self-reports loot is a theft vector.

## Architectural options

| Approach | Build cost (solo dev) | Latency / UX | Guarantee | Fails to catch |
|---|---|---|---|---|
| **Full server simulation** (client = view) | Very high. Needs a stateful realtime process (WebSocket + tick loop) — Supabase Edge Functions and Vercel serverless are stateless and short-lived, so this means a separate always-on host. Combat feel then needs prediction + reconciliation on top. | 50–150ms input lag unless you also build client prediction; rollback is a second engine's worth of work | Strongest. Kills speedhacks, teleport, dupes, injected damage outright | Bots/automation (inputs are legit, the player isn't), input-timing macros, aimbot-equivalents |
| **Deterministic replay validation** (client submits seed + input log; server re-simulates) | Medium-high. Requires one engine that runs in browser *and* Node/Deno, plus strict determinism discipline | Zero in-run latency. Validation is async — pay out after a short "verifying" step, or optimistically then reconcile | Strong *if* determinism holds. Bit-exact reproduction of the run | Bot-generated input logs (a script can produce a valid winning replay); determinism drift becomes a false positive that eats real players' loot |
| **Bounded plausibility / heuristics** | Low. Server checks reported result against server-known caps: run wall-clock (server timestamps start and end), max reachable depth for the player's server-side gear, max gold per encounter, encounter table for that seed | None | Weak but useful. Caps the *magnitude* of theft rather than preventing it | Anything inside the envelope — a client claiming a plausible-but-fake perfect run, repeated forever |
| **Periodic checkpoints** | Low-medium. Client posts signed progress every N seconds; server validates monotonic depth, elapsed time, rejects impossible jumps | One small request per checkpoint; can be fire-and-forget | Medium. Forces a cheater to fake a *time-consistent* run in real time — removes the "instant 5000 gold" attack and caps throughput to real-time | Slow, patient forgery; a bot replaying a real run's checkpoint cadence |

## What real products do

- **Roblox** is the closest analogue (UGC games, real-money currency). Official guidance: treat every RemoteEvent as hostile; all currency/damage/inventory logic lives on the server. https://create.roblox.com/docs/scripting/security/security-tactics
- **Skillz** (real cash prizes, mobile) uses an authoritative game server for realtime modes plus tournament-wide identical seeded conditions and gameplay monitoring. https://docs.skillz.com/docs/anti-cheating-techniques-overview/
- **Open Hexagon** — best-documented small-team replay-validation build. Input-log replays re-simulated server-side; server-recorded start/end timestamps catch time manipulation; RNG state polluted with visual properties so file edits invalidate the replay. Determinism cost them real pain: `-ffast-math` desynced replays, stdlib RNG wasn't portable. https://vittorioromeo.com/index/blog/oh_secure_leaderboards.html
- **Counterexample**: FarmVille-era Flash social games kept economy state client-side and were mass-farmed with Cheat Engine. That is precisely our v1 failure mode.
- Academic: Bethea et al., *Server-side Verification of Client Behavior in Online Games* (NDSS) — probabilistic audit where the client commits state hashes and must produce the trace on challenge. https://www.ndss-symposium.org/wp-content/uploads/2017/09/beth.pdf

## Determinism in JavaScript — practical, with rules

It works, but only under discipline:

- **`Math.random()` is unseedable and V8-implementation-specific.** Replace with a seeded PRNG (mulberry32, PCG, or `seedrandom`) fed a **server-issued seed**. https://v8.dev/blog/math-random · https://github.com/davidbau/seedrandom
- **Transcendentals (`Math.sin/cos/pow/exp`) are explicitly implementation-defined and differ by OS** — V8 delegates to the host libm. Use lookup tables or fixed-point implementations, or keep them out of simulation. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math · https://scrapfly.dev/posts/browser-math-os-fingerprint/
- Plain `+ - * /` on doubles **is** IEEE-754 deterministic in JS. The dangers are math library calls, iteration order (`Map`/`Set` insertion order matters), and variable timestep. Use a fixed timestep and integer/Q16.16 fixed-point for anything accumulating. https://gafferongames.com/post/floating_point_determinism/
- **If physics is needed, use Rapier** — its WASM/JS build advertises full cross-platform determinism given the same version, same construction order, and no transcendentals in initialization. Matter.js and Arcade physics make no such promise. https://rapier.rs/docs/user_guides/javascript/determinism/

## Mitigations short of full authority

Server-issued run seed → signed run token (HMAC/JWT, short TTL, single-use nonce) → server records start time → checkpoints → server-computed reward. Add per-user rate limits (Upstash Redis is the documented Supabase pattern), idempotency keys on every award, and statistical alerting on gold/hour, win rate, and depth-per-second z-scores. **Replay sampling**: store input logs for all runs, re-simulate a random 2–5% plus every top-percentile run. https://supabase.com/docs/guides/functions/examples/rate-limiting

## Supabase specifics

- Currency tables: **RLS deny-all for the client** — no client-side insert or update on balances, ever. Awards happen only via Edge Function using `service_role`, or a `SECURITY DEFINER` Postgres function.
- Do the whole award in **one Postgres RPC** so it is atomic. Edge Functions cannot span a transaction across multiple PostgREST calls. https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html
- `verify_jwt` is not on by default in every path — Edge Functions can be publicly invokable. Verify explicitly. https://www.guardlayer.io/blog/supabase-edge-function-auth
- Append-only `ledger` table (user, delta, reason, run_id, nonce) with a unique constraint on `run_id`; balance is a materialized sum. Duplicates become constraint violations rather than silent theft.

## Recommendation offered by the research (not yet a decision)

Ship **checkpointed + plausibility-bounded, with replay capture from day one**:

1. `POST /run/start` → server generates the seed, writes a `runs` row (`server_started_at`), returns a signed run token. The client **never** picks the seed.
2. Client streams lightweight checkpoints (depth, elapsed, encounter index) signed with the run token.
3. `POST /run/end` submits the full input log. Server validates elapsed wall-clock against claimed duration, depth against server-known gear, gold against the seed's encounter table — then computes the reward itself. The client's claimed gold is ignored entirely; it is a display value.
4. Store the input log regardless. Not re-simulating yet, but accruing the corpus.

A few days of work; closes the "I earned 5000 gold" hole immediately; is exactly the substrate replay validation later needs.

**Architectural consequence worth carrying into the architecture phase:** write the simulation once as an isomorphic, dependency-light TS module — fixed timestep, seeded PRNG, no `Math.sin`/`Date.now()`/`performance.now()` inside the sim, deterministic iteration order — with the renderer merely drawing it. Then "turn on replay validation" becomes a Deno import plus a sampling job rather than a rewrite. **This constrains the renderer choice**: PixiJS as a pure view layer preserves it cleanly; Phaser with Arcade physics tempts simulation state into the engine, which forecloses it.
