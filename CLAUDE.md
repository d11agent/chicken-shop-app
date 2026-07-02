# CLAUDE.md — Chicken Shop App (Local Shop Business Management)

> Project-specific context. Full spec: [`chicken-shop-app-spec.md`](./chicken-shop-app-spec.md).
> Generic working profile + security protocol: run `/setup`.

## What this is
Offline-first mobile app for small local food shops (primary: chicken shop). Goal is
**mindset shift** — self-employed → business-owner — by *demonstrating* value through
insights (loyal-customer income, gaps), not just record-keeping.

Design north-star: **billing must be as fast as copy-pen**, else the shopkeeper won't use it.

## Tech stack
| Layer | Choice |
|---|---|
| App | React Native (**Expo**) — Android primary, iOS secondary |
| Local store (source of truth) | **WatermelonDB** (SQLite) — offline-first |
| Cloud backup/sync | **Supabase** (Postgres) — secondary layer, background catch-up |
| WhatsApp/SMS | Native `wa.me` / `sms:` intents — **zero API cost, no Twilio in MVP** |
| VCS | GitHub |

**Data path rule:** local write is the source of truth; Supabase syncs in the background.
Never make core actions (billing, udhar entry) depend on internet.

## Non-negotiable domain rules (get these wrong = data integrity bug)
- **Bills:** draft (freely editable) → confirmed (locked). Post-confirm fix = **void + recreate**, never silent edit. Audit trail preserved.
- **Prices:** persistent default price + per-bill override + **frozen price snapshot** on every bill. Past bills never change retroactively.
- **Udhar (credit):** **append-only** transaction history. Current balance = SUM of entries, never a mutable balance field. Partial payments independent of bills.
- **Phone number:** optional for cash/paid bills; **mandatory once any udhar > ₹0** (even partial).
- **Timestamps:** every entry stores date+time. Store **UTC**, display **IST**. Offline entries use device time, corrected on sync.
- **Net profit** = (Cash + Online + Udhar collected) − Raw Material − Wastage − Bad Debt (written-off).
- **Insights:** activate only after **4–5+ visits**; gap threshold is **per-customer self-learning** (own historical avg), not a fixed window.

## Architecture layers (build discipline)
- **Layer 1 (Universal Core)** — build now, validated pain points.
- **Layer 2 (Configurable)** — thresholds (loyal threshold, gap windows) must be **tunable, not hardcoded**.
- **Layer 3 (Shopkeeper-specific)** — future scope, don't build speculatively.

## Out of scope for MVP (don't build)
Multi-staff PIN/login, Twilio automation, recipe-level ingredients, customer-facing app,
gas cylinder tracking, retroactive customer-record merge.

## Workflow (PRIME)
- Plan Mode first on new/external code. `/execute` = PLAN → BUILD → VERIFY → SECURITY → EVOLVE.
- Surgical changes only — no existing flow breaks. **Regression rule: tests green before starting new work.**
- **Model:** Opus for backend/sync/multi-file/financial logic; Sonnet for simple single-file UI.
- **Auto-push rule (do NOT ask):** at every session end / after committing, `git push origin main`
  automatically. Don't wait for Banti to ask. Reason: **EAS builds from GitHub** — unpushed commits mean
  the cloud build uses stale source (this already caused a repeat Kotlin-version build failure). Commit is
  not "done" until it's pushed.

## Security posture (this repo)
- Layer 1 input filter active: `.claude/hooks/security-guard.js` (PreToolUse, matcher `Bash|Write|Edit|Create|PowerShell`). Code-exec patterns gate only Bash/PowerShell; file-writing tools pass through.
- Secrets: `.env*` gitignored; **never** print secrets in chat (terminal/file only, non-cloud-synced).
- Supabase: give MCP/clients **scoped/anon keys + RLS**, never `service_role`/admin.
- `/audit` runs the 5-point security checkpoint (secrets, webhook auth, service-account separation, access control, sensitive data in messages).
- **Messaging rule:** WhatsApp/SMS must never carry raw PIN/password/full financial dumps beyond the customer's own udhar statement.

## Current state
Sessions A + B done (Expo scaffold + WatermelonDB schema; Quick Billing + Menu/Price). EAS dev-build
config in place. See `PROGRESS.md` for the live status, resume point, and dev-build handoff.
