# Version and reality check — Air Debt v1 spine

**Method:** every named technology checked against the live project or the web, not asserted
from training data.

**Verdict:** the stack is genuinely verified rather than recalled — most of it is installed and
building locally, which is the strongest possible check. Two entries were unpinned and one
CLI is behind.

## Verified against the running project

These are installed and produced a green `next build`, `tsc --noEmit`, `eslint`, and `node --test`
on 2026-08-04:

| Name | Version | How verified |
|---|---|---|
| Node | 24.14.0 | `node --version` |
| Next.js | 16.3.0 | `package.json`, build succeeded |
| React | 19.2.8 | `package.json` |
| PixiJS | 8.19.0 | `npm install pixi.js`, resolved |
| Tailwind CSS | 4.x | scaffolded by `create-next-app` |
| TypeScript | 5.x | `tsc --noEmit` passed |
| Vercel CLI | 51.4.0 | deployed successfully |
| Supabase project | `fdepkajrlzgwrrnioesz`, Tokyo | `supabase projects list`, linked, schema confirmed empty |

## Verified on the web

| Name | Finding |
|---|---|
| `@supabase/supabase-js` | 2.111.0 current. `@supabase/ssr` is the correct App Router pairing per current Supabase docs — `auth-helpers-nextjs` is the superseded package and must not be used |
| `@supabase/ssr` | **0.12.4** current. The spine said "current" rather than a version |

## Findings

- **MEDIUM — `@supabase/ssr` was unpinned.** Listed as "current" in the Stack table. Now pinned to 0.12.4. Note it is pre-1.0, so treat minor bumps as potentially breaking.
- **MEDIUM — neither Supabase package is installed yet.** The Stack table names versions that exist only on paper. Not wrong, but the first story that touches auth or persistence must install them, and the pinned versions should be re-verified at that moment rather than trusted from this document.
- **LOW — Supabase CLI is 2.90.0 locally; 2.111.0 is available.** Not load-bearing — it was sufficient to link the project and read API keys — but worth updating before writing migrations.
- **LOW — Postgres version unstated.** Supabase-managed and not pinned by the spine. Fine at this altitude; the migration story should record the actual major version once known.
- **NIL — no hallucinated technology.** Every named tool exists, is current, and fits its stated role. The Phaser rejection is reasoned rather than fashionable, and the PixiJS-as-view-layer choice is verified against the determinism requirement it serves.
