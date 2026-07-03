# PROGRESS — Chicken Shop App

> Session status tracker. **Update this at the END of every session** so the next
> session knows exact status without re-reading everything.
> Full spec: `chicken-shop-app-spec.md` · Project rules: `CLAUDE.md`

_Last updated: 2026-07-01 (Session B complete)_

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

- **Session B — Quick Billing + Menu/Price** ✅
  - **Test infra:** `jest-expo` set up (+ `@react-native/jest-preset`, `babel-preset-expo`, `.npmrc`
    `legacy-peer-deps=true`). `npm test` → **19 tests green**. This is now the regression bar.
  - **Pure financial core** (`src/services/billing/calc.ts`, fully unit-tested): `computeLineTotal`
    (qty = round(qty×unitPrice), amount = as-is), `computeBillTotal`, split sum/validation,
    `requiresPhone` (udhar>0), `udharBalance` (signed sum). No DB → trivially testable.
  - **Services** (DB orchestration, WatermelonDB `write()` transactions):
    - `menu/menuService.ts` + `menu/seed.ts` — CRUD, soft active-toggle, idempotent `seedMenuIfEmpty()`
      with a **placeholder** chicken-shop menu (real prices still TBD; shopkeeper edits in-app).
    - `customer/customerService.ts` — create/update, phone normalisation.
    - `billing/billService.ts` — `createDraftBill` → `setDraftLines`/`addLineToDraft` → `confirmBill`
      (validates, locks, writes `payment_splits`, appends udhar **debit** if credit>0; atomic — bad
      validation aborts the txn) → `voidBill` (append **`void_reversal`** to cancel the debit, never
      mutate/delete) → `recreateBill`/`voidAndRecreate` (fresh draft, copies frozen snapshots,
      sets `replaces_bill_id`).
  - **New enum value `void_reversal`** + `UDHAR_SIGN` map in `constants.ts` (value-only, no migration).
  - **UI** (React Navigation native-stack): `HomeScreen` (hub + seeds menu on launch), `MenuScreen`
    (list + add/edit price + active toggle), `BillingScreen` (menu-chip picker → local cart for
    copy-pen speed → per-line qty/amount + price override → cash/online/udhar splits → phone-required
    guard → confirm persists+locks), `BillsScreen` (reactive list + status badges), `BillDetailScreen`
    (items/splits + Void & Recreate / Void only). Reactive via `hooks/useObservedQuery.ts`.
  - **Verify:** `tsc --noEmit` clean · `jest` **19/19** · `expo-doctor` **20/20**.
  - **Note:** billing UI builds the cart in local React state (speed), persisting only on confirm; the
    service layer still fully supports incremental *persisted* drafts (used by void+recreate).

## ⏳ Pending (MVP Layer 1 — planned session breakdown)
- [x] **Session A** — Expo scaffold + WatermelonDB schema + data model (foundation, solo) ✅
- [x] **Session B** — Quick Billing + Menu/Price (draft→confirm→void, frozen price snapshot) ✅
- [ ] **Session C** — Udhar ledger + Payments (append-only, aging flags 15/60 days)
- [ ] **Session D** — WhatsApp/SMS share + retry queue (native intents, pending/sent status)
- [ ] **Session E** — Daily Summary + Raw Material + Wastage tracking
- [ ] **Session F** — Customer Insights (self-learning gaps, loyal-customer income)
- [ ] **Session G** — Supabase background sync/backup (offline-first catch-up, strict review)

## ✅ Dev build GREEN (2026-07-03)
First successful EAS dev build after fixing the real blocker (WatermelonDB `JSIModulePackage` on
New Arch — see gotchas). Build `f0966a28`, status **FINISHED**, `development` profile, Android APK:
- Install page / QR: https://expo.dev/accounts/ps140888/projects/chicken-shop-app/builds/f0966a28-1c23-4b26-8df8-1d3821e79860
- Direct APK: https://expo.dev/artifacts/eas/HaEFMcmg8urMrtWMp7ABBN4UBr8NbK186DoMu66Z-GQ.apk

**Next:** install on an Android phone, run `npx expo start --dev-client`, then run the billing
smoke-test checklist below. This is the FIRST time the DB/UI runs on a device — watch DB init.

## 🔧 Dev build + smoke test (set up — needs Banti to run interactive steps)
Local Android toolchain is **absent on this machine** (no Java/SDK/emulator), so `expo run:android`
won't work here. Path = **EAS cloud build** (`eas-cli` 20.3.0 is installed).
- Added: `eas.json` (development/preview/production profiles), `expo-dev-client`, `expo-system-ui`.
- **Validated locally:** `expo prebuild --platform android` succeeds and the WatermelonDB config plugin
  wires JSI natively (`:watermelondb-jsi` gradle module + `WatermelonDBJSIPackage` in MainApplication +
  proguard keep-rule). The generated `android/` was then removed — we stay managed/CNG; **EAS regenerates
  it at build time**. (`/android` + `/ios` are gitignored.)

**Banti — run these to get it on a phone (one-time):**
```
eas login                                             # Expo account (free; sign up at expo.dev)
eas init                                              # links project, writes projectId into app.json
eas build --profile development --platform android    # cloud build -> install URL + QR for the APK
# install the dev-client APK on an Android phone, then:
npx expo start --dev-client                           # scan QR from the dev client -> app loads (DB works)
```
Prefer a no-dev-server click-test? `eas build --profile preview --platform android` gives a standalone APK.

**Smoke-test checklist (billing golden path):** launch → default menu seeds → Menu: edit a price →
New Bill: add a qty line (kg×₹) + an amount line (₹) → split cash/online/udhar → confirm with udhar but
**no phone** (should block) → add phone → confirm → Bills list shows it → open → Void & Recreate → edit →
confirm again (new bill should reference the voided one).

## ➡️ Next step
**Session C: Udhar ledger + Payments.**
Model: Opus (financial logic). Build: customer udhar statement screen (append-only history + running
balance via `udharBalance`), record **partial payments** (append `payment` entry, independent of bills),
aging flags (15+ yellow / 60+ red from oldest unsettled debit), bad-debt **write-off** (append `writeoff`,
counts as loss). The ledger + calc (`udharBalance`, signed entries) already exist from Session B — Session C
is mostly UI + the payment/writeoff service methods + aging logic. WhatsApp statement is Session D.

## ⚠️ Resume gotchas (carry-over + new)
- **ALWAYS `git push origin main` after committing — do NOT ask Banti** (see CLAUDE.md Workflow). EAS builds
  from GitHub, so an unpushed commit = stale cloud build (this already caused a repeat Kotlin build failure).
- **Kotlin version is pinned to 2.1.20 via `plugins/withKotlinVersion.js`** (config plugin injecting
  `ext.kotlinVersion` into root build.gradle). Reason: SDK 57's `expo-root-project` reads Kotlin from the
  version catalog / `ext`, NOT from the `android.kotlinVersion` gradle property that expo-build-properties
  writes — and its KSPLookup only supports >= 2.1.20. Don't rely on gradle.properties for the Kotlin version.
  **This fix DID work** — EAS logs show `kotlin: 2.1.20 / ksp: 2.1.20-2.0.1`. The repeated "Kotlin 1.9.24"
  message was a red herring; once resolved, the *real* failure surfaced (see next).
- **WatermelonDB JSI is wired for New Arch via `plugins/withWatermelonNewArch.js`.** `@morrowdigital/
  watermelondb-expo-plugin` patches MainApplication for the OLD architecture — it injects
  `import com.facebook.react.bridge.JSIModulePackage` + a `getJSIModulePackage()` override. RN 0.86 / SDK 57
  is always bridgeless New Arch: that class is gone and the new `reactHost by lazy` MainApplication has no
  such hook, so only the broken import survived → `:app:compileDebugKotlin` failed with
  `Unresolved reference 'JSIModulePackage'`. Our plugin (runs AFTER the watermelondb plugin) strips the bad
  import/override and registers `WatermelonDBJSIPackage()` (a plain `ReactPackage`) in the autolinked
  `PackageList` block — the correct New-Arch wiring. **How the real error was found:** EAS logs are
  brotli-compressed NDJSON (`{"msg":...}` per line); `curl` the signed `logFiles` URL from
  `eas build:view <id> --json`, then `brotli -d`, then grep for `FAILURE:` / `e:` / `Task .* FAILED`.
- **EAS caches the prebuild output.** After changing native config (kotlin, plugins, app.json android/ios),
  rebuild with **`eas build --clear-cache`** or the stale cached gradle is reused.
- **WatermelonDB needs a DEV BUILD, not Expo Go.** JSI native module isn't in Expo Go. To actually run the DB:
  `npx expo prebuild` then `npx expo run:android` (local), or `eas build --profile development`. `expo start`
  alone (Expo Go) will crash on DB init. **CI bar = `tsc` + `jest` + `expo-doctor`** (all pass without a build);
  the UI/DB flows have NOT been run on a device yet — first real run should smoke-test billing end-to-end.
- **`.npmrc` has `legacy-peer-deps=true`** — required for RN/Expo transitive peer ranges (jest-preset 0.85 vs
  rn 0.86). Keep it; `npm install` depends on it.
- **`babel.config.js` is delicate — WatermelonDB decorators vs Metro/Hermes.** Final working config:
  `presets: [['babel-preset-expo', { decorators: false }]]` + `plugins: [` legacy `proposal-decorators`,
  then `transform-class-properties` / `transform-private-methods` / `transform-private-property-in-object`
  all `{ loose: true }` `]`. Three separate bugs had to be solved together — do NOT "simplify" this away:
  1. **Duplicate decorators.** preset-expo (SDK 57) enables legacy decorators by default. Adding our own
     too = a 2nd transform that crashes Metro on `name!: string` ("Definitely assigned fields cannot be
     initialized here"). Fix: `decorators: false` on the preset, own the decorators ourselves.
  2. **Hermes skips class-properties.** Hermes supports native class fields, so preset-env DROPS the
     class-properties transform → the legacy-decorator placeholder `_initializerWarningHelper` is left as
     the field initializer → runtime crash "Decorating class property failed …". Fix: add
     `transform-class-properties` explicitly so it always runs right after decorators.
  3. **class-features family must be consistent.** Enabling class-properties alone breaks RN files that use
     private methods (`#foo()`), and mismatched `loose` values throw "'loose' mode configuration must be the
     same for …" (surfaces under jest via `@react-native/jest-preset`). Fix: enable all three class-features
     plugins with the SAME `loose: true` RN uses.
  Plugins are pinned `^7` (project is on `@babel/core@7`; npm will install `@8` by default — wrong).
  **Verify any babel change with ALL of:** `npx jest` (19/19), `tsc --noEmit`, `expo export -p android`
  (must bundle ~1210 modules with no error), and a Hermes-caller transform of `src/db/models/*.ts` (the
  output must contain `initializerDefineProperty` and NOT use `_initializerWarningHelper` as a field init).
  `tsc`/`jest` alone are NOT enough — the tests import only the pure calc layer, never the models, so a
  broken model transform only shows up in the Metro bundle / on device.
- **App id `com.chickenshop.app`** is a placeholder — change before any store submission.
- **Menu prices are PLACEHOLDERS** (`services/menu/seed.ts`) — real menu + pricing still to be captured from
  the shop, then either edit in-app or update the seed.
- **Billing UI creates a fresh customer per bill when a name/udhar is present** (no dedup yet) — customer
  matching/dedup is a later concern (spec §4.3 / Session F). Fine for now.
- No Supabase config yet (deferred to Session G); offline-first local DB is fully standalone until then.

## 📌 Open questions / notes
- Security hook activates only after Claude Code **restart** (hooks load at session start).
- `EAS`/`eas.json` not created yet — will add when first dev build is needed (likely to smoke-test Session B/C).
