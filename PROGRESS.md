# PROGRESS — Chicken Shop App

> Session status tracker. **Update this at the END of every session** so the next
> session knows exact status without re-reading everything.
> Full spec: `chicken-shop-app-spec.md` · Project rules: `CLAUDE.md`

_Last updated: 2026-07-01_

---

## ✅ Done
- **Project config + security bootstrap**
  - `CLAUDE.md` — project context, non-negotiable domain rules, PRIME workflow, security posture
  - `.claude/hooks/security-guard.js` — Layer 1 input filter (Bash/PowerShell code-exec gating, tested: 4 block + 4 allow inc. false-positives)
  - `.claude/settings.json` — hook wiring (matcher `Bash|Write|Edit|Create|PowerShell`)
  - `.gitignore` — secrets (`.env*`, service-account, keys) + Expo/RN artifacts
  - Spec committed (`chicken-shop-app-spec.md`)

## ⏳ Pending (MVP Layer 1 — planned session breakdown)
- [ ] **Session A** — Expo scaffold + WatermelonDB schema + data model (foundation, solo)
- [ ] **Session B** — Quick Billing + Menu/Price (draft→confirm→void, frozen price snapshot)
- [ ] **Session C** — Udhar ledger + Payments (append-only, aging flags 15/60 days)
- [ ] **Session D** — WhatsApp/SMS share + retry queue (native intents, pending/sent status)
- [ ] **Session E** — Daily Summary + Raw Material + Wastage tracking
- [ ] **Session F** — Customer Insights (self-learning gaps, loyal-customer income)
- [ ] **Session G** — Supabase background sync/backup (offline-first catch-up, strict review)
- [ ] Shop visit — validate feature list + confirm real menu/pricing (spec Next Steps)

## ➡️ Next step
**Session A: Expo scaffold + WatermelonDB schema + data model.**
Model: Opus (multi-file foundation). Start in Plan Mode.

## 📌 Open questions / notes
- Security hook activates only after Claude Code **restart** (hooks load at session start).
- Real menu items + pricing still need shopkeeper confirmation before UI finalizes.
