# EasyMed — Roles & Employees Reference Handout

> **Purpose:** a self-contained reference for how EasyMed handles **roles, permissions, and employees**. Paste this into a new chat as context when working on anything touching access control, the employee editor, or the roles UI. Everything here is verified against the live code on `45.77.242.169` (2026-07-10).

## 0. TL;DR mental model

- A logged-in user = a `public.users` row. The app turns it into an **actor** (`actorFromUser`) with three derived flags: `is_super_admin`, `is_admin`, `is_doctor`.
- **Permissions** come from the user's **role** (`users.role_id` → `roles.permissions` JSONB). A role lists which **modules** (sections) it can touch and at what **level** (`viewer` / `editor` / `admin`).
- **Full access** is not a role — it's a state: super admins and clinic admins bypass the role and see everything.
- **"Doctor"** and **"Head cashier"** are NOT separate systems — a doctor is a capability flag (`is_doctor`), a head cashier is just a role whose **Cashier** module is at **`admin`** level.

---

## 1. Data model

### `public.users` (the employee)
| Column | Meaning |
|---|---|
| `id` | user id |
| `auth_user_id` | link to Supabase Auth (`auth.uid()`) |
| `full_name`, `username`, `phone`, `email`, `photo_url` | identity |
| `role` (text) | legacy classification: `'admin'` / `'doctor'` / role name. **Auto-synced from `role_id` by a DB trigger** (see §5). Drives `is_admin`. |
| `role_id` (fk `roles`) | the granular **permission role** |
| `is_super_admin` (bool) | platform god-mode (migration 045). Set only by the super admin. |
| `is_doctor` (bool) | doctor **capability** — appears in doctor lists, has the consultation workspace |
| `specialty`, `license_number` | doctor fields (also imply doctor) |
| `position_id` (fk `positions`) | job position; a "Doctor" position has `positions.is_doctor=true` |
| `company_id` | the clinic (tenant) |
| `branch_id` + `user_branches` | primary branch + all assigned branches (junction) |
| `active` | soft on/off |

### `public.roles` (the permission role)
| Column | Meaning |
|---|---|
| `id`, `name`, `company_id` | per-clinic role |
| `permissions` (jsonb) | `{ sections: [...keys], levels: {key: 'viewer'|'editor'|'admin'}, patient_tabs: {tab: 'none'|'view'|'edit'|'delete'} }` |

- `sections`: which modules the role can access (permission keys, see §3).
- `levels`: per-key access level. A key in `sections` with **no** explicit level defaults to **`editor`** (NOT admin — delete must be granted explicitly).
- `patient_tabs`: per-tab gating inside the patient card (default = visible).
- **Empty `sections` = fail-closed** → the user is restricted to a `__no_access__` sentinel and lands on the access-denied screen (a misconfigured role is never silently full-access).

### Related tables
`user_branches` (user↔branch), `user_specialties` (user↔specialty_slug, [0]=primary), `positions` (`is_doctor`), `doctor_consultation_prices` (per-doctor consultation pricing), `doctor_profile_entries` (public doctor profile → Symptex).

---

## 2. The three access levels

Stored per-key in `roles.permissions.levels`. `ACCESS_LEVELS = ['viewer', 'editor', 'admin']`.

| Level | Grants |
|---|---|
| `viewer` | read-only |
| `editor` | create / edit |
| `admin` | create / edit / **delete** |

In code (`permissions.js`):
```js
canView(key)   = accessLevelFor(key) !== 'none'
canEdit(key)   = level === 'editor' || level === 'admin'
canDelete(key) = level === 'admin'
```
Full-access actors (`_effective == null`) return `'admin'` for every key.

---

## 3. Permission keys (what a role can be granted)

Top-level modules (`MODULE_GROUPS` in `permissions.js`) — *soon* = built but gated behind "coming soon":

- **Clinical:** `patients`, `requests`, `appointments`, `consultation` (= "My services" / doctor workspace), `labs`, `procedures`, `beds`, `docs-archive`, `pacs` *(soon)*
- **Operations:** `pharmacy` *(soon)*, `cashier`, `marketing` *(soon)*, `callcenter` *(soon)*, `procurement` *(soon)*
- **Insights:** `dashboard`, `reports`, `documents`, `settings`

Settings sub-sections are keyed `settings:<sectionKey>` and generated from `SECTIONS` (table-backed, non-hidden, non-platform-only). Examples: `settings:services`, `settings:service_types`, `settings:service_categories`, `settings:departments`, `settings:wards`, `settings:beds_settings`, `settings:rooms`, `settings:floors`, `settings:users`, `settings:cashiers`, `settings:clinic_items` (Товары и препараты), plus special routes `settings:consultation_types`, `settings:lab_settings`, `settings:doctor_pay`.

Granting `settings` (the home key) implicitly grants any `settings:*` sub-section (`accessLevelFor` inherits the Settings-home level). Nav gating: `isModuleAllowed(navId)`, route gating: `isRouteAllowed(view)`.

---

## 4. Runtime access-decision flow

```
Login / page load
   │
   ▼
rehydrateUserFromSession()          auth.js  — SELECTs the users row.
   │                                 ⚠ MUST include is_doctor (ADMIN_DOCTOR_V3).
   ▼
actorFromUser(userRow)              auth.js  — derives the flags:
   │   is_super_admin = users.is_super_admin === true
   │   is_admin       = role === 'admin' || is_super_admin
   │   is_doctor      = role === 'doctor' || is_doctor === true || specialty || license
   ▼
applyActorPermissions(actor)        admin.js — decides effective access:
   │   1) is_super_admin            → setFullAccess('Super Admin')            [god mode]
   │   2) is_admin && company_id    → setFullAccess('Администратор клиники')  [CLINIC_ADMIN_FULL_ACCESS_V1 — wins over any role]
   │   3) role_id                   → setEffectiveFromRole(role)
   │        · sections present      → _effective = Set(sections)
   │        · sections empty        → __no_access__ sentinel  [ROLE_FAIL_CLOSED_V1]
   │   4) no role_id                → setFullAccess (label 'Doctor' if is_doctor)
   ▼
_effective : Set<key> | null        permissions.js — null = full access
   │
   ▼
accessLevelFor(key) → 'none'|'viewer'|'editor'|'admin'  →  canView / canEdit / canDelete
```

**Data-scoping vs self-identity** (two different questions, two functions in `permissions.js`):
- `scopedDoctorId()` — "whose patients am I limited to?" Returns the user's id for a **pure doctor**; **null** for super admins AND clinic admins (they see all data). Used for query filters (appointments, patients, consultation dashboard).
- `selfDoctorId()` — "which doctor am I?" Returns the user's id whenever `is_doctor` (even if also admin). Used by the consultation **«Мой профиль»** tab so an admin-doctor can edit their own profile.

---

## 5. DB functions & the role-sync trigger (Postgres)

Security-definer helpers (migrations 033/041), used throughout RLS:
- `current_user_is_admin()` → `lower(users.role) = 'admin'` for `auth.uid()`.
- `current_user_company_id()`, `current_user_branches()`, `current_user_id()`, `current_user_is_doctor()`, `current_user_is_super_admin()`.

**The role-text sync trigger (migration 044) — critical gotcha:**
```sql
create trigger trg_sync_users_role_text
  before insert or update of role_id on public.users
  for each row execute function public._sync_users_role_text();
-- _sync_users_role_text(): sets NEW.role := lower(roles.name) of the assigned role_id.
```
⇒ **Assigning a `role_id` overwrites `users.role` text with that role's name.** Assign the "Doctor" role → `users.role` becomes `'doctor'` → `is_admin` turns **off**. This is why making an admin a doctor used to lock them out.

RLS: writing `users.role_id` requires `current_user_is_admin()` (only the clinic owner assigns roles). The client mirrors this (`ROLE_ADMIN_ONLY_V1`) and blocks assigning an owner-equivalent ('admin') role unless you are the owner.

---

## 6. Special roles / states

| Who | How it's determined | What they get |
|---|---|---|
| **Super admin** | `users.is_super_admin = true` | God mode across all clinics; sees platform-only sections |
| **Clinic admin / owner** | `users.role = 'admin'` (+ `company_id`); `_isClinicOwner = is_super_admin \|\| (is_admin && company_id)` | Full access to their clinic — **bypasses the role** (can never be locked out). Only role NOT assignable via the picker (shown as "Администратор клиники — полный доступ"). |
| **Doctor** | `is_doctor` / `role='doctor'` / specialty / license / Doctor position | Consultation workspace, appears in doctor pickers, editable public profile; data scoped to own patients — **unless also an admin** (admins see all) |
| **Head cashier** | a role whose **`cashier`** key is at level **`admin`** (`canDelete('cashier')`) | The "Старший кассир · инкассация дня" workstation: accepts cash handovers, company-wide payments/invoices (`CASHIER_HEAD_GATE_V1` / `CASHIER_HEAD_V2`) |
| **Regular cashier** | role with `cashier` at `editor` | Own shift / own desk (`cashier-shifts.js`) |

**Admin + doctor together** (ADMIN_DOCTOR_V1/V2/V3, 2026-07-10): keep the admin role, set `is_doctor=true` — the user keeps full admin access AND works as a doctor. Requires `is_doctor` in the user-load SELECT.

---

## 7. The Employee editor (`views/employee-editor.js`)

Modal opened from `#settings:users`. Tabs, grouped **Profile** / **Work**:
- **Identity** — name, phone, email, photo (file / webcam / URL). Required: last+first name, phone.
- **Job** — "This employee is a doctor" toggle (adds specialties; for a NON-admin with no role it pre-fills the Doctor role — it will NOT touch an admin's role), department, **Role** picker (owner-only; hidden for admins).
- **License** — license number / expiry.
- **Branches** — which branches they work at (`user_branches`).
- **Employment & salary** — hire date, salary fields.
- **Working hours** — weekly schedule.
- **Services / Consultations / Referral** — services performed, per-doctor consultation prices, referral rates.

Saves to `public.users` (drop-and-retry for columns missing on older DBs), plus `user_branches`, `user_specialties`, `doctor_consultation_prices`. Role assignment is owner-gated client-side and DB-side.

---

## 8. The Roles editor (`#settings:roles`)

- Roles are a generic CRUD section (`sections.js` → `roles`), edited via the grouped form. The `permissions` field is a **`section_picker`** widget: a matrix of every permission key (from `permissionGroups()`) where you set each to Viewer / Editor / Admin (or off).
- Built-in roles may be view-only/locked (e.g. the `roles` table's `locked` flag; `CASHIER_ROLE_LOCK_V1`).
- To make a **Head cashier**: set the role's **Cashier** module to **Admin**. To make a plain cashier: **Editor**.
- To restrict a role: only tick the modules it needs; leave delete (Admin) off unless required.

---

## 9. File map

| File | Responsibility |
|---|---|
| `js/admin.js` | Bootstrap; `rehydrateUserFromSession` → `actorFromUser` → `applyActorPermissions`; routing + nav gating (`isModuleAllowed`/`isRouteAllowed`); `firstAllowedView()` |
| `js/admin/auth.js` | `verifyLogin`, `rehydrateUserFromSession` (**user SELECT — include `is_doctor`**), `actorFromUser` (derives is_admin/is_doctor) |
| `js/admin/permissions.js` | The permission engine: `_effective`, `accessLevelFor`, `canView/canEdit/canDelete`, `permissionGroups`, `setEffectiveFromRole`, `scopedDoctorId`, `selfDoctorId`, `canViewPatientTab` |
| `js/admin/views/employee-editor.js` | Employee create/edit modal |
| `js/admin/views/section-crud.js` | Roles list + role editor (`section_picker`) + generic CRUD + `isClinicOwner`, `currentPermKey`, `canEdit/canDelete` gating of buttons |
| `js/admin/sections.js` | `SECTIONS` defs incl. `roles`, `users`, `cashiers`; `FK_LABEL_COLUMN` |
| `js/admin/views/cashier-shifts.js` | Cashier shift + head-cashier workstation (`CASHIER_HEAD_*`) |
| DB migrations | `033`/`041` RLS helpers (`current_user_*`), `044` role-text sync trigger, `045` `is_super_admin`, roles/users RLS |

---

## 10. Gotchas (learned the hard way)

1. **Role-text sync trigger** (`044`) overwrites `users.role` from `role_id` on every write → assigning the Doctor role flips `role='doctor'` → `is_admin` off. To keep someone admin, don't reassign their role.
2. **`is_admin` has no column** — it's `role text = 'admin'`. The clinic-admin full-access bypass (`CLINIC_ADMIN_FULL_ACCESS_V1`) is what keeps owners from being locked out.
3. **`is_doctor` must be in the user-load SELECT** (`ADMIN_DOCTOR_V3`) or the app can't tell an admin is also a doctor.
4. **Admin ≠ doctor was hardcoded** (`isDoctor = !isAdmin && …`) — fixed so a user can be both.
5. **Unlisted key defaults to `editor`, not admin** — delete rights must be granted explicitly (fixes "Delete visit visible for registrars").
6. **`scopedDoctorId` (data scope) ≠ `selfDoctorId` (self identity)** — admins are null for scope but still identify as their own doctor.
7. **Head cashier = Cashier@Admin level**, not a named role.
8. **`permissions.js` / `auth.js` are imported version-less** → after editing them, a **hard refresh** (Ctrl+Shift+R) is needed (the deep modules aren't cache-busted by the loader version).

---
*Generated 2026-07-10 from the live EasyMed admin (`/var/www/easymed.uz/js/admin`) + Supabase migrations. See the companion `roles-employees-reference.html` for the interactive wireframe.*
