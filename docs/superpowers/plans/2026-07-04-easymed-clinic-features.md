# EasyMed Small-Clinic Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four features for a new small clinic — custom (non-catalog) services, daily (24h) stationary billing, unified outpatient+stationary drug orders (bill + stock), and prescription handoff — entirely inside EasyMed, gated on a per-clinic flag, without touching the medcore catalog or Symptex.

**Architecture:** A DB migration adds columns that all default to today's behavior. The admin SPA reads the per-clinic flag and adapts: the services form becomes free-entry, the shared service picker groups by local `service_types`, bed billing computes in days, and a "Give drug" action calls a new atomic gateway endpoint that writes the med log + invoice line + stock movement together. The gateway (`/opt/easymed-api`, FastAPI, service-role) is the only server-side writer.

**Tech Stack:** Supabase / PostgREST (EasyMed project `jfgxkjolacpbylgxbafl`), vanilla-JS admin SPA (`/var/www/easymed.uz/js/admin`, `h()` DOM helpers + `supabase-js`), FastAPI gateway (Python 3.10, `httpx`), nginx.

**Environment rules (read once):**
- **No test framework in the SPA and no git in `/var/www/easymed.uz`.** Before editing ANY file: `cp <file> <file>.bak-$(date +%Y%m%d-%H%M%S)`.
- **Verification is observable, not unit-test:** DB = PostgREST query via the gateway's `EASYMED_SERVICE_KEY`; gateway = `python -c "import ast"` syntax check + a direct `venv/bin/python` async call + `curl` (403 without a token = route exists); SPA = `node --check <file>` + bump the asset cache-buster + reload the page.
- **Cache-busting:** SPA modules are versioned in `js/admin.js` (e.g. `section-crud.js?v=svc55`) and the top loader in `admin.html` (`admin.js?v=cmrg1c60`). Bump BOTH the module's `?v=` in admin.js AND `admin.js?v=` in admin.html, or the browser serves stale code.
- **Company under test:** the "cleveland" clinic company is `cf38df6f-449d-4db1-b483-f13cafa02627` (has 5 `service_types`, `wards`/`beds`, `clinic_items`).
- **All server work is over `ssh root@45.77.242.169`.** Gateway env is at `/opt/easymed-api/.env` (`EASYMED_URL`, `EASYMED_SERVICE_KEY`).

**Helper — run a PostgREST read (used throughout for verification):**
```bash
ssh root@45.77.242.169 'cd /opt/easymed-api; set -a; . ./.env; set +a; \
  curl -s "$EASYMED_URL/rest/v1/<TABLE>?<QUERY>" -H "apikey: $EASYMED_SERVICE_KEY" -H "Authorization: Bearer $EASYMED_SERVICE_KEY"'
```

---

## File map

| File | Responsibility | Change |
|---|---|---|
| DB migration (Supabase SQL editor) | gated columns | Create |
| `/opt/easymed-api/app/easymed_client.py` | service-role EasyMed reads/writes | Modify — add `administer_drug()` + `company_flags()` |
| `/opt/easymed-api/app/main.py` | gateway routes | Modify — add `GET /api/v1/company/flags`, `POST /api/v1/inpatient/administer-drug` |
| `js/admin/views/section-crud.js` | services admin form | Modify — custom-mode services form |
| `js/admin/views/service-picker-modal.js` | shared service picker | Modify — local-type grouping when custom mode |
| `js/admin/views/appointments.js` | calendar picker grouping | Modify — same grouping guard |
| `js/admin/views/beds.js` | inpatient board + accommodation billing | Modify — daily charge mode + Give-drug action |
| `js/admin/views/service-workspace.js` | doctor workspace | Modify — Give-drug from «Назначения» + Rx handoff |
| `js/admin/views/patient-card.js` | patient card | Modify — Give-drug entry (reuse shared action) |
| `js/admin/clinic-flags.js` | shared per-clinic flag loader | Create |
| `js/admin.js` / `admin.html` | module versions | Modify — cache-bust |

**Phases are independently shippable.** Ship Phase 1 (custom services) first — it unblocks the clinic onboarding — then 2, 3, 4.

---

## Phase 0 — DB migration (gated columns)

### Task 0.1: Add the gated columns

**Files:** run in the Supabase SQL editor for project `jfgxkjolacpbylgxbafl` (DDL — the service key can't run DDL over PostgREST; use the dashboard SQL editor or a psql superuser connection).

- [ ] **Step 1: Confirm the columns don't already exist**

Run (helper above):
```
service_types → already OK; check companies + wards:
companies?select=id&limit=1        # confirm table reachable
wards?select=id,price_per_hour&limit=1
```
Expected: `companies` and `wards` reachable; no `custom_services_enabled` / `billing_mode` yet.

- [ ] **Step 2: Apply the migration SQL**

```sql
alter table companies add column if not exists custom_services_enabled boolean not null default false;
alter table companies add column if not exists charge_discharge_day  boolean not null default false;
alter table wards     add column if not exists billing_mode text not null default 'hourly'
                       check (billing_mode in ('hourly','daily'));
alter table wards     add column if not exists price_per_day numeric;
alter table beds      add column if not exists price_per_day numeric;
```

- [ ] **Step 3: Verify columns exist and defaults are correct**

Run:
```
companies?select=id,custom_services_enabled,charge_discharge_day&limit=1
wards?select=id,billing_mode,price_per_day&limit=1
```
Expected: `custom_services_enabled=false`, `charge_discharge_day=false`, `billing_mode='hourly'`, `price_per_day=null`. **No existing clinic behavior changes** (all defaults preserve today's flow).

- [ ] **Step 4: Turn the flag on for the test clinic only**

```
PATCH companies?id=eq.cf38df6f-449d-4db1-b483-f13cafa02627  body {"custom_services_enabled": true}
```
Expected: 1 row updated. (Do NOT enable for any other company.)

---

## Phase 1 — Custom (override) services

### Task 1.1: Gateway — expose the per-clinic flags to the SPA

The SPA needs the flag; serve it via the gateway (already how the catalog lookup works) so it's scoped to the caller's company.

**Files:** Modify `/opt/easymed-api/app/easymed_client.py`, `/opt/easymed-api/app/main.py`

- [ ] **Step 1: Back up**
```bash
ssh root@45.77.242.169 'cd /opt/easymed-api && for f in app/easymed_client.py app/main.py; do cp $f $f.bak-$(date +%Y%m%d-%H%M%S); done'
```

- [ ] **Step 2: Add `company_flags()` to `easymed_client.py`** (append at end of file)
```python
async def company_flags(company_id: str) -> dict:
    """Per-clinic feature flags for the admin SPA. LOOKUPS_CATALOG_V2 sibling."""
    import httpx as _httpx
    cols = "custom_services_enabled,charge_discharge_day"
    async with _httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(f"{config.EASYMED_URL}/rest/v1/companies",
                        headers=_h(),
                        params={"select": cols, "id": f"eq.{company_id}", "limit": "1"})
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else {"custom_services_enabled": False, "charge_discharge_day": False}
```

- [ ] **Step 3: Add the route in `main.py`** — place it AFTER `current_em_user` is defined (anchor on the existing `@app.post("/api/v1/catalog/specialties")` line; insert before it):
```python
@app.get("/api/v1/company/flags")
async def company_flags_route(em: dict = Depends(current_em_user)):
    """Per-clinic feature flags for the current admin's company."""
    try:
        return await easymed_client.company_flags(em.get("company_id"))
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"easymed unreachable: {e}")


```

- [ ] **Step 4: Syntax check + restart + verify**
```bash
ssh root@45.77.242.169 'cd /opt/easymed-api && venv/bin/python -c "import ast;[ast.parse(open(\"app/\"+f).read()) for f in (\"easymed_client.py\",\"main.py\")];print(\"AST OK\")" && \
  systemctl restart easymed-api.service && sleep 4 && \
  curl -s -o /dev/null -w "flags route: %{http_code}\n" http://127.0.0.1:8001/api/v1/company/flags && \
  set -a; . ./.env; set +a; venv/bin/python -c "import asyncio;from app import easymed_client as e;print(asyncio.get_event_loop().run_until_complete(e.company_flags(\"cf38df6f-449d-4db1-b483-f13cafa02627\")))"'
```
Expected: `AST OK`; `flags route: 403` (exists, needs auth); printed dict `{'custom_services_enabled': True, 'charge_discharge_day': False}`.

### Task 1.2: SPA — shared clinic-flags loader

**Files:** Create `js/admin/clinic-flags.js`

- [ ] **Step 1: Create the loader** (cached once per session; fail-soft to all-false)
```js
// Per-clinic feature flags, fetched once via the gateway. CUSTOM_CLINIC_V1.
import { gw } from './gateway.js';
let _cache = null;
export async function clinicFlags() {
    if (_cache) return _cache;
    try { _cache = await gw('/company/flags') || {}; }
    catch (e) { console.warn('[clinic-flags]', e.message); _cache = {}; }
    return _cache;
}
export function clinicFlagsSync() { return _cache || {}; }
```

- [ ] **Step 2: Syntax check**
```bash
ssh root@45.77.242.169 'node --check /var/www/easymed.uz/js/admin/clinic-flags.js && echo OK'
```
Expected: `OK`.

### Task 1.3: SPA — free-entry services form in custom mode

**Files:** Modify `js/admin/views/section-crud.js` (the `services` section form + the catalog-import wizard around lines 1954–2146).

- [ ] **Step 1: Back up**
```bash
ssh root@45.77.242.169 'cp /var/www/easymed.uz/js/admin/views/section-crud.js /var/www/easymed.uz/js/admin/views/section-crud.js.bak-$(date +%Y%m%d-%H%M%S)'
```

- [ ] **Step 2: Read the current services form + catalog wizard** so the edit is precise:
```bash
ssh root@45.77.242.169 'sed -n "1950,2160p" /var/www/easymed.uz/js/admin/views/section-crud.js'
```
Note the function that renders the "add service" entry (catalog wizard) and where `sections.js` marks the `name`/`type_id`/`category_id` fields `readOnly`.

- [ ] **Step 3: Implement the custom-mode branch.** Import the flag loader at the top of `section-crud.js`:
```js
import { clinicFlags } from '../clinic-flags.js';
```
In the services-section render path, `await clinicFlags()` and when `custom_services_enabled`:
- render an **"Add custom service"** button that opens the normal section-crud create form (not the catalog wizard) with `name`, `price`, `department_id`, `type_id` (local `service_types`), `category_id`, `duration_minutes`, `tax_rate`, `requires_doctor` all **editable**, and saves `core_service_id: null`;
- hide the "из каталога" catalog wizard button.

(Concrete edit: gate the existing catalog-wizard button behind `!flags.custom_services_enabled`, and add the custom-create button behind `flags.custom_services_enabled`. The insert form already exists — Task uses `section-crud`'s own create form with the `services` field defs made editable when the flag is on; in `sections.js`, change the services `fields` so `name`/`type_id`/`category_id` are `readOnly: false` when a runtime flag is set — pass the flag through the render context.)

- [ ] **Step 4: Bump versions**
```bash
ssh root@45.77.242.169 'cd /var/www/easymed.uz && \
  sed -i "s/section-crud.js?v=svc55/section-crud.js?v=svc56/" js/admin.js && \
  sed -i "s/admin.js?v=cmrg1c61/admin.js?v=cmrg1c62/" admin.html && \
  node --check js/admin/views/section-crud.js && echo OK'
```
Expected: `OK`.

- [ ] **Step 5: Verify in the browser** — hard-reload `admin#settings:services` on the cleveland clinic → an "Add custom service" button appears, the catalog picker is hidden, and a service saved this way has `core_service_id=null`:
```
services?select=name,core_service_id&order=created_at.desc&limit=1   # the just-added one → core_service_id null
```

### Task 1.4: SPA — picker grouping fix (custom services appear everywhere)

**Files:** Modify `js/admin/views/service-picker-modal.js`, `js/admin/views/appointments.js`

- [ ] **Step 1: Back up both.**

- [ ] **Step 2:** In `service-picker-modal.js`, at the point where `state.useGroups` is set to `true` after resolving medcore groups (~line 305), guard it with the flag: import `clinicFlags`, `const _f = await clinicFlags();` and only allow `state.useGroups = true` when `!_f.custom_services_enabled`. When the flag is on, leave `useGroups=false` so column 1 = local `service_types`.

- [ ] **Step 3:** Do the same guard in `appointments.js` (~line 176 where `state.useGroups = true`).

- [ ] **Step 4: Bump the picker version** (`service-picker-modal.js?v=aurora66 → aurora67` in every importer — `admission-modal.js`, `beds.js`, `patient-card.js`, `appointments.js`, and the `service-workspace` referral) and `node --check` both files.

- [ ] **Step 5: Verify** — on the cleveland clinic, open the picker from patient-card ("Новый визит"), from a bed detail, and from the doctor "Refer to": the custom service is listed and selectable in each. Confirm a picked custom service creates a `visit_services` (or `admission_services`) row referencing it.

---

## Phase 2 — Daily (24h) stationary billing

### Task 2.1: Daily charge computation in `beds.js`

**Files:** Modify `js/admin/views/beds.js` (accommodation card `recompute()` ~line 690, and the discharge charge path).

- [ ] **Step 1: Back up.**

- [ ] **Step 2: Read the full accommodation card + discharge charge code** so the edit is exact:
```bash
ssh root@45.77.242.169 'sed -n "655,760p" /var/www/easymed.uz/js/admin/views/beds.js; echo ---DISCHARGE---; grep -n "invoice_item\|admission_services\|grossCharge\|discharge" /var/www/easymed.uz/js/admin/views/beds.js | head'
```

- [ ] **Step 3: Add a day-count helper** near the top of `beds.js`:
```js
// Distinct calendar dates occupied from start→end (admission day counts).
// chargeDischargeDay=false → drop the discharge date (min 1 day). DAILY_BILLING_V1.
function daysStayed(startIso, endIso, chargeDischargeDay) {
    if (!startIso) return 0;
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : new Date();
    const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const d1 = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let days = Math.floor((d1 - d0) / 86400000) + 1;           // inclusive of both dates
    if (!chargeDischargeDay && endIso && days > 1) days -= 1;  // hotel-style, floor at 1
    return Math.max(1, days);
}
```

- [ ] **Step 4: Branch `recompute()` on billing mode.** Read the effective mode/rate from the ward/bed: `mode = bed.billing_mode || ward.billing_mode || 'hourly'` (beds may not carry billing_mode — use ward's), `dayRate = Number(bed.price_per_day) > 0 ? bed.price_per_day : ward.price_per_day`. When `mode==='daily'`:
```js
const flags = clinicFlagsSync();           // loaded at view init; import from ../clinic-flags.js
const days  = daysStayed(a.admitted_at, a.discharged_at, !!flags.charge_discharge_day);
const grossCharge = days * Number(dayRate || 0);
// UI: show `${days} дн. × ${fmt(dayRate)}` instead of hours; net applies accommodation_discount_percent as today.
```
Keep the hourly branch unchanged for `mode==='hourly'`. Load `service_types`/wards already loaded; ensure `wards` select includes `billing_mode, price_per_day` and `beds` includes `price_per_day` (extend the existing `.select(...)` in `loadWardsAndBeds`).

- [ ] **Step 5: Apply the same day-based amount in the discharge charge** (the code that writes the accommodation `invoice_item`/`admission_services` at discharge): compute the final `days`/`grossCharge` with `daysStayed(admitted_at, discharged_at, chargeDischargeDay)` when daily, else keep hours.

- [ ] **Step 6: Bump `beds.js` version + `node --check`.**

- [ ] **Step 7: Verify**
  - Set a ward daily: `PATCH wards?id=eq.<wardId> {"billing_mode":"daily","price_per_day":300000}`.
  - Admit a test patient to a bed in that ward; the accommodation card shows "N дн. × 300 000".
  - Discharge after crossing a calendar date; verify the invoice accommodation line = `days × 300000` (days per the discharge-day flag).
  - Confirm an **hourly** ward still bills by hours (regression).

---

## Phase 3 — Unified drug orders (bill + stock)

### Task 3.1: Gateway — atomic administer-drug endpoint

**Files:** Modify `/opt/easymed-api/app/easymed_client.py`, `/opt/easymed-api/app/main.py`

- [ ] **Step 1: Back up both gateway files.**

- [ ] **Step 2: Confirm the real columns** of `med_administrations`, `stock_movements`, `visit_services`, `admission_services`, `item_stock` (they were empty on read — introspect via the SPA usages / an insert dry-run), so the insert bodies are correct:
```bash
ssh root@45.77.242.169 "grep -rniE \"med_administrations|stock_movements\" /var/www/easymed.uz/js/admin/views/pharmacy.js /var/www/easymed.uz/js/admin/views/beds.js /var/www/easymed.uz/js/admin/views/service-workspace.js | grep -iE 'insert|select|\.from' | head"
```
Expected: the column sets used when the SPA reads/writes these tables. Use them verbatim in Step 3.

- [ ] **Step 3: Add `administer_drug()` to `easymed_client.py`** (append). It writes three rows; if any fails it attempts to roll back the prior inserts (best-effort, since PostgREST isn't a single transaction — a follow-up is a DB RPC if strict atomicity is required; note in code):
```python
async def administer_drug(company_id: str, payload: dict) -> dict:
    """Record + bill + deduct stock for one drug administration.
    payload: {clinic_item_id, quantity, branch_id, context:'visit'|'admission',
              visit_id?|admission_id?, dose?, notes?, administered_by?}.
    ADMINISTER_DRUG_V1."""
    import httpx as _httpx
    from datetime import datetime, timezone
    ci_id = payload["clinic_item_id"]; qty = float(payload["quantity"])
    async with _httpx.AsyncClient(timeout=15.0) as c:
        item = (await c.get(f"{config.EASYMED_URL}/rest/v1/clinic_items",
                headers=_h(), params={"select": "id,name,price,unit", "id": f"eq.{ci_id}", "limit": "1"})).json()
        if not item:
            raise ValueError("clinic_item not found")
        price = float(item[0].get("price") or 0); total = round(price * qty, 2)
        created = {}
        H = {**_h(), "Content-Type": "application/json", "Prefer": "return=representation"}
        # 1) clinical log
        med = {"clinic_item_id": ci_id, "quantity": qty, "company_id": company_id,
               "administered_at": datetime.now(timezone.utc).isoformat(),
               "dose": payload.get("dose"), "notes": payload.get("notes"),
               "administered_by": payload.get("administered_by")}
        if payload.get("admission_id"): med["admission_id"] = payload["admission_id"]
        if payload.get("visit_id"): med["visit_id"] = payload["visit_id"]
        r = await c.post(f"{config.EASYMED_URL}/rest/v1/med_administrations", headers=H, json=med)
        r.raise_for_status(); created["med"] = r.json()[0]
        # 2) billing line — admission_services (stationary) or visit_services (outpatient)
        line_tbl = "admission_services" if payload.get("context") == "admission" else "visit_services"
        line = {"clinic_item_id": ci_id, "quantity": qty, "unit_price": price, "total": total,
                "company_id": company_id, "status": "queued"}
        line["admission_id" if line_tbl == "admission_services" else "visit_id"] = \
            payload.get("admission_id") or payload.get("visit_id")
        r = await c.post(f"{config.EASYMED_URL}/rest/v1/{line_tbl}", headers=H, json=line)
        r.raise_for_status(); created["line"] = r.json()[0]
        # 3) stock movement (−qty)
        mov = {"item_id": ci_id, "branch_id": payload.get("branch_id"), "qty": -qty,
               "reason": "administration", "company_id": company_id}
        r = await c.post(f"{config.EASYMED_URL}/rest/v1/stock_movements", headers=H, json=mov)
        r.raise_for_status(); created["movement"] = r.json()[0]
        return created
```
> Adjust column names in Step 3 to match Step 2's findings before deploying.

- [ ] **Step 4: Add the route in `main.py`** (after `current_em_user`):
```python
@app.post("/api/v1/inpatient/administer-drug")
async def administer_drug_route(body: dict, em: dict = Depends(current_em_user)):
    """Record + bill + stock-deduct one drug administration for the caller's company."""
    for k in ("clinic_item_id", "quantity"):
        if not body.get(k):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{k} required")
    try:
        return await easymed_client.administer_drug(em.get("company_id"), body)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"easymed unreachable: {e}")
```

- [ ] **Step 5: AST check + restart + route check.**
```bash
ssh root@45.77.242.169 'cd /opt/easymed-api && venv/bin/python -c "import ast;[ast.parse(open(\"app/\"+f).read()) for f in (\"easymed_client.py\",\"main.py\")];print(\"AST OK\")" && systemctl restart easymed-api.service && sleep 4 && curl -s -o /dev/null -w "administer route: %{http_code}\n" -X POST http://127.0.0.1:8001/api/v1/inpatient/administer-drug'
```
Expected: `AST OK`; `administer route: 403` (exists, needs auth).

- [ ] **Step 6: Data test with the service key** — pick a real `clinic_item` (is_drug) + branch + an active admission, call `administer_drug` directly, then assert the three rows exist and `item_stock` dropped:
```bash
ssh root@45.77.242.169 'cd /opt/easymed-api; set -a; . ./.env; set +a; venv/bin/python - <<PY
import asyncio; from app import easymed_client as e
# fill ids from the cleveland clinic:
r=asyncio.get_event_loop().run_until_complete(e.administer_drug("cf38df6f-449d-4db1-b483-f13cafa02627",
  {"clinic_item_id":"<DRUG_ID>","quantity":1,"branch_id":"<BRANCH_ID>","context":"admission","admission_id":"<ADM_ID>"}))
print({k:r[k].get("id") for k in r})
PY'
```
Expected: three ids printed; then verify `stock_movements` has the −1 row and `item_stock.qty_on_hand` decreased. (Delete the test rows afterward.)

### Task 3.2: SPA — "Give drug" action (workspace, patient card, bed detail)

**Files:** Modify `js/admin/views/service-workspace.js` (the «Назначения (в клинике)» card), `js/admin/views/beds.js` (bed/admission detail), `js/admin/views/patient-card.js`. Create a small shared helper `js/admin/give-drug.js`.

- [ ] **Step 1: Back up all three + create the helper**
```js
// Shared "give drug" flow: pick a clinic drug + qty → gateway administer-drug. GIVE_DRUG_V1.
import { gw } from './gateway.js';
import { supabase } from './supabase.js';
import { toast } from './ui.js';
import { currentClinicId } from './tenant-tables.js';
export async function giveDrug({ context, admissionId, visitId, branchId, onDone }) {
    const cid = currentClinicId();
    const { data: drugs } = await supabase.from('clinic_items')
        .select('id, name, unit, price').eq('company_id', cid).eq('is_drug', true).eq('active', true).order('name');
    // …render a minimal modal: searchable <select> of drugs + qty input → on confirm:
    // await gw('/inpatient/administer-drug', { method:'POST',
    //   body:{ clinic_item_id, quantity, branch_id: branchId, context, admission_id: admissionId, visit_id: visitId }})
    // then toast('Препарат назначен и списан') and onDone?.().
}
```
(Implement the modal with the app's `h()` helpers, matching the existing modal style in `service-picker-modal.js`.)

- [ ] **Step 2:** In `service-workspace.js`, add a **"Выдать препарат"** button to the «Назначения (в клинике)» card (near `prescriptionsClinicCard`, ~line 289/416) → `giveDrug({ context:'visit', visitId: ctx.visitServiceId, branchId })`.

- [ ] **Step 3:** In `beds.js`, add a **"Выдать препарат"** button in the admission/bed detail → `giveDrug({ context:'admission', admissionId: a.id, branchId })`.

- [ ] **Step 4:** In `patient-card.js`, add the same action on an active admission row.

- [ ] **Step 5: Bump versions of all edited files + `node --check` each.**

- [ ] **Step 6: Verify in the browser** — from the doctor workspace and from a bed detail, give a drug: it appears on the invoice, `item_stock` drops, and `med_administrations` logs it. Confirm the negative-stock warning path (give more than on hand).

---

## Phase 4 — Prescriptions

### Task 4.1: Stationary Rx → administration handoff

**Files:** Modify `js/admin/views/admission-modal.js` (it already surfaces `payload.prescriptions` ~line 708–731).

- [ ] **Step 1: Back up.**

- [ ] **Step 2:** For each prescription row shown from the doctor's `payload.prescriptions`, add a **"Выдать"** button that opens `giveDrug({ context:'admission', admissionId, branchId })` pre-filtered to the matching `clinic_item` by name (best-effort match; fall back to the full drug list). This connects the free-text Rx to the billed administration.

- [ ] **Step 3: Bump version + `node --check` + verify** — during an admission, a doctor's Rx line has a "Выдать" action that records + bills + deducts stock.

### Task 4.2 (OPTIONAL — confirm scope before doing): Rx drug autocomplete

**Files:** Modify `js/admin/views/service-workspace.js` (`openPrescriptionDialog`, ~line 2036).

- [ ] **Step 1:** Add a datalist/autocomplete on the Rx `name` input sourced from `clinic_items` (is_drug) for the clinic, so free-text prescriptions align with the clinic's stock. Keep free typing allowed. Only build this if the user confirmed it's in-scope for launch (spec marks it optional).

---

## Self-review notes

- **Spec coverage:** Feature 1 → Tasks 1.1–1.4; Feature 2 → Task 2.1; Feature 3 → Tasks 3.1–3.2; Feature 4 → Tasks 4.1–4.2; DB migration → Phase 0. All spec sections mapped.
- **Isolation:** no task calls `create_catalog_service` or writes to `MEDCORE_URL`; custom services save `core_service_id=null`; Symptex untouched. Confirmed in Task 1.3/1.4.
- **Consistency:** `clinicFlags()`/`clinicFlagsSync()` from `clinic-flags.js`, `giveDrug()` from `give-drug.js`, gateway `company_flags()`/`administer_drug()` — names used identically across tasks.
- **Known soft spot:** Task 3.1 is best-effort atomic (PostgREST ≠ one transaction). If the clinic needs strict atomicity, follow up with a Postgres RPC (`supabase.rpc`) doing the three writes in one function — noted, out of scope for v1.
- **Column-name risk:** Tasks 2.1 Step 2, 3.1 Step 2 require reading the live code/columns before writing inserts (`med_administrations`, `stock_movements`, `admission_services` fields) — these steps are explicit.
