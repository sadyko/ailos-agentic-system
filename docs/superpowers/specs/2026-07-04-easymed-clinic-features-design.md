# EasyMed — small-clinic feature set: custom services, daily stationary billing, unified drug orders, prescriptions

Date: 2026-07-04
Status: Approved (design) — ready for implementation plan
Scope owner: onboarding a new small clinic on EasyMed

## Context & hard constraint

A new small clinic is being onboarded. It has three needs the current system doesn't cover cleanly:

1. It does **not** want to use the medcore catalog services — it wants its **own** service list.
2. Its stationary (inpatient) is billed **per 24h/day** (check-in → check-out), not by the current **hourly** rate.
3. Drugs are consumed/billed **inside the stationary** (and, by extension, in the outpatient flow).

During brainstorming a fourth area — **prescriptions** — was folded in, since it touches drugs across the patient card, doctor workspace, and stationary.

**Hard constraint (non-negotiable):** implement everything **inside EasyMed only** — its Supabase DB (`jfgxkjolacpbylgxbafl`), its admin SPA (`/var/www/easymed.uz/js/admin`), and its FastAPI gateway (`/opt/easymed-api`, `easymed-api.service`). **Do not modify the medcore CORE catalog and do not change Symptex behavior.** A single per-clinic flag gates all new behavior, so existing clinics are unaffected.

## Current-state facts (verified in the live system)

- **Services** live in the EasyMed `services` table, `company_id`-scoped and branch-scoped, each with a **nullable** `core_service_id` (link to the medcore catalog) + `type_id`/`category_id` (into EasyMed-local `service_types`/`service_categories`). Custom (non-catalog) services are already representable at the data level.
- **Symptex never reads EasyMed's `services` table.** On publish, the gateway writes medcore `clinic_services` rows keyed by `core_service_id`; Symptex renders a clinic's offerings by `core_service_id → catalog category`. The only medcore write path is `create_catalog_service` (already **superadmin-only**). ⇒ A service with `core_service_id = null` is invisible to Symptex and never reaches medcore.
- **One shared service picker** — `openServicePickerModal` (`service-picker-modal.js`) — is the single entry point for applying a service to a patient. Callers: patient card (registrar "Новый визит"/add services), calendar, admission-modal + `beds.js` (inpatient), doctor workspace "Refer to". It loads services from the **local `services` table** (`state.services`) and references them by `service_id`. Its column‑1 grouping uses **medcore groups** (`useGroups=true`) when services carry `core_service_id`s, with an existing fallback to **local `service_types`** (`useGroups=false`).
- **Referrals:** doctor "Refer to" → `recommended_services` row (`recommended_by = doctor`) → later applied as a `visit_service`.
- **Stationary:** `admissions` (+ `admitted_at`, `discharged_at`, `bed_id`, `ward_id`, `accommodation_discount_percent`) with `beds`/`wards`. Billing is hourly: rate = `beds.price_per_hour` → `wards.price_per_hour` → 0, applied `admitted_at → discharged_at`, `hours = ceil(minutes/60)`, charged at discharge. `admission_services` is the per-stay billing line table: `admission_id, service_id, clinic_item_id, quantity, unit_price, total, invoice_item_id, status, performed_at`.
- **Drugs are fully clinic-local:** `clinic_items` (`is_drug=true`, `price`, `unit`) with **no** `core_item_id` / no medcore item catalog. Stock in `item_stock`, kept by `stock_movements`. Administrations in `med_administrations` (stationary) and `visit_services.clinic_item_id` / `admission_services.clinic_item_id` (billed dispenses).
- **Prescriptions** are two distinct things:
  - **«Рецепт» (free-text):** doctor writes `{name, dose, freq, dur, notes}` via `openPrescriptionDialog` → stored in `payload.prescriptions` inside `visit_services.notes`; printed for the patient; not billed; not catalog-bound. Patient card aggregates them read-only.
  - **«Назначения (в клинике)» (billed drug orders):** `clinic_items` dispensed via `visit_services.clinic_item_id` (outpatient) or `admission_services.clinic_item_id` (stationary).

## Design

### Cross-cutting: per-clinic flag

Add `companies.custom_services_enabled boolean default false`. All new service behavior is gated on it; existing clinics keep current behavior.

### Feature 1 — Custom (override) services

**Data:** no schema change to `services` (uses the existing nullable `core_service_id`). Custom services are created with `core_service_id = null`, `type_id`/`category_id` from the clinic's own local `service_types`/`service_categories`.

**Admin services form (`section-crud.js`, `services` section):** when `custom_services_enabled`:
- drop the "из каталога" requirement and hide the medcore catalog import wizard; name/price/department/type/duration/VAT are free-entry;
- save `core_service_id = null`.

**Shared picker + appointments grouping fix:** when the clinic is in custom mode, force `useGroups = false` (group column 1 by local `service_types`) in `service-picker-modal.js` and `appointments.js`. Because every application flow routes through this one picker, custom services then appear in **registrar, doctor referral, inpatient, cashier, and calendar** simultaneously. (Mixed clinics — some catalog, some custom — otherwise drop custom services from the medcore-grouped view; this fix covers them.)

**Symptex/medcore isolation:** custom services have no `core_service_id`, so the publish flow never creates a `clinic_services` row for them and `create_catalog_service` is never called. Symptex is unchanged; zero medcore writes.

### Feature 2 — Daily (24h) stationary billing

**Data:** add `wards.billing_mode text default 'hourly'` ('hourly' | 'daily') and `wards.price_per_day numeric`. Optional per-bed override `beds.price_per_day`. Add `companies.charge_discharge_day boolean default false`.

**Charge logic** (replaces the hourly computation in `beds.js` `recompute()` + the discharge charge, only when the effective ward/bed `billing_mode = 'daily'`):
- `days` = count of distinct calendar dates the bed is occupied from `admitted_at` to `discharged_at` (or "now" for the live estimate). **Admission day always counts.**
- **Discharge day:** default **not charged** — bill admission date through the day before discharge; if `charge_discharge_day = true`, include the discharge date. A same-day admit+discharge always = 1 day.
- `gross = days × effective_price_per_day` (bed override > 0 → ward `price_per_day` → 0); `net = gross × (1 − accommodation_discount_percent/100)`.

**UI:** the accommodation card shows "N days × rate" and check-in/check-out (already `admitted_at`/`discharged_at`) instead of "N hours × rate". Charge lands on the invoice at discharge exactly as today.

### Feature 3 — Unified drug orders (outpatient + stationary): bill + stock

Drugs are already clinic-local (`clinic_items`), so no override work — the clinic manages its own drug list in `#settings:clinic_items`.

**"Give drug" action** — available in the doctor workspace «Назначения в клинике», the patient card, and the admission/bed detail. In one **atomic gateway call**:
1. `med_administrations` row (clinical log: drug, dose, time, administering user);
2. billing line — `visit_services.clinic_item_id` (outpatient) or `admission_services.clinic_item_id` (stationary), `quantity`, `unit_price = clinic_items.price`, `total`, linked to the invoice (`invoice_item_id`);
3. `stock_movements` row (−qty) → decrements `item_stock.qty_on_hand` for the branch.

**Guard:** warn (configurable to block) if stock would go negative. Void reverses all three.

Rationale for the gateway: keep record + bill + stock consistent (no partial writes if the SPA drops mid-sequence). Today the outpatient path bills but does not reliably auto-deduct stock; this unifies both paths.

### Feature 4 — Prescriptions

- **«Рецепт» (free-text):** already works for a custom clinic (free-typed drug/dose). **Optional** enhancement: autocomplete the drug name from `clinic_items` so prescriptions align with the clinic's own stock. Marked optional / YAGNI-guarded — not required for launch.
- **Stationary Rx handoff:** the admission modal already surfaces the doctor's `payload.prescriptions`; wire "administer" from that list into Feature 3 (a prescription line → `med_administrations` + `admission_services` + `stock_movements`).

## Where the code lives

- **DB migration (EasyMed Supabase):** `companies.custom_services_enabled`, `companies.charge_discharge_day`, `wards.billing_mode`, `wards.price_per_day`, optional `beds.price_per_day`. No medcore.
- **Admin SPA (`/var/www/easymed.uz/js/admin`):** `section-crud.js` (custom-mode services form), `service-picker-modal.js` + `appointments.js` (grouping toggle), `beds.js` (daily charge + UI), a shared "Give drug" action reachable from workspace/patient-card/admission, optional `openPrescriptionDialog` autocomplete.
- **Gateway (`/opt/easymed-api`):** one atomic endpoint `POST /api/v1/inpatient/administer-drug` (and/or a shared drug-administration endpoint) doing log + bill + stock with the service-role key, scoped to the caller's company via `current_em_user`.
- **No git in the web docroot** → back up every edited file (`.bak-<ts>`) before changing, as with prior EasyMed work.

## Isolation guarantees (why medcore + Symptex are safe)

- Custom services never get a `core_service_id`, so: no `clinic_services` publish rows, `create_catalog_service` never invoked, Symptex catalog/clinic pages unchanged.
- Drugs/prescriptions are already 100% EasyMed-local (`clinic_items`) — nothing to isolate.
- All new columns default to the current behavior; only clinics with `custom_services_enabled` / `billing_mode='daily'` see new behavior.

## Verification

- **Custom services:** enable the flag on the test clinic; add a custom service (no catalog); confirm it appears in the picker (registrar/patient-card, doctor referral, admission, cashier, calendar) and bills; confirm it does **not** appear on Symptex and no medcore row is created.
- **Daily billing:** set a ward to daily + `price_per_day`; admit and discharge across N calendar days; verify the invoice charge = N (or N−1 with discharge-day off) × rate; verify hourly clinics unaffected.
- **Drug orders:** administer a drug outpatient and inpatient; verify the bill line, the `item_stock` decrement, the `med_administrations` log, and that void reverses all three; verify negative-stock guard.
- **Prescriptions:** write a free-text Rx and print it; administer from a stationary Rx and confirm it bills + decrements stock.

## Out of scope

- Any medcore catalog change, any Symptex change.
- De-duplicating the existing branch-null vs per-branch service rows (separate cleanup).
- A medcore drug catalog / INN·ATC coding for prescriptions.
- Building a category taxonomy for clinics that don't use one.

## Resolved decisions

- Service override = **per-clinic custom-catalog flag** (custom services are EasyMed-only, invisible to Symptex).
- Daily billing = **calendar days, admission day counts**; **discharge day not charged by default**, per-clinic toggle to include it.
- Inpatient (and outpatient) drugs = **auto-bill + auto-deduct stock**, unified atomic flow.
- Prescriptions: free-text Rx works as-is; `clinic_items` autocomplete optional.
