# Local Shop Business Management App — Project Spec

## 1. Problem Statement

Chhote local food shop owners (primary use-case: chicken shop) ke paas koi proper record-keeping system nahi hai:
- Udhar (credit) sales copy-pen mein likhte hain, ya kabhi likhte hi nahi
- Cash sales ka koi record nahi, isliye net profit ka pata nahi chalta
- Customer history/repeat patterns track nahi hote, kyunki owner ko value hi pata nahi
- Billing manually/mentally calculate hoti hai, rough estimate hota hai

## 2. Core Value Proposition

> **Self-employed mentality se business-owner mentality ki taraf shift karna**

App sirf record-keeping tool nahi hai — iska deeper goal hai:
- Owner ko clear baseline income dikhana (loyal customers se)
- Visible gaps dikhana (kya improve karna hai)
- Decision-making data dena (stock planning, timing, customer priority)
- Value ko **demonstrate** karna insights ke through, sirf explain nahi karna — kyunki target user (non-technical shop owner) ko data ki value samajh nahi aati abhi

## 3. Design Philosophy

- **Reusable core, not one-off build.** System ek "bank" ki tarah hai — MVP ready rakha jayega jo har naye similar shop (chicken shop ho ya similar retail) ke liye reusable ho, sirf config/menu specific cheezein badlegi.
- **Three-layer architecture:**
  - **Layer 1 (Universal Core)** — Har chhoti dukaan mein common pain points. Blind build ho sakta hai, validated hai.
  - **Layer 2 (Configurable)** — Thresholds/settings jo shop-se-shop vary karte hain (loyal customer threshold, gap windows). Tunable, hardcoded nahi.
  - **Layer 3 (Shopkeeper-specific)** — Per-owner customization (menu structure, unique workflows). Future scope.
- **Bulk/average over exact precision.** Raw material aur profit tracking mein 100% exact accuracy zaroori nahi — average estimate se kaam chal jayega. Isse shopkeeper ka manual load kam rehta hai.
- **Speed = copy-pen jaisi fast entry.** Har feature ka UX benchmark: agar copy-pen se slow hai, toh use nahi karega shopkeeper.
- **Offline-first.** Data/wifi issue chhoti dukaano mein common hai — core operations (billing, udhar) kabhi internet pe dependent nahi honge.
- **Real observation before building.** Koi bhi feature assumption pe finalize nahi, dukaan visit se validate karna hai.

---

## 4. Feature List (Layer 1 — Core)

### 4.1 Quick Billing
- Pre-set menu items (buttons/dropdown)
- Multiple line items per bill, har item independently **Quantity-based** (half kg, 1kg, pao) ya **Amount-based** ("₹100 ka de do") mode mein
- Smart default mode per item type (e.g., chicken → Qty, misc/extra → ₹), manually switchable
- Payment mode per bill: **Cash / Online / Udhar** (mix allowed within one bill — partial cash + partial udhar)
- Draft state before "Confirm & Send" — freely editable; locked after confirm
- Post-confirm correction = **void + recreate** (never silent edit), audit trail preserved

### 4.2 Menu/Price Management
- Menu items with a **persistent default price** (stays until shopkeeper manually changes it — no forced daily entry)
- Per-bill manual price override allowed (for discounts/negotiation)
- Every bill stores a **frozen price snapshot** at creation time — past bills never retroactively change

### 4.3 Customer Entry
- Naam + WhatsApp number
- Number **optional** for cash/fully-paid bills
- Number **mandatory** if any udhar amount > ₹0 on the bill (even partial)
- Duplicate naam handling: number is primary identifier when available → else auto-suffix (e.g., "Ramesh (2)") → shopkeeper can add manual tag (e.g., landmark) → list shows last-visit context to disambiguate
- Customer record persists even without number (naam-based tracking), so repeat-visit insights still work

### 4.4 Udhar (Credit) Tracking
- Running balance model: **full transaction history** (not a single mutable balance field) — every bill/payment is an append-only entry, current balance = sum
- Partial payments supported independent of new bills
- Every new bill and every payment triggers a **WhatsApp statement message** showing: this transaction + full pending udhar breakdown + total balance
- Aging flags: 15+ days = visual flag (yellow), 60+ days = stronger flag (red) — automatic, no manual action
- **Bad debt write-off**: shopkeeper-triggered manual action after reviewing aged udhar; written-off amount is removed from active list but counted as a **loss** in net profit calc

### 4.5 WhatsApp Bill/Statement Share
- No WhatsApp Business API — manual share via native `wa.me` link / share intent (zero cost)
- Message includes: current transaction + running udhar statement (if applicable) + total balance
- Delivery status per bill: `Pending → Sent` (visible indicator)
- Background auto-retry queue (silent, resumes when internet returns)
- Fallback if WhatsApp unavailable: native SMS compose screen opens pre-filled (free, manual tap) — no SMS gateway cost for this basic flow

### 4.6 Daily Summary
- Cash collected today
- Online collected today
- Udhar given today
- Net profit = Total Sales (Cash + Online + Udhar collected) − Raw Material Purchases − Wastage − Bad Debt (written-off)

### 4.7 Raw Material Tracking (Bulk, not recipe-level)
- Tracked items: Chicken (kg), Packing envelope (piece), Masala (generic bucket, ₹ or packet), Onion (kg), Coriander (kg/bunch), Garlic/paste (kg/jar), Other vegetables (₹ generic)
- Entry = **item + quantity + ₹ amount**, nothing more (fast, copy-pen equivalent)
- Multiple purchases same day/same item = **separate entries** (not merged) — preserves rate fluctuation and timing detail
- All entries timestamped (date + time, IST)
- Gas cylinder tracking explicitly **out of scope** (too hard to attribute to usage)

### 4.8 Wastage/Spoilage Tracking
- Dedicated tab/section, separate from purchases
- Entry = item + quantity/₹ + date-time (auto) + optional reason (free text)
- Included in net profit formula as a loss line

### 4.9 Customer Insights
- Repeat customer list, favorite items
- Return-gap flag: only activates after a customer has **4-5+ visits** (avoids false alarms on new customers)
- Gap threshold is **per-customer, self-learning** — derived from that customer's own historical average gap, not a fixed "15 days" rule (correctly handles seasonal/weekend-only customers)
- **Loyal customer pattern**: customers visiting 3-4x/month spending ₹300+ → surfaced as "N loyal customers → ₹X guaranteed monthly income" — the flagship insight for the mindset-shift value prop
- Optional: one-tap generic WhatsApp greeting/reminder to flagged customers

### 4.10 Timestamps (cross-cutting requirement)
- Every entry (bill, payment, raw material purchase, wastage, udhar) captures **date + time**, displayed in **IST**
- Stored as UTC in backend (standard practice), converted for display
- Offline entries use local device time, corrected on sync

---

## 5. Explicitly Out of Scope for MVP (Layer 2/3 — Future)

- Multi-staff PIN/login system
- Duplicate-bill detection across staff (same customer, same items, same time window flagged) — depends on multi-staff existing first
- Automated bulk reminders via Twilio (WhatsApp/SMS API) — manual share is sufficient for now
- Recipe-level ingredient breakdown per menu item (currently bulk-only raw material tracking)
- Customer-facing app/login (customer only receives WhatsApp messages, no read/write access of their own)
- Retroactive merge of customer records when a number is added later
- Gas cylinder tracking

---

## 6. Edge Case Decisions (Reference)

| # | Edge Case | Decision |
|---|---|---|
| 1 | Menu price changes | Persistent default rate (until manually changed) + per-bill override + frozen snapshot on past bills |
| 2 | Mixed qty-based/amount-based items in one bill | Multi-line items, each with independent mode toggle, smart default per item type |
| 3 | Bill entry mistake | Draft state (free edit before confirm) → locked after confirm → void + recreate for post-confirm fixes |
| 4 | Customer never returns (bad debt) | Auto-flag at 15+/60+ days (visual escalation) + manual shopkeeper-triggered write-off; written-off = loss in net profit |
| 5 | Udhar amount disputed by customer | Full append-only transaction history always visible + WhatsApp confirmation sent on every payment (proof both sides) |
| 5b | Payment method beyond cash | Three modes: Cash / Online / Udhar (no specific UPI app tracking); daily summary splits cash-in-hand vs online vs udhar |
| 6 | Duplicate customer names | Number = primary identifier; else auto-suffix + optional manual tag; list shows last-visit context |
| 7 | Customer won't share number | Optional for cash bills (soft-ask, no push); mandatory once any udhar amount > ₹0 on the bill (including partial) |
| 8 | WhatsApp message fails to send | Background auto-retry queue + visible Pending/Sent status + native SMS compose fallback (free, manual) |
| 9 | Multiple raw material purchases same day | Separate entries (not merged), each with IST timestamp — preserves rate/timing detail |
| 10 | Wastage/spoilage | Dedicated entry type/tab; included as loss in net profit formula |
| 11 | Payment mode changed mid-transaction | Already covered by draft state + mixed-mode support — no extra handling needed |
| 12 | Multi-staff offline sync conflicts | Append-only design (bills/payments are new records, not edits) avoids most conflicts; udhar balance is sum-based, not a mutable field. No action needed for single-owner MVP. |
| 13 | Duplicate bill detection (two staff, same customer) | Parked for Layer 2/3 — only relevant once multi-staff exists |
| 14 | Phone data loss | Auto background sync/backup to Supabase whenever internet available; local-first for speed, cloud as safety net |
| 15 | New/seasonal customer false insight alarms | Minimum 4-5 visit threshold before any insight activates; per-customer average gap instead of fixed window |

---

## 7. Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| App framework | **React Native (Expo)** | Single codebase for Android (primary) + iOS (secondary but needed — younger users do use iPhones); Expo simplifies offline storage setup |
| Local storage (primary, offline-first) | **WatermelonDB** (built on SQLite) | Reactive UI updates without manual refresh code; built-in sync engine reduces custom sync logic; scales better than raw SQLite once multiple shops/large history exist. (Plain SQLite would also technically work for a single shop's first year of data, but WatermelonDB avoids a future migration.) |
| Cloud backend / backup | **Supabase (Postgres)** | Background auto-sync/backup (Edge Case 14), built-in auth (ready for future multi-staff PIN/login), central DB if managing multiple shop deployments |
| WhatsApp share | Native share intent / `wa.me` link | Zero cost, no API needed — opens the already-installed WhatsApp app pre-filled |
| SMS fallback | Native `sms:` compose link | Zero cost, manual tap, used only when WhatsApp isn't available on the number |
| Automation (future, Layer 2/3) | **n8n** | Bulk reminders, scheduled daily-summary notifications — not needed for MVP |
| Programmable messaging (future, Layer 2/3) | **Twilio** | Only if/when automated bulk WhatsApp/SMS (beyond manual tap) becomes necessary |
| Version control | **GitHub** | Code hosting |
| Web dashboard hosting (future, if built) | **Vercel** / **Render** | For an owner-side multi-shop overview panel, if built later |

### Why offline-first (not straight-to-Supabase)
Unlike a real-time use case (e.g., live location tracking, where connectivity is inherent to the product), this app's core actions — billing, udhar entry — must work instantly regardless of internet availability, because a shop's wifi/data is unreliable. Supabase is used as a **secondary sync/backup layer**, not the primary data path. Local storage (WatermelonDB/SQLite) is the source of truth at write-time; Supabase catches up in the background.

---

## 8. Suggested Data Model (high-level, for reference)

**customers**
- id, name, phone (nullable), tag (nullable, manual), created_at

**menu_items**
- id, name, default_price, unit_type (qty/amount default), active

**bills**
- id, customer_id, status (draft/confirmed/voided), created_at (IST), confirmed_at
- bill_line_items: item_id, mode (qty/amount), quantity_or_amount, price_snapshot
- payment_splits: mode (cash/online/udhar), amount

**payments** (independent of bills — for later partial udhar clearing)
- id, customer_id, amount, mode, created_at

**raw_material_purchases**
- id, item_name, quantity_or_amount, cost, created_at (IST)

**wastage**
- id, item_name, quantity_or_amount, reason (nullable), created_at (IST)

**whatsapp_messages**
- id, bill_id or payment_id, status (pending/sent/failed), retry_count

---

## 9. Next Steps

- [ ] Shop visit — observe actual operations, validate/revise feature list
- [ ] Confirm real menu items + pricing structure
- [ ] Build MVP prototype (Layer 1 core only)
- [ ] Test billing speed against copy-pen benchmark with actual shopkeeper
- [ ] Revisit Layer 2/3 features once a second shop is being onboarded
