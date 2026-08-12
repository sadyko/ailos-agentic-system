# Symptex Admin — Piece 1: Foundation, Clinic List & Dashboard v1

**Date:** 2026-08-12
**Status:** design approved by owner, ready for planning
**Scope of this spec:** Piece 1 only. Pieces 2–8 are listed for context and get their own specs.

---

## 1. Plain-English summary

A Windows program called **Symptex Admin**, opened from a Desktop icon, in its own window.
The owner logs in with a phone number and password and sees two things:

1. **Dashboard** — how the platform is doing, built only from data the system already
   records: clinics, doctors, services, registered users, bookings over time.
2. **Clinics** — a searchable list of every Symptex clinic with its status, and a
   read-only detail view.

Nothing is editable yet. Piece 1 exists to build the machine that every later piece
plugs into: the program itself, the login, the look, and the connection to the server.

---

## 2. Programme context

The owner's request ("CMS, clinics, payments, pages") decomposes into eight pieces,
each shipped separately. Agreed order:

| # | Piece | Outcome |
|---|-------|---------|
| **1** | **Foundation + clinic list + dashboard v1** | *This spec.* |
| 2 | Tracking switch-on (website side) | Cookie consent banner, privacy policy page, page-view recording, visitor sessions, login attempts. Starts collecting early so history accumulates. |
| 3 | Onboarding + Excel price import + branches | Wizard from nothing to a live clinic; import a clinic's real price file; multi-address clinics. |
| 4 | Clinic editor | Edit any clinic completely from admin — profile, photos, hours, doctors, services, prices. |
| 5 | Subscriptions | Plans, activation with start/end dates, auto-hide on expiry, plan limits, expiring-soon list. |
| 6 | Statistics dashboard v2 | Traffic, top pages, sources, conversion, active sessions with force-logout, login-attempt security log. |
| 7 | Pages CMS | Static pages, home/landing blocks, service & category texts + SEO. |
| 8 | Blog CMS | Articles read from and written back to the owner's Google Sheets, plus photo storage, internal links, publish switch, cache refresh. |

**"Payments" was explicitly narrowed by the owner to subscription activation only** —
no invoicing, no payment gateway, no revenue reporting.

---

## 3. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Relationship to the live site | Local dev copy of the live app on the Desktop; deploy to the server when a piece is finished | Nothing on symptex.uz breaks while building |
| Admin UI style | A new React desktop app is the real tool; the existing Jinja admin console is left alone as a fallback | Owner's choice (option B) |
| Packaging | A real installed Windows program with a Desktop icon | Owner's choice |
| Database | The live Symptex Supabase (`ydcpwtwhbetkbwhgxizv`) | Owner's choice; a CMS that edits a practice database is not a CMS |
| Data access path | Desktop app → Admin API on the Symptex server → database | The database also holds patient phone numbers and bookings. Putting the service key on a laptop hands over all of it with no audit trail. |
| Blog storage | Stays in Google Sheets | Owner's choice; n8n keeps working unchanged |
| Users | One owner account. No roles, no approval workflow | Owner's choice — YAGNI |
| Page-view data | First-party tracking into our own database | Owner's choice |

---

## 4. Architecture

```
  Symptex Admin  (Windows, Electron + React)
        │  HTTPS, Bearer token
        ▼
  /api/admin/v1   (new Flask blueprint inside symptex-next)
        │
        ├──► Supabase (service key — stays on the server)
        ├──► Google Sheets  (piece 8; service account stays on the server)
        └──► Supabase Storage (pieces 4 & 8)
```

### 4.1 Two folders on the Desktop

| Folder | Contents | Git |
|---|---|---|
| `C:\Users\user\Desktop\symptex-admin` | The desktop program (Electron + React + TypeScript) | New repo |
| `C:\Users\user\Desktop\symptex-next` | Clone of the live website's code, for local running and for the Admin API | `origin = ssh://root@45.77.242.169/var/www/symptex-next` |

### 4.2 Server-side layout (in `symptex-next`)

```
app/blueprints/admin_api/__init__.py   NEW  — routes, mounted /api/admin/v1
app/services/admin_auth.py             NEW  — token issue/verify/revoke
app/services/stats.py                  NEW  — dashboard metrics (extracted, see 4.3)
app/services/admin_clinics.py          NEW  — clinic list/read for admin
migrations/2026-08-12_admin_api.sql    NEW  — admin_sessions, admin_audit_log
scripts/grant_admin.py                 NEW  — one-off bootstrap (see 8)
tests/test_admin_api.py                NEW
```

### 4.3 One targeted improvement to existing code

`app/blueprints/panel/__init__.py` is already ~400+ lines and holds `_stats_data()`
(line 344), which the dashboard needs. Rather than duplicate it or import a private
function across modules, **extract it into `app/services/stats.py`** with a public
`platform_summary()`. The panel keeps working by calling the new module. This is the
only refactor in Piece 1; no other restructuring.

---

## 5. The Admin API

Mounted at `/api/admin/v1`, registered in `app/__init__.py` and passed to
`csrf.exempt(...)` — mirroring exactly how `clinic_api` is already registered
(`app/__init__.py:138-139`). Token-authenticated, so CSRF does not apply.

### 5.1 Authentication

Deliberately mirrors the proven `services/apikeys.py` pattern rather than inventing one.

- **Login:** `POST /auth/login` `{phone, password}`.
  Verifies with the existing `auth.verify_password(identifier, password)`.
  Rejects unless the user row is `is_active` **and** `"admin"` is in `users.roles`.
- **Token:** opaque string `session_id.secret`. Only `sha256(secret)` is stored, and
  comparison uses `hmac.compare_digest` — same as `apikeys`.
- **Storage:** new table `admin_sessions`.
- **Lifetime:** 30 days; `last_seen_at` updated per request; revocable.
- **Guard:** `@require_admin` decorator sets `g.admin_user`; returns `401` for a
  missing/invalid/expired/revoked token, `403` if the user lost the admin role.
- **Rate limits:** `10 per minute` on login (existing `limiter`), `120 per minute`
  elsewhere. `ProxyFix` is already installed, so the limiter sees real client IPs.

### 5.2 Endpoints (Piece 1)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | `{ok: true, version}` — no auth, for the app's connection check |
| `POST` | `/auth/login` | `{token, expires_at, user:{id, name, phone}}` |
| `POST` | `/auth/logout` | `{ok: true}` — revokes the current session |
| `GET` | `/me` | `{user:{id, name, phone, roles}}` |
| `GET` | `/dashboard/summary` | See 5.3 |
| `GET` | `/clinics` | `{items:[...], total, page, per_page}` — params `q`, `status`, `city`, `page`, `per_page` (default 25, max 100) |
| `GET` | `/clinics/<id>` | One clinic, read-only |

All errors return `{"error": "<message>"}` with a real HTTP status. No endpoint in
Piece 1 writes to business data.

### 5.3 `GET /dashboard/summary`

All figures come from data the system already records — no new tracking is needed
and no figure is estimated.

```json
{
  "totals": {
    "clinics": 0, "clinics_active": 0, "doctors": 0,
    "services_listed": 0, "users": 0, "bookings": 0
  },
  "bookings_by_status": {"pending": 0, "confirmed": 0, "completed": 0, "cancelled": 0},
  "bookings_by_day":   [{"date": "2026-08-01", "n": 0}],
  "new_users_by_day":  [{"date": "2026-08-01", "n": 0}],
  "top_clinics":       [{"clinic_id": "...", "name": "...", "n": 0}],
  "recent_bookings":   [{"id": "...", "clinic_name": "...", "patient_name": "...",
                         "status": "...", "starts_at": null, "created_at": "..."}],
  "window_days": 14,
  "truncated": false
}
```

**No figure here may be a silent sample.** (Corrected 2026-08-12 after review — the
first draft of this spec had `totals.bookings` as an exact count while the status
breakdown and series came from the 3000 most recent rows. Past 3000 bookings the
owner would have read a total that its own breakdown could not reconcile with, with
nothing on the page admitting it was a sample.)

- `bookings_by_status` is **four exact count queries**, one per bucket — not a tally
  of sampled rows.
- The two day series query the 14-day window directly (`created_at >= cutoff`), so
  they are complete for the period rather than whatever fell inside a row cap.
- `top_clinics` is therefore "busiest in the last 14 days", not all-time.
- `window_days` states the period the series and `top_clinics` cover.
- `truncated` is true only if a window query hit its row ceiling, so the UI can warn
  rather than quietly under-report.

- Day series cover the **last 14 days**, zero-filled so the chart has no gaps.
- `top_clinics` is the top 5 by booking count.
- `recent_bookings` is the newest 10.
- `services_listed` counts rows in **`department_services`** — services that clinics
  actually list with a price, not catalog size. (The 1229-row `services` table is
  reference data and is deliberately not reported here.) Checked 2026-08-12:
  `department_services` has no `is_active` column and is never filtered by one
  anywhere in the codebase, so no active-filter is applied.
- `clinics_active` counts `clinics.is_active = true`.
- `totals.bookings` is an **exact count query**. The existing panel version
  (`_stats_data`, line 344) reports `len(rows)` over a query capped at 3000, so it
  silently stops being a total past 3000 bookings; the API must not copy that.
- Bookings with `status = 'unverified'` are excluded everywhere, matching the panel —
  those are captured-but-unconfirmed leads that never reached a clinic.
- Status grouping reuses the existing constants in `services/clinic_services.py`
  (verified 2026-08-12, lines 297–300) so the dashboard and the clinic panel can
  never disagree about what "confirmed" means:
  `BOOKING_NEW = pending|requested|lead`, `BOOKING_CONFIRMED = confirmed|registered`,
  `BOOKING_DONE = completed`, `BOOKING_CANCELLED = cancelled|rejected|no_show`.
  The four JSON keys in `bookings_by_status` are these four groups, not raw statuses.

### 5.4 `GET /clinics`

Scope: the `clinics` table — Symptex's **own** clinics. Clinics that come from the
medcore/EasyMed gateway are managed in EasyMed and are **out of scope**; the list
does not show them.

Per row: `id, name_ru, slug, city, district, clinic_type, is_active, created_at,
logo_url, doctors_n, services_n`.

`doctors_n` and `services_n` are produced by **two aggregate queries for the whole
page**, joined in Python — never one query per row.

`q` matches name / slug / phone, case-insensitively. `status` is `active | inactive |
all` (default `all`). Sorted newest first.

### 5.5 Audit log

New table `admin_audit_log`. A helper `audit(action, entity, entity_id, payload)`
records who did what, when, and from which IP.

Piece 1 has almost nothing to write, so it logs `login`, `login_failed` and `logout`
only. This is deliberate: it establishes the mechanism before pieces 3–5 start
changing real data, and the `login_failed` rows become the first input to piece 6's
security log.

---

## 6. The desktop program

### 6.1 Shell

- **Electron** packaged with **electron-builder** → NSIS installer, Desktop shortcut
  named "Symptex Admin", app icon, own window (no browser chrome).
  Chosen over Tauri because it needs no Rust toolchain on the build machine and
  packaging for Windows is a solved problem; the ~150 MB installer is irrelevant for
  a single-user internal tool.
- `contextIsolation: true`, `nodeIntegration: false`. A preload script exposes one
  narrow surface, `window.symptex`, with exactly: `getToken`, `setToken`,
  `clearToken`, `getEnvironment`, `setEnvironment`.
- The session token is stored with Electron's **`safeStorage`** (OS-level encryption)
  in the app's userData directory — never in `localStorage`, never in the repo.
- **Environment switch:** `Live` (`https://symptex.uz`) or `Local`
  (`http://127.0.0.1:5000`). Live is the default. The current environment is always
  visible in the window title. Non-localhost URLs must be HTTPS; plain HTTP to a
  remote host is refused.

### 6.2 Renderer

Vite + React + TypeScript + Tailwind + shadcn components, on the ailos design system.

- **Brand tokens** are derived from the live site's `static/css/symptex.css` palette
  and written to `src/tokens.ts`, `src/index.css` (`@theme`), and documented in
  `docs/DESIGN_TOKENS.md` in the new repo — before any component is built.
- Calm clinical palette. **Lucide icons only — no emojis anywhere.** Dark mode is
  not built in Piece 1.

### 6.3 Screens

| Screen | Contents |
|---|---|
| **Login** | Phone + password, environment indicator, clear failure messages ("wrong password" vs "cannot reach the server" vs "this account is not an administrator"). |
| **App shell** | Left sidebar: Dashboard, Clinics. Later pieces add entries here. Header shows the logged-in account and a sign-out action. |
| **Dashboard** | Six figure tiles (clinics, active clinics, doctors, services, users, bookings), a 14-day bookings bar chart, a 14-day new-users bar chart, bookings-by-status breakdown, top-5 clinics table, latest-10 bookings table. |
| **Clinics** | Search box, status filter, city filter, paginated table (name, city/district, doctors, services, status, created). Row opens a read-only detail panel. |

Charts follow the `dataviz` skill's rules; they are simple bar charts, not a
dashboard framework.

### 6.4 Module boundaries

```
src/api/client.ts        fetch wrapper: base URL, bearer token, 401 handling, typed errors
src/api/admin.ts         one typed function per endpoint — the only place URLs appear
src/auth/                login screen + session context
src/screens/dashboard/   presentational; receives data, owns no fetching
src/screens/clinics/     presentational; receives data, owns no fetching
src/components/          shared UI on the design system
```

Screens never call `fetch` directly. Swapping the transport touches `src/api` only.

### 6.5 States and error handling

Every screen implements four states explicitly: **loading** (skeletons, not spinners
over stale data), **empty** (says what to do next), **error** (says what went wrong
and offers Retry), **loaded**.

- `401` from any call → the token is cleared and the user is returned to Login with
  "Your session expired, please sign in again."
- Server unreachable → a persistent banner, not a silent empty table. A dashboard
  showing zeros when the truth is "we could not ask" is the failure mode being
  designed against.
- No error is ever swallowed.

---

## 7. Data model changes

Additive only. No existing column or table is altered, so the live site is unaffected.

```sql
-- migrations/2026-08-12_admin_api.sql  (idempotent)

create table if not exists admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index if not exists admin_sessions_user_idx on admin_sessions(user_id);

create table if not exists admin_audit_log (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  payload    jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on admin_audit_log(created_at desc);
```

**The `user_id` column type must be verified, not assumed.** The DDL above writes
`uuid` to match `users.id`, but this project has already had to ship a migration
fixing exactly this class of mistake — `2026-08-03b_catalog_v5_uuid_fix.sql` retyped
three columns that were created `bigint` when every id in the database is `uuid`.
Confirm `users.id`'s real type against the live database before applying, and correct
the DDL if it differs.

Applied with the existing `sbq_sx.py` Management-API runner. That runner needs a
personal access token, which **must be revoked after use** (established practice on
this project).

---

## 8. Bootstrap: making the owner an administrator

**This is a real risk, not a formality.** Today the `admin` role is granted only
through Telegram login (`auth._is_admin_tg`, driven by `ADMIN_TELEGRAM_IDS`). The
Admin API logs in with **phone + password**. If the owner's `users` row has no
`password_hash`, or lacks `"admin"` in `roles`, or is inactive, the very first login
fails and Piece 1 is unusable.

Piece 1 therefore ships `scripts/grant_admin.py <phone>`, run once on the server,
which ensures the row exists, sets `is_active`, adds `"admin"` to `roles`, and sets a
password using the existing `auth.set_password`. **Verifying that login works against
the live server is an acceptance criterion of Piece 1, not an assumption.**

---

## 9. Security

- No Supabase key and no Google service-account key ever reaches the desktop program.
- Tokens are hashed at rest, expire in 30 days, and are individually revocable.
- Login is rate-limited and every failure is recorded with its IP.
- The only new public surface is the login endpoint; it is rate-limited and covered
  by tests for wrong password, non-admin account and inactive account.
- The installer will be unsigned, so Windows SmartScreen shows a warning on first
  install. Buying a code-signing certificate is the owner's commercial decision and
  is deferred.

---

## 10. Testing

**Server** (`pytest`, run with `/var/www/symptex/venv/bin/python -m pytest tests/test_admin_api.py`,
alongside the existing `test_accounts.py`, `test_auth_password.py`, `test_catalog.py`):

- login succeeds for an admin with the right password
- login fails on wrong password, on a non-admin account, on an inactive account
- login is rate-limited
- protected endpoints reject missing / malformed / expired / revoked tokens
- `/clinics` honours `q`, `status`, pagination, and `total` is a true count
- `/clinics` never issues per-row count queries
- `/dashboard/summary` returns every documented key, with zero-filled 14-day series
- `login` and `login_failed` land in `admin_audit_log`

**Client** (`tsc --noEmit`, `vitest`, `jest-axe` — the ailos UI gate):

- login form validation and each failure message
- each screen renders loading / empty / error / loaded
- a `401` clears the token and returns to login
- accessibility pass on every screen

**Manual acceptance (the owner does this):** install the program, open it from the
Desktop icon, log in, and confirm the clinic list and dashboard figures match the
live site.

---

## 11. Local development

1. `git clone ssh://root@45.77.242.169/var/www/symptex-next` into the Desktop folder.
2. Python virtual environment; install from the project's requirements.
3. Copy `.env` from the server (it is gitignored and stays gitignored).
4. `flask run` on `127.0.0.1:5000`.
5. `npm run dev` in `symptex-admin`, with the environment switch set to **Local**.

Deployment when a piece is finished, following the flow already established on this
server: push branch `feat/admin-api` → test in the `symptex-next-dev` worktree
(systemd unit `sxdev` on :8013, started with the live `EnvironmentFile` — without it
`sb()` runs offline and everything silently no-ops) → merge into `master` in
`/var/www/symptex-next` → `systemctl reload symptex-next`.

⚠️ The owner commits UI/CSS work directly on `master` in parallel. Merges must use
`git merge --no-edit`, never `--ff-only`, and `symptex.css` / templates must be
re-pulled from the server before being edited locally.

---

## 12. Out of scope for Piece 1

Editing anything at all; subscriptions and plans; visitor tracking and the cookie
banner; blog and pages; Excel import; branches; auto-update; more than one user;
roles and permissions; offline mode; a macOS build; dark mode.

---

## 13. Risks

| Risk | Handling |
|---|---|
| Owner's account cannot log in (no password / no admin role) | `grant_admin.py`, run and verified as an acceptance criterion (§8) |
| New login endpoint on the live server | Rate-limited, audited, and covered by negative tests before deploy |
| SmartScreen warning on an unsigned installer | Expected and explained to the owner; signing deferred |
| Dashboard silently showing zeros when the server is unreachable | Explicit error state required in §6.5 and tested |
| Owner's parallel commits on `master` | Merge discipline in §11 |
