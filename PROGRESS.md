# PROGRESS — Chicken Shop App

> Session status tracker. **Update this at the END of every session** so the next
> session knows exact status without re-reading everything.
> Full spec: `chicken-shop-app-spec.md` · Project rules: `CLAUDE.md`

_Last updated: 2026-07-01 (Session A complete)_

---

## ✅ Done
- **Shop visit complete** — feature list validated against real operations; spec is confirmed (not speculative).
- **Project config + security bootstrap**
  - `CLAUDE.md` — project context, non-negotiable domain rules, PRIME workflow, security posture
  - `.claude/hooks/security-guard.js` — Layer 1 input filter (Bash/PowerShell code-exec gating, tested: 4 block + 4 allow inc. false-positives)
  - `.claude/settings.json` — hook wiring (matcher `Bash|Write|Edit|Create|PowerShell`)
  - `.gitignore` — secrets (`.env*`, service-account, keys) + Expo/RN artifacts
  - Spec committed (`chicken-shop-app-spec.md`)
- **Session A — Expo scaffold + WatermelonDB schema** ✅
  - Expo SDK **57** (React Native 0.86, React 19.2), TypeScript, scaffolded in-place.
  - WatermelonDB **0.28** configured for offline-first (JSI): `@morrowdigital/watermelondb-expo-plugin`
    + `expo-build-properties` in `app.json`; `@babel/plugin-proposal-decorators` (legacy) in `babel.config.js`;
    `experimentalDecorators` in `tsconfig.json`.
  - Schema v1 (`src/db/schema.ts`) — **9 tables**: the 7 required (`menu_items`, `customers`, `bills`,
    `udhar_entries`, `cash_summary`, `raw_material`, `wastage`) + 2 intrinsic junctions (`bill_line_items`,
    `payment_splits`) needed for frozen price snapshots + mixed payment modes.
  - Models (`src/db/models/*`) with relations; DB wired in `src/db/index.ts`; enums in `src/db/constants.ts`.
  - Helpers: `src/services/currency.ts` (paise) + `src/services/time.ts` (UTC↔IST). Folders: `db/`, `screens/`,
    `components/`, `services/`. `App.tsx` → `DatabaseProvider` → `HomeScreen` (live row-count DB check).
  - **Verify:** `tsc --noEmit` clean · `expo config` resolves both plugins · `expo-doctor` **20/20**.

  **Domain-rule decisions baked into the schema (important for later sessions):**
  - **Money = integer paise** everywhere (never floats). Use `services/currency.ts` to convert at the UI edge.
  - **Timestamps = UTC epoch ms** stored; display via `services/time.ts` (IST). `cash_summary.date_key` = IST `YYYY-MM-DD`.
  - **Udhar = append-only ledger** (`entry_type`: debit/payment/writeoff). Balance = SUM, never a mutable field.
    Deliberately **no `paid_date`/mutable balance column** (task's loose column list was overridden by the
    non-negotiable append-only rule); a payment's `created_at` *is* its paid date. `status` col is a display hint only.
  - **Bills** carry `replaces_bill_id` + `void_reason` + `voided_at` for the void+recreate audit trail; line items
    store `item_name` + `unit_price_snapshot` frozen at bill time.
  - **`cash_summary`** is a recomputable aggregate cache; the ledgers remain source of truth.

## ⏳ Pending (MVP Layer 1 — planned session breakdown)
- [x] **Session A** — Expo scaffold + WatermelonDB schema + data model (foundation, solo) ✅
- [ ] **Session B** — Quick Billing + Menu/Price (draft→confirm→void, frozen price snapshot)
- [ ] **Session C** — Udhar ledger + Payments (append-only, aging flags 15/60 days)
- [ ] **Session D** — WhatsApp/SMS share + retry queue (native intents, pending/sent status)
- [ ] **Session E** — Daily Summary + Raw Material + Wastage tracking
- [ ] **Session F** — Customer Insights (self-learning gaps, loyal-customer income)
- [ ] **Session G** — Supabase background sync/backup (offline-first catch-up, strict review)

## ➡️ Next step
**Session B: Quick Billing + Menu/Price management.**
Model: Opus (financial logic). Start in Plan Mode. Build order: menu-item CRUD + seed real menu →
bill draft (multi-line, per-item qty/amount mode) → confirm (lock + freeze snapshots + write payment_splits +
udhar debit entry) → void+recreate. Enforce: phone mandatory once any udhar split > 0. All money in paise.

## ⚠️ Resume gotchas (Session A → B)
- **WatermelonDB needs a DEV BUILD, not Expo Go.** JSI native module isn't in Expo Go. To actually run the DB:
  `npx expo prebuild` then `npx expo run:android` (local), or `eas build --profile development`. `expo start` alone
  (Expo Go) will crash on DB init. `tsc`/`expo config`/`expo-doctor` all pass without a build — that's the CI bar for now.
- **Babel decorators pinned to `^7`** (Expo is on Babel 7; the `@8` plugin errors on peer `@babel/core@8`). Don't bump.
- **App id `com.chickenshop.app`** is a placeholder — change before any store submission.
- **No seed data yet** — menu items table is empty. Session B seeds real menu + pricing (still to be captured from shop).
- No Supabase config yet (deferred to Session G); offline-first local DB is fully standalone until then.

## 📌 Open questions / notes
- Security hook activates only after Claude Code **restart** (hooks load at session start).
- Shop visit done — spec validated against real operations. Confirmed menu items + pricing to be captured in config during Session B (seed data).
- `EAS`/`eas.json` not created yet — will add when first dev build is needed (Session B/C).
