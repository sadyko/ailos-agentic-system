# Symptex — Phase 1: Accounts & Identity (design v2 — on the real schema)

**Date:** 2026-07-01 · **Status:** revised after inspecting the LIVE app · supersedes v1
**Target:** `/var/www/symptex-next` (live, gunicorn `127.0.0.1:8011`). Do NOT build in `/var/www/symptex` (idle copy; still serves the bot subdomains).

**Owner-facing goal (unchanged, already approved):** phone+password logins for clinic/doctor/registrator; admin creates clinic/doctor/registrator; a clinic creates doctor/registrator for its own clinic; forced password change on first login. What changed from v1 is only the *substrate*: build on the tables that already exist, not new `sx_` tables.

---

## 1. Corrected context

The live app is mature. Relevant existing pieces:
- **Supabase client** `app/extensions.py` → `sb()` (service client, HTTP/1.1 pinned). Config key `SUPABASE_SERVICE_KEY`.
- **`auth.py`** already has `normalize_phone` (UZ E.164), `login_user`/`current_user`/`role_required` (session `roles` is a list), a file-store seed-admin `verify(username,password)`, plus phone-OTP + Telegram auth that read/write the Supabase `users` table.
- **`users`** table: `id, phone, email, password_hash, roles[] (ARRAY), display_name, first_name, last_name, is_active, lang, birth_date, gender, telegram_id, …`. Patients live here already (OTP-created).
- **`clinics`**: `id, name, name_ru, name_uz, slug, phone, email, owner_user_id, owner_doctor_id, clinic_type, is_active, …` (rich profile — fleshed out in Phase 2).
- **`doctors`**: `id, user_id, clinic_id, full_name, full_name_ru, full_name_uz, specialty, …` (rich — Phase 2).
- **`registrator_clinics`**: `user_id, clinic_id, created_at` (a registrator = a user linked to a clinic).
- **`invite_tokens`**, **`api_keys`**, `doctor_clinic_requests` exist for later phases.

All these tables currently have **0 rows**. The doctor/clinic/registrator **panels are mock shells** (routes render templates with no data) and there are **no create/manage POST routes**. So Phase 1 = build login + create-flows + panel lists on the existing schema.

## 2. Scope

**In scope:** phone+password login against `users`; admin create clinic/doctor/registrator; clinic create doctor/registrator (own clinic only); forced first-login password change; account list + deactivate + reset-password; role-gated panels wired to real data for the accounts area.

**Out of scope (later phases):** rich clinic/doctor profile fields + services (Phase 2, the existing columns get edited there); the tokened clinic API on `api_keys` (Phase 3); statistics (Phase 4); the `invite_tokens` self-serve invite flow (we use direct creation per the approved "creator sets password"); patient accounts (already handled by OTP); touching the bot subdomains / idle copy.

## 3. Approach (build on existing tables)

- **Identity = the `users` table.** An account is a `users` row with the appropriate role in `roles[]` and a `password_hash`. Admin = `'admin'` in `roles` (or `ADMIN_TELEGRAM_IDS`, already supported). Clinic/doctor/registrator = their role in `roles`.
- **Entities already exist:** clinic account ↔ `clinics.owner_user_id`; doctor account ↔ `doctors.user_id` (+ `doctors.clinic_id`); registrator ↔ `registrator_clinics(user_id, clinic_id)`.
- **One tiny additive migration:** add `users.must_change_password boolean not null default false` (forced first-login change). Nullable/defaulted → safe on the shared table.
- **Reuse** `sb()`, `normalize_phone`, `login_user`, `role_required`, and the existing username/password login form.

Rejected (v1): new `sx_accounts`/`sx_clinics`/`sx_doctors` — would duplicate/conflict with the live schema.

## 4. Components

- **`app/auth.py` (extend)** — add `verify_password(identifier, password)`: try the file-store seed admin (existing `verify`) first; else `normalize_phone` → look up `users` by phone via `sb()` → `check_password_hash(row['password_hash'], password)` and `is_active` → return the user dict (same shape `login_user` expects). Add `set_password(user_id, new_pw)` (writes `password_hash` + clears `must_change_password`). Add `must_change_password` into `login_user`/`current_user` session shape.
- **`app/blueprints/auth/__init__.py` (modify)** — the `/login` POST calls `verify_password` instead of `verify` (covers admin AND the new phone+password roles). No other change (OTP/Telegram untouched).
- **`app/services/accounts.py` (create)** — use-cases with authorization + clinic scoping, all via `sb()`:
  - `create_clinic_account(actor, name_ru, phone, password, …)` — admin only: insert `clinics`, insert `users` (roles `['clinic']`, hashed pw, `must_change_password=true`), set `clinics.owner_user_id`.
  - `create_doctor_account(actor, clinic_id, full_name_ru, phone, password)` — admin (any clinic) / clinic (forced own clinic): insert `users` (roles `['doctor']`), insert `doctors(user_id, clinic_id, full_name_ru)`.
  - `create_registrator_account(actor, clinic_id, display_name, phone, password)` — same scoping: insert `users` (roles `['registrator']`), insert `registrator_clinics(user_id, clinic_id)`.
  - `reset_password(actor, user_id, new_pw)`, `deactivate(actor, user_id)`, `list_accounts(actor)` — admin sees all non-patient accounts; clinic sees only its own doctors/registrators (join via `doctors.clinic_id` / `registrator_clinics.clinic_id`).
  - Guards: duplicate-phone rejected; password ≥ 6; clinic cannot create clinic/admin; clinic scope forced server-side (never trust form `clinic_id`).
- **`app/blueprints/panel/__init__.py` (modify)** — add POST routes (`/users/create`, `/users/<id>/reset`, `/users/<id>/deactivate`, `/account/password`), a `before_request` first-login gate, and pass real account/clinic lists to the admin + clinic templates.
- **Templates** — replace the mock Users tab in `panel/admin.html` and the staff tab in `panel/clinic.html` with a create form + real list (match existing `_partials/panel_macros.html`); add `panel/_change_password.html`; relabel the login field username→phone.
- **Migration** — `migrations/2026-07-01_must_change_password.sql` applied via the Management API PAT (same applier pattern), plus enabling password-login safety (no RLS change needed — server uses the service key).

## 5. Flows

- **Login:** phone+password → `verify_password` → session (`roles`, `clinic_id` if resolvable, `must_change_password`) → if `must_change_password`, force the change screen → else `ROLE_HOME[role]`.
- **Admin creates** clinic/doctor/registrator via the Users tab form (role picker; clinic picker for doctor/registrator). **Clinic creates** doctor/registrator via its Doctors/Staff tab (scope forced to own clinic).
- **First login / reset:** `must_change_password` gate; admin resets any, clinic resets its own staff (sets a new pw + `must_change_password=true`).
- **Deactivate:** sets `users.is_active=false`; inactive can't log in.

## 6. Security

- Werkzeug hashing; phones normalized via the existing `normalize_phone`. Service key stays server-side (`sb()`), browser never touches Supabase. Every mutation re-checks caller role + clinic scope server-side. Login rate-limited (existing `flask_limiter`); CSRF via existing Flask-WTF; the file-store seed admin stays as break-glass. Adding accounts to the shared `users` table reuses its existing constraints; we only ever set `roles` we're authorized to.

## 7. Acceptance criteria (the gate)

**Automated (pytest, mock `sb()`):** verify_password success/wrong-pw/inactive; break-glass admin; phone-duplicate rejected; clinic-creates-doctor forced to own clinic; clinic cannot create clinic/admin; reset sets must_change; list scoping (clinic sees only own staff).
**Live smoke (create → login → cleanup):** create a clinic via the service, log in with its phone+password, assert role + must_change, then clean up.
**Manual click-through:** admin creates clinic → doctor → registrator; log in as each (forced pw change → correct panel); clinic sees only its own staff.

## 8. Deploy note (blue-green)

Build + test in `/var/www/symptex-next` (it IS the live tree on :8011). Commit per task (init git there first, secrets ignored). Gunicorn `--preload` won't pick up changes until `systemctl restart symptex-next`, so the site is unaffected until that final step. The idle `/var/www/symptex` (:8000, bots) is left untouched.
