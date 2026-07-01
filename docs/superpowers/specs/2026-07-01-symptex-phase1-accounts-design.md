> ⚠️ **SUPERSEDED (2026-07-01).** This draft was written against the STALE copy `/var/www/symptex`. The LIVE site runs from `/var/www/symptex-next`, which already has a mature Supabase schema (`users` with `password_hash`+`roles[]`, `clinics`, `doctors`, `registrator_clinics`, `invite_tokens`, `api_keys`, …). The `sx_accounts`/`sx_clinics`/`sx_doctors` design below is WRONG — do not build it. See the revised spec: `2026-07-01-symptex-phase1-accounts-design-v2.md`.

# Symptex — Phase 1: Accounts & Identity (design)

**Date:** 2026-07-01 · **Status:** SUPERSEDED by v2
**Owner-facing goal:** real logins for clinics, doctors, and registrators, plus admin/clinic screens to create those accounts. This is the foundation the rest of the Symptex build depends on.

---

## 1. Context

Symptex is a Flask app (`/var/www/symptex` on server 45.77.242.169) with:
- **Static panel shells** already scaffolded for `admin`, `clinic`, `doctor`, `registrator` (routes + `content.PANEL_TABS`), rendering placeholder content.
- **Stub auth**: `app/auth.py` uses a file store (`data/users.json`) with Werkzeug password hashes and Flask sessions. One `admin` account exists. The file explicitly anticipates being swapped for a DB/gateway backend "with the decorators and session shape unchanged."
- **Read-only medcore link**: `app/services/core_gateway.py` reads the published catalog (clinics, doctors, services, departments, availability) from medcore CORE via the EasyMed gateway (`GATEWAY_API_URL` + system partner token). No write path.
- **Its own Supabase** (project `ydcpwtwhbetkbwhgxizv`) with credentials present in `.env` (`SUPABASE_URL`, `SUPABASE_KEY` service key, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` PAT, `SUPABASE_PROJECT_REF`) but **not yet used by the app** ("site first, API later").

This is the first of a 4-phase build (owner-approved decomposition):
1. **Accounts & login** ← this spec
2. Clinic & doctor profiles + services (standalone clinics)
3. Clinic API (Symptex-as-a-database, 3 languages)
4. Admin statistics (metrics TBD by owner)

## 2. Goal & non-goals

**Goal:** every user type (admin, clinic, doctor, registrator) can log in to the correct panel with a phone number + password; admins can create clinic/doctor/registrator accounts; clinics can create doctor/registrator accounts scoped to their own clinic.

**In scope (Phase 1):**
- Phone + password login, backed by Symptex's own Supabase.
- Minimal `sx_clinics` / `sx_doctors` entity records (names + medcore link) so accounts can attach to something.
- Admin "Users" management (create + reset password + deactivate) for clinics/doctors/registrators.
- Clinic-scoped staff management (create doctor/registrator for own clinic).
- Forced password change on first login.
- Migration of the existing file-admin into the DB; break-glass env admin.

**Out of scope (later phases):** rich clinic/doctor profile fields, services picker, standalone-clinic catalog display (Phase 2); public clinic API (Phase 3); statistics (Phase 4); patient accounts; SMS/email delivery; self-service signup; giving existing EasyMed clinics a Symptex login (the model supports it via `core_clinic_id`, but Phase 1 admin-create produces standalone clinics only).

## 3. Chosen approach

**Custom accounts in Symptex's own Supabase, keeping Flask sessions + Werkzeug hashing** (the swap `auth.py` was designed for).

Rejected alternatives:
- *Supabase Auth (auth.users)* — phone login implies SMS OTP (conflicts with "creator sets the password"); larger rewrite from server-side sessions to JWT. Overkill for top-down-created staff accounts.
- *Reuse EasyMed/medcore identity* — standalone (non-EasyMed) clinics have no EasyMed account, breaking the "Symptex without EasyMed" requirement; medcore write endpoints need an EasyMed JWT, not the partner token.

**Access pattern:** the Flask **server** reads/writes Symptex's Supabase with the **service key** (server-side only; the browser talks to Flask, never to Supabase). Table creation (DDL) uses the Management API with the PAT (`SUPABASE_ACCESS_TOKEN`), the same pattern already proven on EasyMed.

## 4. Data model (3 new tables, Symptex Supabase)

### `sx_accounts` — logins
| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| phone | text unique not null | normalized, e.g. `+998901234567` |
| password_hash | text not null | Werkzeug pbkdf2 |
| role | text not null | check in (`admin`,`clinic`,`doctor`,`registrator`) |
| display_name | text not null | |
| clinic_id | uuid null | → `sx_clinics.id` |
| doctor_id | uuid null | → `sx_doctors.id` |
| must_change_password | boolean not null default true | |
| active | boolean not null default true | |
| lang | text not null default 'ru' | |
| created_by | uuid null | → `sx_accounts.id` |
| created_at | timestamptz default now() | |
| last_login_at | timestamptz null | |

Link rules (enforced in app; DB CHECK where practical): `clinic` → `clinic_id` set; `doctor` → `doctor_id` and `clinic_id` set; `registrator` → `clinic_id` set; `admin` → links null.

### `sx_clinics` — Symptex-side clinic records
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name_ru | text not null | |
| name_uz | text null | |
| name_en | text null | |
| core_clinic_id | uuid null | medcore clinic id; null = standalone |
| origin | text not null default 'symptex' | check in (`symptex`,`easymed`) |
| active | boolean not null default true | |
| created_by | uuid null | |
| created_at | timestamptz default now() | |

### `sx_doctors` — Symptex-side doctor records
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| clinic_id | uuid not null | → `sx_clinics.id` |
| full_name_ru | text not null | |
| full_name_uz | text null | |
| full_name_en | text null | |
| core_doctor_id | uuid null | medcore doctor id; null = standalone |
| active | boolean not null default true | |
| created_at | timestamptz default now() | |

Indexes: unique `sx_accounts(phone)`; `sx_accounts(clinic_id)`; `sx_doctors(clinic_id)`.
RLS: **enabled, service-role only** on all three (the browser never reaches Supabase; the Flask server is the only client).

## 5. Components

- **`app/db.py` (new)** — thin server-side Supabase client (PostgREST + service key): `select/insert/update` helpers. Single purpose: DB access; depends on `SUPABASE_URL` + `SUPABASE_KEY`.
- **`app/auth.py` (rewrite internals)** — `_load/_save/find_by_username/create_user/verify` re-pointed from the JSON file to `sx_accounts` via `db.py`. Public functions, decorators (`login_required`, `role_required`), and the session shape stay the same, **plus** the session now also carries `clinic_id`, `doctor_id`, `must_change_password`. Login identifier becomes `phone` (not `username`). Add `set_password`, `reset_password`.
- **`app/services/accounts.py` (new)** — account/entity creation use-cases with authorization + scoping: `create_clinic_account`, `create_doctor_account`, `create_registrator_account`, `reset_password`, `deactivate`. Each checks the caller's role and clinic scope. Single purpose: the write side of identity.
- **`app/blueprints/panel/__init__.py`** — add POST routes: create account (admin + clinic, scope-checked), reset password, deactivate, first-login password change. Render the Users/Doctors/Staff tabs with real data.
- **Templates** — admin `users` tab (list + "create account" form), clinic `doctors`/staff tab (create form), first-login password-change screen. Login page exists (switch label username→phone).
- **Migration** — `migrations/` SQL creating the 3 tables + indexes + RLS, applied via Management API PAT.

## 6. Flows

**Login:** phone + password → normalize phone → look up `sx_accounts` (active) → `check_password_hash` → set session (`uid`, `roles=[role]`, `display_name`, `clinic_id`, `doctor_id`, `must_change_password`, `lang`) → if `must_change_password`, redirect to the change-password screen before any panel → else redirect to `ROLE_HOME[role]`.

**Admin creates an account:**
- *Clinic:* enter clinic name (RU, optional UZ/EN) + phone + initial password → insert `sx_clinics` (origin `symptex`, `core_clinic_id` null) → insert `sx_accounts` (role `clinic`, `clinic_id`).
- *Doctor:* pick an existing `sx_clinics` + name + phone + password → insert `sx_doctors` → insert account (role `doctor`, `doctor_id`, `clinic_id`).
- *Registrator:* pick a clinic + name + phone + password → insert account (role `registrator`, `clinic_id`).

**Clinic creates staff:** same as admin's Doctor/Registrator flows, but `clinic_id` is **forced** to the caller's own `clinic_id`; any attempt to target another clinic is rejected (403). Clinics cannot create clinic or admin accounts.

**First login / password change:** `must_change_password=true` forces the change screen; on success, hash the new password, clear the flag.

**Password reset:** admin resets any account; clinic resets only its own staff. Sets a new initial password (creator-provided) and `must_change_password=true`.

**Deactivate:** admin (any) / clinic (own staff) sets `active=false`; inactive accounts cannot log in.

## 7. Security

- Passwords hashed with Werkzeug pbkdf2; never stored or logged in plaintext. Phone normalized to a single canonical format before store/compare.
- Service key stays server-side; the browser only ever talks to Flask. RLS enabled service-role-only as defense-in-depth.
- Every account/staff mutation re-checks the caller's role and (for clinics) clinic scope on the server — never trust a form-supplied `clinic_id`.
- Login rate-limited (per-IP + per-phone); Flask session cookies `Secure`+`HttpOnly`+`SameSite=Lax`; CSRF tokens on all POST forms.
- Migration seeds the current file `admin` into `sx_accounts`; an env-based break-glass admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, already in config) remains as a fallback login so the owner can't be locked out — the login form's identifier field accepts this admin username in addition to phone numbers, and the break-glass check runs only when the DB has no matching account. The `data/users.json` file is retired (kept on disk as backup, not read).

## 8. Acceptance criteria (the gate)

**Automated (pytest):**
1. Migration creates `sx_accounts`/`sx_clinics`/`sx_doctors` with RLS enabled.
2. Create clinic/doctor/registrator accounts; each links correctly.
3. Login succeeds with right phone+password; wrong password rejected; inactive account rejected.
4. First login sets `must_change_password`; after change it's cleared.
5. A clinic account creating a doctor/registrator for **another** clinic's `clinic_id` is rejected (403); its own clinic succeeds.
6. Clinic cannot create `clinic` or `admin` accounts.
7. Admin reset-password works; user logs in with the new password (and is forced to change it).

**Manual click-through:** create a clinic + doctor + registrator; log in as each; confirm each lands on its own panel; confirm the admin Users list shows them; confirm a clinic login only sees its own staff.

## 9. Risks / notes
- Phone normalization must be consistent between create and login (single helper, unit-tested).
- Keep `role_required`/session shape backward-compatible so the existing panel routes keep working during the swap.
- This phase deliberately leaves the panels mostly shells beyond login + account management; Phase 2 fills them in.
