# Symptex Admin — Piece 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installed Windows program with a Desktop icon that logs the owner in, shows a dashboard built from data Symptex already records, and lists every Symptex clinic — backed by a new read-only `/api/admin/v1` blueprint on the live Flask site.

**Architecture:** An Electron shell wrapping a React/TypeScript renderer talks over HTTPS to a new token-authenticated Flask blueprint inside `symptex-next`. The blueprint copies the already-proven `clinic_api` pattern (Bearer token, `csrf.exempt`, `flask_limiter`). Every secret — the Supabase service key, the Google service account — stays on the server; the desktop program holds only a revocable session token. No endpoint in Piece 1 writes to business data.

**Tech Stack:** Server — Python 3, Flask, supabase-py, flask-limiter, pytest, `unittest.mock`. Client — Electron, electron-builder, Vite, React, TypeScript, Tailwind v4, lucide-react, vitest, @testing-library/react, jest-axe.

**Spec:** `docs/superpowers/specs/2026-08-12-symptex-admin-design.md`

---

## Conventions used throughout

- **Server repo** = `C:\Users\user\Desktop\symptex-next` (clone of `/var/www/symptex-next`). Branch: `feat/admin-api`.
- **Client repo** = `C:\Users\user\Desktop\symptex-admin` (new). Branch: `master`.
- Server tests run locally: `.\.venv\Scripts\python -m pytest tests\<file> -v`
- The Supabase client is **always mocked in tests**. This matches every existing test in the repo (`tests/test_auth_password.py`, `tests/test_catalog.py`). No test may touch the live database.
- Patch targets follow where a name is *imported*, e.g. `patch("app.services.admin_auth.sb", ...)`, because these modules do `from ..extensions import sb`.

---

## File Structure

### Server (`symptex-next`)

| File | Responsibility |
|---|---|
| `app/services/stats.py` | **New.** Dashboard metrics. `platform_summary()` is the panel's existing function moved here unchanged; `admin_summary()` is the API's richer payload. |
| `app/services/admin_auth.py` | **New.** Admin session tokens: issue, verify, revoke. Audit-log helper. Nothing else. |
| `app/services/admin_clinics.py` | **New.** Reading clinics for admin: search, filter, paginate, per-page aggregate counts. |
| `app/blueprints/admin_api/__init__.py` | **New.** HTTP layer only — routes, request parsing, status codes. No business logic. |
| `migrations/2026-08-12_admin_api.sql` | **New.** `admin_sessions`, `admin_audit_log`. Additive, idempotent. |
| `scripts/grant_admin.py` | **New.** One-off bootstrap so the owner can actually log in. |
| `app/__init__.py` | **Modify.** Register the blueprint + `csrf.exempt`, beside the existing `clinic_api` lines. |
| `app/blueprints/panel/__init__.py` | **Modify.** Delete `_stats_data`, call `stats.platform_summary()` instead. |
| `tests/test_stats.py`, `tests/test_admin_auth.py`, `tests/test_admin_api.py`, `tests/test_admin_clinics.py` | **New.** |

The HTTP layer is kept free of business logic deliberately: pieces 3–5 add many more endpoints, and the blueprint must not become the next 400-line file.

### Client (`symptex-admin`)

| File | Responsibility |
|---|---|
| `electron/main.cjs` | Window, token storage via `safeStorage`, environment file, IPC handlers. Plain CommonJS — no build step. |
| `electron/preload.cjs` | Exposes exactly five functions as `window.symptex`. Nothing else crosses the bridge. |
| `src/bridge.ts` | Typed wrapper over `window.symptex`, with an in-memory fallback so tests and browser dev work. |
| `src/api/client.ts` | `fetch` wrapper: base URL, Bearer header, typed errors, 401 signalling. |
| `src/api/admin.ts` | One typed function per endpoint. **The only file containing URL paths.** |
| `src/api/types.ts` | Response types shared by api + screens. |
| `src/auth/SessionContext.tsx` | Who is logged in, login/logout, 401 handling. |
| `src/auth/LoginScreen.tsx` | Login form. |
| `src/components/AppShell.tsx` | Sidebar + header + routing between screens. |
| `src/components/DataStates.tsx` | `Loading`, `Empty`, `ErrorState` — used by every screen so the four states are never re-invented. |
| `src/components/StatTile.tsx`, `src/components/BarChart.tsx` | Presentational primitives. |
| `src/screens/dashboard/DashboardScreen.tsx` | Dashboard. Receives data; owns no fetching. |
| `src/screens/clinics/ClinicsScreen.tsx`, `ClinicDetail.tsx` | Clinic list + read-only detail. |

---

# PHASE A — SERVER

## Task 1: Local development environment

**Files:** none committed — this creates the working copy.

- [ ] **Step 1: Clone the server repo to the Desktop**

Run in Git Bash:

```bash
cd /c/Users/user/Desktop
git clone ssh://root@45.77.242.169/var/www/symptex-next symptex-next
cd symptex-next && git log --oneline -1
```

Expected: a clone completes and prints the newest commit on `master`.

- [ ] **Step 2: Create the virtual environment**

```powershell
cd C:\Users\user\Desktop\symptex-next
py -3 -m venv .venv
```

- [ ] **Step 3: Get the dependency list and install**

`requirements.txt` may not be committed. Check first, and if it is missing, produce it from the server's venv (which is the real source of truth):

```bash
cd /c/Users/user/Desktop/symptex-next
ls requirements.txt 2>/dev/null || ssh root@45.77.242.169 '/var/www/symptex/venv/bin/pip freeze' > requirements.txt
```

Then install:

```powershell
.\.venv\Scripts\python -m pip install -r requirements.txt
```

Expected: installs without error. `supabase`, `Flask`, `flask-limiter`, `Flask-WTF`, `pytest` are present.

- [ ] **Step 4: Copy the environment file**

Use Git Bash, **not** PowerShell — PowerShell's `>` writes a BOM that corrupts the first variable.

```bash
cd /c/Users/user/Desktop/symptex-next
ssh root@45.77.242.169 'cat /var/www/symptex-next/.env' > .env
head -c 40 .env
```

Expected: the first line starts with a variable name, not `\xef\xbb\xbf`.

Confirm it will never be committed:

```bash
git check-ignore -v .env
```

Expected: a line showing `.gitignore` matches it. **If this prints nothing, stop and add `.env` to `.gitignore` before doing anything else.**

- [ ] **Step 5: Run the site locally**

```powershell
cd C:\Users\user\Desktop\symptex-next
$env:FLASK_APP="app:create_app"
.\.venv\Scripts\python -m flask run --port 5000
```

In a second terminal:

```powershell
(Invoke-WebRequest http://127.0.0.1:5000/ru/ -UseBasicParsing).StatusCode
```

Expected: `200`. If it is 500, the `.env` did not load — recheck Step 4.

- [ ] **Step 6: Run the existing test suite**

```powershell
.\.venv\Scripts\python -m pytest tests -q
```

Expected: all existing tests pass. This is the baseline — if anything is already red, note it before writing new code.

- [ ] **Step 7: Create the working branch**

```bash
cd /c/Users/user/Desktop/symptex-next
git checkout -b feat/admin-api
```

Nothing is committed in this task — `.env` and `.venv` are ignored.

---

## Task 2: Extract the dashboard metrics into their own module

`_stats_data()` currently lives inside `app/blueprints/panel/__init__.py` (line ~344), a file already over 400 lines. The API needs the same figures. Move it out **unchanged** first, so the move is provably behaviour-neutral, and add new behaviour separately in Task 7.

**Files:**
- Create: `app/services/stats.py`
- Modify: `app/blueprints/panel/__init__.py`
- Test: `tests/test_stats.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_stats.py`:

```python
"""Dashboard metrics (app/services/stats.py). Supabase is mocked — these assert the
shape the panel template and the Admin API both rely on."""
from unittest.mock import MagicMock, patch

import app.services.stats as stats


def fake_sb(bookings=None, users=None, counts=None):
    """Supabase double. .table(name) yields a chain where every builder method
    returns itself and execute() returns that table's rows plus its exact count."""
    bookings = bookings or []
    users = users or []
    counts = counts or {}

    def table(name):
        resp = MagicMock()
        resp.data = {"sx_bookings": bookings, "users": users}.get(name, [])
        resp.count = counts.get(name, 0)

        chain = MagicMock()
        for method in ("select", "neq", "eq", "in_", "order", "limit", "range"):
            getattr(chain, method).return_value = chain
        chain.execute.return_value = resp

        t = MagicMock()
        t.select.return_value = chain
        return t

    client = MagicMock()
    client.table.side_effect = table
    return client


def test_platform_summary_returns_the_panel_shape():
    bookings = [{"status": "confirmed", "clinic_name": "Clinic A",
                 "doctor_name": "Dr B", "created_at": "2026-08-12T10:00:00"}]
    users = [{"created_at": "2026-08-12T09:00:00"}]
    with patch("app.services.stats.sb",
               return_value=fake_sb(bookings, users, {"clinics": 7, "doctors": 3})):
        out = stats.platform_summary()

    assert set(out) == {"by_status", "by_day", "top_clinics", "top_doctors",
                        "new_users_by_day", "totals"}
    assert out["by_status"] == {"confirmed": 1}
    assert out["totals"]["clinics"] == 7
    assert out["totals"]["doctors"] == 3


def test_platform_summary_day_series_are_zero_filled_to_14():
    with patch("app.services.stats.sb", return_value=fake_sb()):
        out = stats.platform_summary()

    assert len(out["by_day"]) == 14
    assert len(out["new_users_by_day"]) == 14
    assert all(d["count"] == 0 for d in out["by_day"])
    dates = [d["date"] for d in out["by_day"]]
    assert dates == sorted(dates), "series must run oldest -> newest"


def test_platform_summary_survives_a_dead_database():
    broken = MagicMock()
    broken.table.side_effect = RuntimeError("connection refused")
    with patch("app.services.stats.sb", return_value=broken):
        out = stats.platform_summary()

    assert out["totals"]["clinics"] == 0
    assert len(out["by_day"]) == 14
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
.\.venv\Scripts\python -m pytest tests\test_stats.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.stats'`.

- [ ] **Step 3: Create the module by moving the function verbatim**

Create `app/services/stats.py`:

```python
"""Platform metrics computed from data Symptex already records — no tracking needed.

`platform_summary()` is the panel's former `_stats_data()`, moved here unchanged so
both the Jinja admin console and the Admin API report identical figures.
"""
from collections import Counter
from datetime import date, timedelta

from ..extensions import sb


def platform_summary():
    """Default analytics from existing data: bookings by status/day, top clinics/
    doctors, new users/day, totals. STATS_V1 (refine per owner)."""
    out = {"by_status": {}, "by_day": [], "top_clinics": [], "top_doctors": [],
           "new_users_by_day": [], "totals": {}}
    try:
        bks = (sb().table("sx_bookings")
               .select("status,clinic_name,doctor_name,created_at")
               .neq("status", "unverified")
               .order("created_at", desc=True).limit(3000).execute().data or [])
    except Exception:
        bks = []
    out["by_status"] = dict(Counter((b.get("status") or "\u2014") for b in bks))
    today = date.today()
    days = [(today - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    bd = Counter((b.get("created_at") or "")[:10] for b in bks)
    out["by_day"] = [{"date": d, "count": bd.get(d, 0)} for d in days]
    out["top_clinics"] = [{"name": n, "count": c} for n, c in
                          Counter((b.get("clinic_name") or "\u2014") for b in bks).most_common(6)]
    out["top_doctors"] = [{"name": n, "count": c} for n, c in
                          Counter((b.get("doctor_name") or "\u2014") for b in bks).most_common(6)]
    try:
        us = (sb().table("users").select("created_at")
              .order("created_at", desc=True).limit(3000).execute().data or [])
    except Exception:
        us = []
    ud = Counter((u.get("created_at") or "")[:10] for u in us)
    out["new_users_by_day"] = [{"date": d, "count": ud.get(d, 0)} for d in days]
    out["totals"] = {"bookings": len(bks), "clinics": count_rows("clinics"),
                     "clinics_active": count_rows("clinics", is_active=True),
                     "doctors": count_rows("doctors")}
    return out


def count_rows(table, **eq):
    """Exact row count, 0 if the query fails. Shared by both summaries."""
    try:
        q = sb().table(table).select("id", count="exact")
        for k, v in eq.items():
            q = q.eq(k, v)
        return q.execute().count or 0
    except Exception:
        return 0
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
.\.venv\Scripts\python -m pytest tests\test_stats.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Point the panel at the new module**

In `app/blueprints/panel/__init__.py`, add to the imports at the top of the file, next to the other `from ...services import ...` lines:

```python
from ...services import stats as stats_svc
```

Delete the entire `def _stats_data(): ...` function (it begins at line ~344 and ends immediately before `@bp.get("/admin")`).

In the `admin()` view, change:

```python
    return render_template("panel/admin.html", adm=_admin_data(bpage), accounts=accts, clinics=clinics, stats=_stats_data(), **_ctx("admin"))
```

to:

```python
    return render_template("panel/admin.html", adm=_admin_data(bpage), accounts=accts,
                           clinics=clinics, stats=stats_svc.platform_summary(), **_ctx("admin"))
```

- [ ] **Step 6: Verify nothing else referenced the old function**

```bash
cd /c/Users/user/Desktop/symptex-next
grep -rn "_stats_data" app/ templates/ 2>/dev/null
```

Expected: **no output.** If the template references `_stats_data`, fix that reference too.

- [ ] **Step 7: Run the whole suite and the app**

```powershell
.\.venv\Scripts\python -m pytest tests -q
```

Expected: all pass, including the pre-existing tests.

Restart `flask run` and confirm `http://127.0.0.1:5000/ru/` still returns 200.

- [ ] **Step 8: Commit**

```bash
git add app/services/stats.py app/blueprints/panel/__init__.py tests/test_stats.py
git commit -m "refactor(stats): move panel _stats_data into services/stats.py

Behaviour-neutral move so the Admin API and the Jinja console compute the
same figures from one implementation. Adds tests the panel never had."
```

---

## Task 3: Database migration

**Files:**
- Create: `migrations/2026-08-12_admin_api.sql`

- [ ] **Step 1: Get a fresh Supabase personal access token**

`C:\Users\user\.claude\easymed-tools\sx_token.txt` holds a token that was meant to be revoked after its last use, so assume it is dead. Ask the owner for a fresh PAT from https://supabase.com/dashboard/account/tokens, write it into that file, and **revoke it again at the end of this task**.

- [ ] **Step 2: Verify the real type of `users.id` — do not assume**

This project has already shipped a migration to repair exactly this mistake (`migrations/2026-08-03b_catalog_v5_uuid_fix.sql`, which retyped three columns created as `bigint` when every id is `uuid`).

```powershell
cd C:\Users\user\.claude\easymed-tools
python sbq_sx.py "select column_name, data_type from information_schema.columns where table_name='users' and column_name='id'"
```

Expected: one row. Note whether `data_type` is `uuid` or `bigint`. The migration below assumes `uuid`; **if it prints `bigint`, change both `user_id` columns to `bigint` before applying.**

- [ ] **Step 3: Write the migration**

Create `migrations/2026-08-12_admin_api.sql`:

```sql
-- 2026-08-12_admin_api.sql
-- Admin API sessions + audit trail. Additive and idempotent; nothing existing is
-- altered, so the live site is unaffected by applying this.
-- NOTE: user_id is uuid to match users.id — verified against information_schema
-- before applying (see 2026-08-03b_catalog_v5_uuid_fix.sql for why we check).

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

- [ ] **Step 4: Apply it**

```powershell
cd C:\Users\user\.claude\easymed-tools
python sbq_sx.py "@C:\Users\user\Desktop\symptex-next\migrations\2026-08-12_admin_api.sql"
```

Expected: no `HTTP 4xx`/`HTTP 5xx` line.

- [ ] **Step 5: Verify both tables exist with the right columns**

```powershell
python sbq_sx.py "select table_name, column_name, data_type from information_schema.columns where table_name in ('admin_sessions','admin_audit_log') order by table_name, ordinal_position"
```

Expected: every column listed above appears, and `admin_sessions.user_id` matches `users.id`'s type.

- [ ] **Step 6: Confirm the live site is unaffected**

```powershell
(Invoke-WebRequest https://symptex.uz/ru/ -UseBasicParsing).StatusCode
```

Expected: `200`.

- [ ] **Step 7: Revoke the token**

Ask the owner to revoke the PAT at https://supabase.com/dashboard/account/tokens, then blank the local copy:

```powershell
Set-Content -Path C:\Users\user\.claude\easymed-tools\sx_token.txt -Value "" -Encoding utf8
```

- [ ] **Step 8: Commit**

```bash
git add migrations/2026-08-12_admin_api.sql
git commit -m "feat(admin-api): migration for admin_sessions + admin_audit_log"
```

---

## Task 4: Admin session tokens

Mirrors `app/services/apikeys.py` — a `key_id.secret` token whose secret is only ever stored as a SHA-256 hash and compared with `hmac.compare_digest`. That pattern is already in production here; do not invent a different one.

**Files:**
- Create: `app/services/admin_auth.py`
- Test: `tests/test_admin_auth.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_admin_auth.py`:

```python
"""Admin session tokens (app/services/admin_auth.py). Supabase is mocked."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import app.services.admin_auth as aa

ADMIN = {"id": "u-1", "phone": "+998901234567", "roles": ["admin"],
         "is_active": True, "first_name": "Owner"}


def _iso(**delta):
    return (datetime.now(timezone.utc) + timedelta(**delta)).isoformat()


def fake_sb(session_row=None, user_row=None, inserted=None):
    """Doubles the two tables admin_auth touches: admin_sessions and users."""
    def table(name):
        chain = MagicMock()
        for method in ("select", "eq", "limit", "update", "insert", "order"):
            getattr(chain, method).return_value = chain

        resp = MagicMock()
        if name == "admin_sessions":
            resp.data = [session_row] if session_row else []
        elif name == "users":
            resp.data = [user_row] if user_row else []
        else:
            resp.data = []
        chain.execute.return_value = resp

        t = MagicMock()
        for method in ("select", "insert", "update"):
            getattr(t, method).return_value = chain
        if inserted is not None and name == "admin_sessions":
            ins = MagicMock()
            ins_resp = MagicMock()
            ins_resp.data = [inserted]
            ins.execute.return_value = ins_resp
            t.insert.return_value = ins
        return t

    c = MagicMock()
    c.table.side_effect = table
    return c


def test_issue_token_returns_two_part_token_and_expiry():
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(inserted={"id": "s-1"})):
        out = aa.issue_token(ADMIN, user_agent="test")

    assert out["token"].count(".") == 1
    session_id, secret = out["token"].split(".")
    assert session_id == "s-1"
    assert len(secret) >= 32
    assert out["expires_at"] > datetime.now(timezone.utc).isoformat()


def test_issue_token_stores_only_the_hash():
    captured = {}

    def table(name):
        t = MagicMock()

        def insert(row):
            captured.update(row)
            r = MagicMock()
            resp = MagicMock()
            resp.data = [{"id": "s-1"}]
            r.execute.return_value = resp
            return r

        t.insert.side_effect = insert
        return t

    c = MagicMock()
    c.table.side_effect = table
    with patch("app.services.admin_auth.sb", return_value=c):
        out = aa.issue_token(ADMIN)

    secret = out["token"].split(".")[1]
    assert secret not in str(captured), "the raw secret must never be stored"
    assert captured["token_hash"] == aa._hash(secret)


def test_verify_token_accepts_a_live_admin_session():
    secret = "s" * 48
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash(secret),
           "expires_at": _iso(days=30), "revoked_at": None}
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=ADMIN)):
        user = aa.verify_token("s-1." + secret)

    assert user and user["id"] == "u-1"
    assert user["_session_id"] == "s-1"


def test_verify_token_rejects_bad_shapes():
    with patch("app.services.admin_auth.sb", return_value=fake_sb()):
        assert aa.verify_token("") is None
        assert aa.verify_token("no-dot-here") is None
        assert aa.verify_token(None) is None


def test_verify_token_rejects_wrong_secret():
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash("right"),
           "expires_at": _iso(days=30), "revoked_at": None}
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=ADMIN)):
        assert aa.verify_token("s-1.wrong") is None


def test_verify_token_rejects_expired_session():
    secret = "x" * 48
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash(secret),
           "expires_at": _iso(days=-1), "revoked_at": None}
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=ADMIN)):
        assert aa.verify_token("s-1." + secret) is None


def test_verify_token_rejects_revoked_session():
    secret = "x" * 48
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash(secret),
           "expires_at": _iso(days=30), "revoked_at": _iso(days=-1)}
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=ADMIN)):
        assert aa.verify_token("s-1." + secret) is None


def test_verify_token_rejects_user_who_lost_admin_role():
    secret = "x" * 48
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash(secret),
           "expires_at": _iso(days=30), "revoked_at": None}
    demoted = dict(ADMIN, roles=["clinic"])
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=demoted)):
        assert aa.verify_token("s-1." + secret) is None


def test_verify_token_rejects_deactivated_user():
    secret = "x" * 48
    row = {"id": "s-1", "user_id": "u-1", "token_hash": aa._hash(secret),
           "expires_at": _iso(days=30), "revoked_at": None}
    off = dict(ADMIN, is_active=False)
    with patch("app.services.admin_auth.sb",
               return_value=fake_sb(session_row=row, user_row=off)):
        assert aa.verify_token("s-1." + secret) is None


def test_is_admin():
    assert aa.is_admin({"roles": ["admin"], "is_active": True}) is True
    assert aa.is_admin({"roles": ["clinic"], "is_active": True}) is False
    assert aa.is_admin({"roles": ["admin"], "is_active": False}) is False
    assert aa.is_admin(None) is False


def test_audit_never_raises_when_the_database_is_down():
    broken = MagicMock()
    broken.table.side_effect = RuntimeError("down")
    with patch("app.services.admin_auth.sb", return_value=broken):
        aa.audit("login_failed", ip="1.2.3.4")   # must not raise
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_auth.py -v
```

Expected: FAIL — `No module named 'app.services.admin_auth'`.

- [ ] **Step 3: Write the implementation**

Create `app/services/admin_auth.py`:

```python
"""Admin session tokens for the desktop Admin app.

Token format `session_id.secret`, mirroring services/apikeys.py: only sha256(secret)
is stored and comparison is constant-time, so a leaked database row cannot be
replayed as a token. Sessions are revocable and expire; every verify re-checks that
the user is still active and still an admin, so revoking the role kills live
sessions immediately.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from ..extensions import sb

TOKEN_DAYS = 30


def _c():
    c = sb()
    if c is None:
        raise RuntimeError("Supabase offline")
    return c


def _hash(secret):
    # High-entropy random secret, so a fast sha256 is correct here (same reasoning
    # as apikeys.py). Passwords still go through werkzeug's KDF, not this.
    return hashlib.sha256((secret or "").encode()).hexdigest()


def _now():
    return datetime.now(timezone.utc)


def _parse(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def is_admin(user):
    """True only for an active user carrying the admin role."""
    if not user:
        return False
    return bool(user.get("is_active") is not False and "admin" in (user.get("roles") or []))


def issue_token(user, user_agent=None, days=TOKEN_DAYS):
    """Create a session and return {'token', 'expires_at'}. Token is shown once."""
    secret = secrets.token_hex(24)
    expires_at = (_now() + timedelta(days=days)).isoformat()
    row = _c().table("admin_sessions").insert({
        "user_id": user["id"],
        "token_hash": _hash(secret),
        "user_agent": (user_agent or "")[:300] or None,
        "expires_at": expires_at,
    }).execute().data[0]
    return {"token": "%s.%s" % (row["id"], secret), "expires_at": expires_at}


def verify_token(token):
    """`session_id.secret` -> the users row (plus _session_id) or None."""
    if not token or "." not in str(token):
        return None
    session_id, secret = str(token).split(".", 1)

    rows = (_c().table("admin_sessions").select("*")
            .eq("id", session_id).limit(1).execute().data or [])
    if not rows:
        return None
    s = rows[0]

    if s.get("revoked_at"):
        return None
    exp = _parse(s.get("expires_at"))
    if not exp or exp < _now():
        return None
    if not (s.get("token_hash") and hmac.compare_digest(s["token_hash"], _hash(secret))):
        return None

    users = (_c().table("users").select("*")
             .eq("id", s["user_id"]).limit(1).execute().data or [])
    if not users or not is_admin(users[0]):
        return None

    try:
        _c().table("admin_sessions").update(
            {"last_seen_at": _now().isoformat()}).eq("id", session_id).execute()
    except Exception:
        pass          # a failed heartbeat must never log a valid admin out

    user = dict(users[0])
    user["_session_id"] = session_id
    return user


def revoke(session_id):
    _c().table("admin_sessions").update(
        {"revoked_at": _now().isoformat()}).eq("id", session_id).execute()
    return True


def audit(action, user_id=None, entity=None, entity_id=None, payload=None, ip=None):
    """Append to admin_audit_log. Never raises: an audit failure must not break the
    request, but it must also never be the reason a write silently disappears —
    only read paths and auth events use this in Piece 1."""
    try:
        _c().table("admin_audit_log").insert({
            "user_id": user_id, "action": action, "entity": entity,
            "entity_id": str(entity_id) if entity_id is not None else None,
            "payload": payload, "ip": ip,
        }).execute()
    except Exception:
        pass
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_auth.py -v
```

Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add app/services/admin_auth.py tests/test_admin_auth.py
git commit -m "feat(admin-api): revocable admin session tokens

sha256-hashed secrets and constant-time comparison, mirroring apikeys.py.
Every verify re-checks is_active + admin role, so demoting a user kills
their live sessions."
```

---

## Task 5: The blueprint and the authentication endpoints

**Files:**
- Create: `app/blueprints/admin_api/__init__.py`
- Modify: `app/__init__.py` (registration, beside the existing `clinic_api` lines ~137-139)
- Test: `tests/test_admin_api.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_admin_api.py`:

```python
"""HTTP behaviour of /api/admin/v1. Supabase and the auth service are mocked; these
tests are about status codes, payload shape and the guard — not about the database."""
from unittest.mock import patch

import pytest

from app import create_app

ADMIN = {"id": "u-1", "phone": "+998901234567", "roles": ["admin"],
         "is_active": True, "first_name": "Owner", "last_name": ""}


@pytest.fixture()
def client():
    app = create_app()
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
    return app.test_client()


def auth_headers(token="s-1.secret"):
    return {"Authorization": "Bearer " + token}


# ---------------- health ----------------

def test_health_needs_no_token(client):
    r = client.get("/api/admin/v1/health")
    assert r.status_code == 200
    assert r.get_json()["ok"] is True


# ---------------- login ----------------

def test_login_returns_a_token_for_an_admin(client):
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=ADMIN), \
         patch("app.blueprints.admin_api.admin_auth.issue_token",
               return_value={"token": "s-1.secret", "expires_at": "2026-09-11T00:00:00+00:00"}), \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        r = client.post("/api/admin/v1/auth/login",
                        json={"phone": "901234567", "password": "pw"})

    assert r.status_code == 200
    body = r.get_json()
    assert body["token"] == "s-1.secret"
    assert body["user"]["id"] == "u-1"
    assert "password" not in str(body)


def test_login_rejects_a_wrong_password(client):
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=None), \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        r = client.post("/api/admin/v1/auth/login",
                        json={"phone": "901234567", "password": "nope"})

    assert r.status_code == 401
    assert "error" in r.get_json()


def test_login_rejects_a_non_admin_account(client):
    clinic_user = dict(ADMIN, roles=["clinic"])
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=clinic_user), \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        r = client.post("/api/admin/v1/auth/login",
                        json={"phone": "901234567", "password": "pw"})

    assert r.status_code == 403


def test_login_rejects_an_inactive_admin(client):
    off = dict(ADMIN, is_active=False)
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=off), \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        r = client.post("/api/admin/v1/auth/login",
                        json={"phone": "901234567", "password": "pw"})

    assert r.status_code == 403


def test_login_requires_both_fields(client):
    r = client.post("/api/admin/v1/auth/login", json={"phone": "901234567"})
    assert r.status_code == 400


def test_failed_login_is_audited(client):
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=None), \
         patch("app.blueprints.admin_api.admin_auth.audit") as audited:
        client.post("/api/admin/v1/auth/login",
                    json={"phone": "901234567", "password": "nope"})

    assert audited.called
    assert audited.call_args.args[0] == "login_failed"


def test_login_is_rate_limited(client):
    """11 attempts from one address must hit the 10/minute limit.

    A unique REMOTE_ADDR is used because flask_limiter's in-memory storage is shared
    across the whole test process — reusing 127.0.0.1 would make this depend on
    which tests ran first. No X-Forwarded-For header is sent, so ProxyFix leaves
    remote_addr alone.
    """
    with patch("app.blueprints.admin_api.auth.verify_password", return_value=None), \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        statuses = [
            client.post("/api/admin/v1/auth/login",
                        json={"phone": "901234567", "password": "nope"},
                        environ_base={"REMOTE_ADDR": "203.0.113.77"}).status_code
            for _ in range(11)
        ]

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429, "the 11th attempt in a minute must be rejected"


# ---------------- the guard ----------------

def test_protected_endpoint_rejects_a_missing_token(client):
    r = client.get("/api/admin/v1/me")
    assert r.status_code == 401


def test_protected_endpoint_rejects_a_malformed_header(client):
    r = client.get("/api/admin/v1/me", headers={"Authorization": "Token abc"})
    assert r.status_code == 401


def test_protected_endpoint_rejects_an_invalid_token(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token", return_value=None):
        r = client.get("/api/admin/v1/me", headers=auth_headers())
    assert r.status_code == 401


def test_me_returns_the_logged_in_admin(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")):
        r = client.get("/api/admin/v1/me", headers=auth_headers())

    assert r.status_code == 200
    assert r.get_json()["user"]["phone"] == "+998901234567"
    assert "password_hash" not in str(r.get_json())


def test_logout_revokes_the_session(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.admin_auth.revoke") as revoked, \
         patch("app.blueprints.admin_api.admin_auth.audit"):
        r = client.post("/api/admin/v1/auth/logout", headers=auth_headers())

    assert r.status_code == 200
    revoked.assert_called_once_with("s-1")
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_api.py -v
```

Expected: FAIL — every request 404s because the blueprint does not exist.

- [ ] **Step 3: Write the blueprint**

Create `app/blueprints/admin_api/__init__.py`:

```python
"""Admin API — the desktop Symptex Admin program's only way in.

Auth: `Authorization: Bearer <session_id.secret>` (see services.admin_auth). Mounted
at /api/admin/v1 and CSRF-exempt, exactly like clinic_api: it is token-authed, not
session-authed. Piece 1 is read-only — no endpoint here changes business data.

This module is the HTTP layer only. Business logic belongs in app/services/*.
"""
from functools import wraps

from flask import Blueprint, request, jsonify, g

from ... import auth
from ...services import admin_auth
from ...services import admin_clinics
from ...services import stats
from ...extensions import limiter

bp = Blueprint("admin_api", __name__)

API_VERSION = "1.0.0"


def _err(code, msg):
    return jsonify({"error": msg}), code


def _client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()


def _public_user(u):
    """Only ever expose these fields — never the raw users row (password_hash)."""
    name = " ".join(x for x in [(u.get("first_name") or ""), (u.get("last_name") or "")] if x).strip()
    return {"id": u.get("id"), "phone": u.get("phone"),
            "name": name or u.get("display_name") or u.get("phone"),
            "roles": u.get("roles") or []}


def require_admin(view):
    @wraps(view)
    def wrapped(*a, **kw):
        header = request.headers.get("Authorization", "")
        token = header[7:].strip() if header[:7].lower() == "bearer " else ""
        if not token:
            return _err(401, "missing token")
        try:
            user = admin_auth.verify_token(token)
        except Exception:
            return _err(503, "database unavailable")
        if not user:
            return _err(401, "invalid or expired token")
        g.admin_user = user
        return view(*a, **kw)
    return wrapped


# ---------------------------------------------------------------- health

@bp.get("/health")
def health():
    return jsonify({"ok": True, "version": API_VERSION})


# ---------------------------------------------------------------- auth

@bp.post("/auth/login")
@limiter.limit("10 per minute")
def login():
    body = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()
    password = body.get("password") or ""
    if not phone or not password:
        return _err(400, "phone and password are required")

    try:
        user = auth.verify_password(phone, password)
    except Exception:
        return _err(503, "database unavailable")

    if not user:
        admin_auth.audit("login_failed", entity="phone", entity_id=phone, ip=_client_ip())
        return _err(401, "wrong phone or password")

    if not admin_auth.is_admin(user):
        admin_auth.audit("login_denied", user_id=user.get("id"), ip=_client_ip())
        return _err(403, "this account is not an administrator")

    issued = admin_auth.issue_token(user, user_agent=request.headers.get("User-Agent"))
    admin_auth.audit("login", user_id=user.get("id"), ip=_client_ip())
    return jsonify({"token": issued["token"], "expires_at": issued["expires_at"],
                    "user": _public_user(user)})


@bp.post("/auth/logout")
@require_admin
def logout():
    admin_auth.revoke(g.admin_user["_session_id"])
    admin_auth.audit("logout", user_id=g.admin_user.get("id"), ip=_client_ip())
    return jsonify({"ok": True})


@bp.get("/me")
@limiter.limit("120 per minute")
@require_admin
def me():
    return jsonify({"user": _public_user(g.admin_user)})
```

> The imports of `admin_clinics` and `stats` are used by Tasks 6 and 7. Adding them
> now keeps the import block stable and avoids a merge conflict between tasks.
> They are created in those tasks — **run Task 6 and 7 in order, or temporarily
> comment those two imports out to run this task's tests in isolation.**

- [ ] **Step 4: Create the two service modules as stubs so the import resolves**

The blueprint imports them; the real bodies arrive in Tasks 6 and 7.

Create `app/services/admin_clinics.py`:

```python
"""Reading clinics for the Admin API. Filled in by Task 6."""
```

`app/services/stats.py` already exists from Task 2.

- [ ] **Step 5: Register the blueprint**

In `app/__init__.py`, immediately after the existing lines:

```python
    from .blueprints.clinic_api import bp as clinic_api_bp
    app.register_blueprint(clinic_api_bp, url_prefix="/api/clinic/v1")
    csrf.exempt(clinic_api_bp)
```

add:

```python
    from .blueprints.admin_api import bp as admin_api_bp
    app.register_blueprint(admin_api_bp, url_prefix="/api/admin/v1")
    csrf.exempt(admin_api_bp)
```

- [ ] **Step 6: Run the test to verify it passes**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_api.py -v
```

Expected: 13 passed.

- [ ] **Step 7: Check the live-site routes are untouched**

```powershell
.\.venv\Scripts\python -m pytest tests -q
```

Expected: everything passes.

Restart `flask run`, then:

```powershell
(Invoke-WebRequest http://127.0.0.1:5000/api/admin/v1/health -UseBasicParsing).Content
```

Expected: `{"ok":true,"version":"1.0.0"}`.

- [ ] **Step 8: Commit**

```bash
git add app/blueprints/admin_api/__init__.py app/services/admin_clinics.py app/__init__.py tests/test_admin_api.py
git commit -m "feat(admin-api): blueprint with health, login, logout and me

Bearer-token guard mirroring clinic_api; login is rate-limited to 10/min and
both successes and failures are audited. Read-only."
```

---

## Task 6: The clinics endpoints

**Files:**
- Modify: `app/services/admin_clinics.py` (created as a stub in Task 5)
- Modify: `app/blueprints/admin_api/__init__.py`
- Test: `tests/test_admin_clinics.py`, `tests/test_admin_api.py`

- [ ] **Step 1: Write the failing service test**

Create `tests/test_admin_clinics.py`:

```python
"""Clinic reads for the Admin API. Supabase is mocked; these assert query shape and
that per-row counts are batched, which is the thing most likely to regress."""
from unittest.mock import MagicMock, patch

import app.services.admin_clinics as ac

CLINICS = [
    {"id": "c-1", "name_ru": "Клиника А", "slug": "clinic-a", "city": "Ташкент",
     "district": "Yunusobod", "clinic_type": "organization", "is_active": True,
     "created_at": "2026-08-01T00:00:00", "logo_url": None, "phone": "+998901111111"},
    {"id": "c-2", "name_ru": "Клиника Б", "slug": "clinic-b", "city": "Ташкент",
     "district": "Chilonzor", "clinic_type": "laboratory", "is_active": False,
     "created_at": "2026-07-01T00:00:00", "logo_url": None, "phone": "+998902222222"},
]


class Recorder:
    """Records every builder call so tests can assert the query that was built."""

    def __init__(self, rows_by_table, counts=None):
        self.rows_by_table = rows_by_table
        self.counts = counts or {}
        self.calls = []

    def client(self):
        def table(name):
            self.calls.append(("table", name))
            chain = MagicMock()

            def record(method):
                def inner(*a, **kw):
                    self.calls.append((method, a, kw))
                    return chain
                return inner

            for method in ("select", "eq", "in_", "or_", "ilike", "order", "range", "limit"):
                getattr(chain, method).side_effect = record(method)

            resp = MagicMock()
            resp.data = self.rows_by_table.get(name, [])
            resp.count = self.counts.get(name, len(self.rows_by_table.get(name, [])))
            chain.execute.return_value = resp

            t = MagicMock()
            t.select.side_effect = record("select")
            t.select.return_value = chain
            return t

        c = MagicMock()
        c.table.side_effect = table
        return c


def test_list_clinics_returns_page_envelope():
    rec = Recorder({"clinics": CLINICS, "doctors": [], "department_services": []},
                   counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        out = ac.list_clinics()

    assert set(out) == {"items", "total", "page", "per_page"}
    assert out["total"] == 2
    assert out["page"] == 1
    assert len(out["items"]) == 2


def test_list_clinics_attaches_counts_without_a_query_per_row():
    rec = Recorder({
        "clinics": CLINICS,
        "doctors": [{"clinic_id": "c-1"}, {"clinic_id": "c-1"}, {"clinic_id": "c-2"}],
        "departments": [{"id": "d-1", "clinic_id": "c-1"}],
        "department_services": [{"department_id": "d-1"}, {"department_id": "d-1"}],
    }, counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        out = ac.list_clinics()

    by_id = {c["id"]: c for c in out["items"]}
    assert by_id["c-1"]["doctors_n"] == 2
    assert by_id["c-2"]["doctors_n"] == 1
    assert by_id["c-1"]["services_n"] == 2
    assert by_id["c-2"]["services_n"] == 0

    tables = [c[1] for c in rec.calls if c[0] == "table"]
    assert tables.count("doctors") == 1, "doctors must be fetched once for the page"
    assert tables.count("department_services") == 1


def test_status_filter_active_adds_an_eq():
    rec = Recorder({"clinics": CLINICS}, counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        ac.list_clinics(status="active")

    eqs = [c for c in rec.calls if c[0] == "eq"]
    assert ("eq", ("is_active", True), {}) in eqs


def test_status_filter_all_adds_no_is_active_filter():
    rec = Recorder({"clinics": CLINICS}, counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        ac.list_clinics(status="all")

    eq_columns = [c[1][0] for c in rec.calls if c[0] == "eq"]
    assert "is_active" not in eq_columns


def test_search_uses_a_single_or_across_name_slug_phone():
    rec = Recorder({"clinics": CLINICS}, counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        ac.list_clinics(q="альфа")

    ors = [c for c in rec.calls if c[0] == "or_"]
    assert len(ors) == 1
    expr = ors[0][1][0]
    for col in ("name_ru", "slug", "phone"):
        assert col in expr


def test_per_page_is_capped_and_page_floored():
    rec = Recorder({"clinics": CLINICS}, counts={"clinics": 2})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        out = ac.list_clinics(page=0, per_page=5000)

    assert out["page"] == 1
    assert out["per_page"] == ac.MAX_PER_PAGE


def test_get_clinic_returns_none_when_missing():
    rec = Recorder({"clinics": []})
    with patch("app.services.admin_clinics.sb", return_value=rec.client()):
        assert ac.get_clinic("nope") is None
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_clinics.py -v
```

Expected: FAIL — `module 'app.services.admin_clinics' has no attribute 'list_clinics'`.

- [ ] **Step 3: Write the service**

Replace the whole contents of `app/services/admin_clinics.py`:

```python
"""Reading clinics for the Admin API.

Scope: the `clinics` table — Symptex's OWN clinics. Clinics that come from the
medcore/EasyMed gateway are managed in EasyMed and are deliberately not returned.

Doctor and service counts are fetched once per page and joined in Python. Never add
a per-row count query here: the list is the most-hit endpoint in the whole app.
"""
from ..extensions import sb

DEFAULT_PER_PAGE = 25
MAX_PER_PAGE = 100

LIST_COLUMNS = ("id,name_ru,name,slug,city,district,clinic_type,is_active,"
                "created_at,logo_url,phone")


def _c():
    c = sb()
    if c is None:
        raise RuntimeError("Supabase offline")
    return c


def _clamp(page, per_page):
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(per_page)
    except (TypeError, ValueError):
        per_page = DEFAULT_PER_PAGE
    per_page = max(1, min(per_page, MAX_PER_PAGE))
    return page, per_page


def _doctor_counts(clinic_ids):
    if not clinic_ids:
        return {}
    rows = (_c().table("doctors").select("clinic_id")
            .in_("clinic_id", list(clinic_ids)).execute().data or [])
    out = {}
    for r in rows:
        cid = r.get("clinic_id")
        if cid:
            out[cid] = out.get(cid, 0) + 1
    return out


def _service_counts(clinic_ids):
    """department_services -> departments -> clinic. Two queries for the whole page."""
    if not clinic_ids:
        return {}
    deps = (_c().table("departments").select("id,clinic_id")
            .in_("clinic_id", list(clinic_ids)).execute().data or [])
    if not deps:
        return {}
    dep_to_clinic = {d["id"]: d.get("clinic_id") for d in deps}
    rows = (_c().table("department_services").select("department_id")
            .in_("department_id", list(dep_to_clinic)).execute().data or [])
    out = {}
    for r in rows:
        cid = dep_to_clinic.get(r.get("department_id"))
        if cid:
            out[cid] = out.get(cid, 0) + 1
    return out


def list_clinics(q=None, status="all", city=None, page=1, per_page=DEFAULT_PER_PAGE):
    page, per_page = _clamp(page, per_page)

    query = _c().table("clinics").select(LIST_COLUMNS, count="exact")
    if status == "active":
        query = query.eq("is_active", True)
    elif status == "inactive":
        query = query.eq("is_active", False)
    if city:
        query = query.eq("city", city)
    if q:
        needle = "%%%s%%" % str(q).strip()
        query = query.or_(
            "name_ru.ilike.{n},name.ilike.{n},slug.ilike.{n},phone.ilike.{n}".format(n=needle))

    start = (page - 1) * per_page
    resp = (query.order("created_at", desc=True)
            .range(start, start + per_page - 1).execute())
    items = resp.data or []
    total = resp.count if resp.count is not None else len(items)

    ids = [c["id"] for c in items if c.get("id")]
    doctors = _doctor_counts(ids)
    services = _service_counts(ids)
    for c in items:
        c["doctors_n"] = doctors.get(c["id"], 0)
        c["services_n"] = services.get(c["id"], 0)

    return {"items": items, "total": total, "page": page, "per_page": per_page}


def get_clinic(clinic_id):
    rows = (_c().table("clinics").select("*")
            .eq("id", clinic_id).limit(1).execute().data or [])
    if not rows:
        return None
    c = dict(rows[0])
    c.pop("owner_user_id", None)          # not needed by the UI in Piece 1
    c["doctors_n"] = _doctor_counts([clinic_id]).get(clinic_id, 0)
    c["services_n"] = _service_counts([clinic_id]).get(clinic_id, 0)
    return c
```

- [ ] **Step 4: Run it to verify it passes**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_clinics.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Add the HTTP tests**

Append to `tests/test_admin_api.py`:

```python
# ---------------- clinics ----------------

def test_clinics_requires_a_token(client):
    r = client.get("/api/admin/v1/clinics")
    assert r.status_code == 401


def test_clinics_returns_the_page_envelope(client):
    page = {"items": [{"id": "c-1", "name_ru": "A", "doctors_n": 2, "services_n": 5}],
            "total": 1, "page": 1, "per_page": 25}
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.admin_clinics.list_clinics",
               return_value=page) as listed:
        r = client.get("/api/admin/v1/clinics?q=abc&status=active&page=2&per_page=10",
                       headers=auth_headers())

    assert r.status_code == 200
    assert r.get_json() == page
    assert listed.call_args.kwargs == {"q": "abc", "status": "active", "city": None,
                                       "page": 2, "per_page": 10}


def test_clinics_rejects_an_unknown_status(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")):
        r = client.get("/api/admin/v1/clinics?status=banana", headers=auth_headers())
    assert r.status_code == 400


def test_clinic_detail_404s_when_missing(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.admin_clinics.get_clinic", return_value=None):
        r = client.get("/api/admin/v1/clinics/nope", headers=auth_headers())
    assert r.status_code == 404


def test_clinic_detail_returns_the_clinic(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.admin_clinics.get_clinic",
               return_value={"id": "c-1", "name_ru": "A"}):
        r = client.get("/api/admin/v1/clinics/c-1", headers=auth_headers())

    assert r.status_code == 200
    assert r.get_json()["clinic"]["id"] == "c-1"
```

- [ ] **Step 6: Run them to verify they fail**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_api.py -v
```

Expected: the five new tests fail with 404 (routes missing).

- [ ] **Step 7: Add the routes**

Append to `app/blueprints/admin_api/__init__.py`:

```python
# ---------------------------------------------------------------- clinics

VALID_STATUS = ("all", "active", "inactive")


@bp.get("/clinics")
@limiter.limit("120 per minute")
@require_admin
def clinics():
    status = request.args.get("status", "all")
    if status not in VALID_STATUS:
        return _err(400, "status must be one of: %s" % ", ".join(VALID_STATUS))
    try:
        return jsonify(admin_clinics.list_clinics(
            q=request.args.get("q") or None,
            status=status,
            city=request.args.get("city") or None,
            page=request.args.get("page", 1),
            per_page=request.args.get("per_page", admin_clinics.DEFAULT_PER_PAGE),
        ))
    except Exception:
        return _err(503, "database unavailable")


@bp.get("/clinics/<clinic_id>")
@limiter.limit("120 per minute")
@require_admin
def clinic_detail(clinic_id):
    try:
        row = admin_clinics.get_clinic(clinic_id)
    except Exception:
        return _err(503, "database unavailable")
    if not row:
        return _err(404, "clinic not found")
    return jsonify({"clinic": row})
```

Note the test asserts `page` and `per_page` reach the service as ints, so change the two `request.args.get` lines to coerce:

```python
            page=request.args.get("page", 1, type=int) or 1,
            per_page=request.args.get("per_page", admin_clinics.DEFAULT_PER_PAGE, type=int)
                     or admin_clinics.DEFAULT_PER_PAGE,
```

- [ ] **Step 8: Run the tests to verify they pass**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_api.py tests\test_admin_clinics.py -v
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add app/services/admin_clinics.py app/blueprints/admin_api/__init__.py tests/test_admin_clinics.py tests/test_admin_api.py
git commit -m "feat(admin-api): clinic list and detail

Search, status/city filters, pagination with a true total. Doctor and service
counts are batched per page — never one query per row."
```

---

## Task 7: The dashboard endpoint

**Files:**
- Modify: `app/services/stats.py`
- Modify: `app/blueprints/admin_api/__init__.py`
- Test: `tests/test_stats.py`, `tests/test_admin_api.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_stats.py`:

```python
# ---------------- admin_summary (the API payload) ----------------

def test_admin_summary_has_every_documented_key():
    with patch("app.services.stats.sb", return_value=fake_sb()):
        out = stats.admin_summary()

    assert set(out) == {"totals", "bookings_by_status", "bookings_by_day",
                        "new_users_by_day", "top_clinics", "recent_bookings"}
    assert set(out["totals"]) == {"clinics", "clinics_active", "doctors",
                                  "services_listed", "users", "bookings"}
    assert set(out["bookings_by_status"]) == {"new", "confirmed", "completed", "cancelled"}
    assert len(out["bookings_by_day"]) == 14
    assert len(out["new_users_by_day"]) == 14


def test_admin_summary_groups_raw_statuses_into_the_four_buckets():
    bookings = [
        {"status": "pending", "clinic_id": "c-1", "clinic_name": "A", "created_at": "2026-08-12T10:00:00"},
        {"status": "lead", "clinic_id": "c-1", "clinic_name": "A", "created_at": "2026-08-12T10:00:00"},
        {"status": "registered", "clinic_id": "c-2", "clinic_name": "B", "created_at": "2026-08-12T10:00:00"},
        {"status": "completed", "clinic_id": "c-2", "clinic_name": "B", "created_at": "2026-08-12T10:00:00"},
        {"status": "no_show", "clinic_id": "c-2", "clinic_name": "B", "created_at": "2026-08-12T10:00:00"},
    ]
    with patch("app.services.stats.sb", return_value=fake_sb(bookings=bookings)):
        out = stats.admin_summary()

    assert out["bookings_by_status"] == {"new": 2, "confirmed": 1,
                                         "completed": 1, "cancelled": 1}


def test_admin_summary_total_bookings_is_a_count_not_the_page_length():
    bookings = [{"status": "pending", "clinic_id": "c-1", "clinic_name": "A",
                 "created_at": "2026-08-12T10:00:00"}]
    with patch("app.services.stats.sb",
               return_value=fake_sb(bookings=bookings, counts={"sx_bookings": 91234})):
        out = stats.admin_summary()

    assert out["totals"]["bookings"] == 91234, \
        "must be an exact count — the panel's len(rows) stops being true past 3000"


def test_admin_summary_top_clinics_carry_an_id():
    bookings = [{"status": "pending", "clinic_id": "c-1", "clinic_name": "A",
                 "created_at": "2026-08-12T10:00:00"}]
    with patch("app.services.stats.sb", return_value=fake_sb(bookings=bookings)):
        out = stats.admin_summary()

    assert out["top_clinics"][0]["clinic_id"] == "c-1"
    assert out["top_clinics"][0]["name"] == "A"
    assert out["top_clinics"][0]["n"] == 1


def test_admin_summary_day_series_use_n_not_count():
    with patch("app.services.stats.sb", return_value=fake_sb()):
        out = stats.admin_summary()

    assert set(out["bookings_by_day"][0]) == {"date", "n"}
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
.\.venv\Scripts\python -m pytest tests\test_stats.py -v
```

Expected: FAIL — `module 'app.services.stats' has no attribute 'admin_summary'`.

- [ ] **Step 3: Implement `admin_summary`**

Append to `app/services/stats.py`:

```python
from .clinic_services import (BOOKING_NEW, BOOKING_CONFIRMED,
                              BOOKING_DONE, BOOKING_CANCELLED)

BOOKING_SAMPLE = 3000          # rows pulled for the day/status breakdowns


def _bucket(status):
    s = (status or "").lower()
    if s in BOOKING_NEW:
        return "new"
    if s in BOOKING_CONFIRMED:
        return "confirmed"
    if s in BOOKING_DONE:
        return "completed"
    if s in BOOKING_CANCELLED:
        return "cancelled"
    return None


def _last_14_days():
    today = date.today()
    return [(today - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]


def _series(rows, days):
    seen = Counter((r.get("created_at") or "")[:10] for r in rows)
    return [{"date": d, "n": seen.get(d, 0)} for d in days]


def admin_summary():
    """The Admin API dashboard payload. Every figure comes from data already
    recorded — nothing here needs the visitor tracking of Piece 2.

    Differs from platform_summary() on purpose: statuses are grouped into the four
    canonical buckets, totals.bookings is a real count rather than the length of a
    capped sample, and top_clinics carries the clinic id so the UI can link to it.
    """
    days = _last_14_days()

    try:
        bookings = (sb().table("sx_bookings")
                    .select("id,status,clinic_id,clinic_name,patient_name,starts_at,created_at")
                    .neq("status", "unverified")
                    .order("created_at", desc=True)
                    .limit(BOOKING_SAMPLE).execute().data or [])
    except Exception:
        bookings = []

    try:
        users = (sb().table("users").select("created_at")
                 .order("created_at", desc=True).limit(BOOKING_SAMPLE).execute().data or [])
    except Exception:
        users = []

    by_status = {"new": 0, "confirmed": 0, "completed": 0, "cancelled": 0}
    for b in bookings:
        bucket = _bucket(b.get("status"))
        if bucket:
            by_status[bucket] += 1

    per_clinic = {}
    for b in bookings:
        cid = b.get("clinic_id")
        if not cid:
            continue
        entry = per_clinic.setdefault(cid, {"clinic_id": cid,
                                            "name": b.get("clinic_name") or "\u2014", "n": 0})
        entry["n"] += 1
    top_clinics = sorted(per_clinic.values(), key=lambda x: x["n"], reverse=True)[:5]

    return {
        "totals": {
            "clinics": count_rows("clinics"),
            "clinics_active": count_rows("clinics", is_active=True),
            "doctors": count_rows("doctors"),
            "services_listed": count_rows("department_services"),
            "users": count_rows("users"),
            "bookings": count_rows("sx_bookings"),
        },
        "bookings_by_status": by_status,
        "bookings_by_day": _series(bookings, days),
        "new_users_by_day": _series(users, days),
        "top_clinics": top_clinics,
        "recent_bookings": [
            {"id": b.get("id"), "clinic_name": b.get("clinic_name"),
             "patient_name": b.get("patient_name"), "status": b.get("status"),
             "starts_at": b.get("starts_at"), "created_at": b.get("created_at")}
            for b in bookings[:10]
        ],
    }
```

Move the `from .clinic_services import ...` line to the top of the file with the other imports.

- [ ] **Step 4: Run the tests to verify they pass**

```powershell
.\.venv\Scripts\python -m pytest tests\test_stats.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Add the HTTP test**

Append to `tests/test_admin_api.py`:

```python
# ---------------- dashboard ----------------

def test_dashboard_requires_a_token(client):
    r = client.get("/api/admin/v1/dashboard/summary")
    assert r.status_code == 401


def test_dashboard_returns_the_summary(client):
    payload = {"totals": {"clinics": 1}, "bookings_by_status": {},
               "bookings_by_day": [], "new_users_by_day": [],
               "top_clinics": [], "recent_bookings": []}
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.stats.admin_summary", return_value=payload):
        r = client.get("/api/admin/v1/dashboard/summary", headers=auth_headers())

    assert r.status_code == 200
    assert r.get_json() == payload


def test_dashboard_reports_a_dead_database_instead_of_faking_zeros(client):
    with patch("app.blueprints.admin_api.admin_auth.verify_token",
               return_value=dict(ADMIN, _session_id="s-1")), \
         patch("app.blueprints.admin_api.stats.admin_summary",
               side_effect=RuntimeError("Supabase offline")):
        r = client.get("/api/admin/v1/dashboard/summary", headers=auth_headers())

    assert r.status_code == 503
```

- [ ] **Step 6: Run it to verify it fails, then add the route**

```powershell
.\.venv\Scripts\python -m pytest tests\test_admin_api.py -v
```

Expected: the three new tests 404.

Append to `app/blueprints/admin_api/__init__.py`:

```python
# ---------------------------------------------------------------- dashboard

@bp.get("/dashboard/summary")
@limiter.limit("120 per minute")
@require_admin
def dashboard_summary():
    try:
        return jsonify(stats.admin_summary())
    except Exception:
        return _err(503, "database unavailable")
```

- [ ] **Step 7: Run the whole suite**

```powershell
.\.venv\Scripts\python -m pytest tests -q
```

Expected: everything passes.

- [ ] **Step 8: Commit**

```bash
git add app/services/stats.py app/blueprints/admin_api/__init__.py tests/test_stats.py tests/test_admin_api.py
git commit -m "feat(admin-api): dashboard summary endpoint

Groups raw booking statuses into the four canonical buckets, reports a true
booking count rather than the panel's capped sample length, and returns 503
rather than a convincing page of zeros when the database is unreachable."
```

---

## Task 8: Bootstrap the owner's administrator account

Without this the first login fails and Piece 1 is unusable: today the admin role is granted only via Telegram (`auth._is_admin_tg`), while this API logs in with phone + password.

**Files:**
- Create: `scripts/grant_admin.py`

- [ ] **Step 1: Write the script**

Create `scripts/grant_admin.py`:

```python
"""One-off: make a phone number an Admin-API administrator.

    $env:SYMPTEX_ADMIN_PASSWORD = "..."      # PowerShell
    export SYMPTEX_ADMIN_PASSWORD='...'      # bash
    python scripts/grant_admin.py +998901234567

The password comes from the environment, never from argv: a command-line argument
is visible in shell history and in the process list of every other user on the box.

Ensures the users row exists, is active, carries the admin role and has a password
hash. Idempotent. Prints what it changed. Run on the server (or locally with .env).
"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

# create_app() reads os.environ only — it does NOT load .env itself (verified
# 2026-08-12). wsgi.py is what loads it in production, so a script that skips
# wsgi must do this or sb() silently runs offline and every write no-ops.
from dotenv import load_dotenv                                # noqa: E402
load_dotenv(_ROOT / ".env")

from app import create_app                                    # noqa: E402
from app import auth                                          # noqa: E402
from app.extensions import sb                                  # noqa: E402


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    raw_phone = sys.argv[1]
    password = os.environ.get("SYMPTEX_ADMIN_PASSWORD") or ""
    if not password:
        print("Set SYMPTEX_ADMIN_PASSWORD in the environment first (see the docstring).")
        return 1
    if len(password) < 8:
        print("Refusing: choose a password of at least 8 characters.")
        return 1

    app = create_app()
    with app.app_context():
        c = sb()
        if c is None:
            print("Supabase is offline — check .env (SUPABASE_URL / SUPABASE_SERVICE_KEY).")
            return 1

        phone = auth.normalize_phone(raw_phone)
        if not phone:
            print("Could not normalise %r into a phone number." % raw_phone)
            return 1

        rows = c.table("users").select("*").eq("phone", phone).limit(1).execute().data or []
        if rows:
            user = rows[0]
            print("Found existing user %s" % user["id"])
        else:
            user = c.table("users").insert(
                {"phone": phone, "roles": ["admin"], "is_active": True}).execute().data[0]
            print("Created user %s" % user["id"])

        roles = list(user.get("roles") or [])
        changes = {}
        if "admin" not in roles:
            roles.append("admin")
            changes["roles"] = roles
            print("  + granting admin role")
        if user.get("is_active") is False:
            changes["is_active"] = True
            print("  + reactivating account")
        if changes:
            c.table("users").update(changes).eq("id", user["id"]).execute()

        if not auth.set_password(user["id"], password):
            print("FAILED to set the password.")
            return 1
        print("  + password set, must_change_password cleared")

        check = auth.verify_password(phone, password)
        if not check:
            print("VERIFY FAILED — verify_password rejected the new password.")
            return 1
        if "admin" not in (check.get("roles") or []):
            print("VERIFY FAILED — the account still lacks the admin role.")
            return 1

        print("OK: %s can now sign in to Symptex Admin." % phone)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run it against the live database**

The owner supplied these on 2026-08-12: phone **+998 33 322 22 88**, and a password
of their choosing. **The password must never be written into a file, a commit, a log
line, or a command argument** — pass it through the environment and clear it after:

```powershell
cd C:\Users\user\Desktop\symptex-next
$env:SYMPTEX_ADMIN_PASSWORD = "<the password the owner gave>"
.\.venv\Scripts\python scripts\grant_admin.py "+998333222288"
Remove-Item Env:\SYMPTEX_ADMIN_PASSWORD
```

Expected final line: `OK: +998333222288 can now sign in to Symptex Admin.`

The script stores only a hash (`auth.set_password` → werkzeug), never the password
itself.

- [ ] **Step 3: Prove login works end to end against the local server**

With `flask run` up:

```powershell
$env:SYMPTEX_ADMIN_PASSWORD = "<the password the owner gave>"
$body = @{ phone = "+998333222288"; password = $env:SYMPTEX_ADMIN_PASSWORD } | ConvertTo-Json
$r = Invoke-RestMethod -Uri http://127.0.0.1:5000/api/admin/v1/auth/login -Method Post -Body $body -ContentType "application/json"
$r.user
$r.token.Substring(0,10) + "..."
```

Never print `$body` or the full token to the transcript.

Expected: the user object prints and a token is returned. **This is an acceptance criterion of Piece 1 — do not proceed until it passes.**

- [ ] **Step 4: Prove the token works**

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/admin/v1/dashboard/summary -Headers @{ Authorization = "Bearer $($r.token)" } | ConvertTo-Json -Depth 4
```

Expected: real figures from the live database — clinic and user counts that match reality.

- [ ] **Step 5: Commit**

```bash
git add scripts/grant_admin.py
git commit -m "feat(admin-api): grant_admin bootstrap script

The admin role was only ever granted through Telegram login; the Admin API
signs in with phone + password, so without this the owner cannot log in at all."
```

---

## Task 9: Deploy the server side

Follow the flow already established on this server. **Never `git merge --ff-only`** — the owner commits UI/CSS work directly on `master` in parallel.

- [ ] **Step 1: Push the branch**

```bash
cd /c/Users/user/Desktop/symptex-next
git push origin feat/admin-api
```

- [ ] **Step 2: Test on the dev instance first**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex-next-dev && git fetch && git checkout feat/admin-api && git pull && systemctl restart sxdev && sleep 3 && curl -s localhost:8013/api/admin/v1/health'
```

Expected: `{"ok":true,"version":"1.0.0"}`.

If `sxdev` fails to start, check that its unit still has
`--property=EnvironmentFile=/var/www/symptex-next/.env` — without it `sb()` runs
offline and every database feature silently returns nothing.

- [ ] **Step 3: Run the tests on the server**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests -q'
```

Expected: all pass.

- [ ] **Step 4: Merge to master and reload the live site**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex-next && git fetch && git merge --no-edit feat/admin-api'
ssh root@45.77.242.169 'systemctl reload symptex-next'
```

Check the merge actually succeeded (do not pipe it into `tail`, which hides a
non-zero exit status):

```bash
ssh root@45.77.242.169 'cd /var/www/symptex-next && git log --oneline -1 && git status --short'
```

- [ ] **Step 5: Verify live**

```bash
curl -s https://symptex.uz/api/admin/v1/health
curl -s -o /dev/null -w '%{http_code}\n' https://symptex.uz/ru/
curl -s -o /dev/null -w '%{http_code}\n' https://symptex.uz/api/admin/v1/me
```

Expected: the health JSON, `200` for the site, and `401` for `/me` without a token.

---

# PHASE B — THE DESKTOP PROGRAM

## Task 10: Scaffold the client repo

**Files:**
- Create: `symptex-admin/` — `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Create the project**

```powershell
cd C:\Users\user\Desktop
mkdir symptex-admin
cd symptex-admin
npm init -y
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install react react-dom lucide-react
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react `
  tailwindcss @tailwindcss/vite electron electron-builder concurrently wait-on `
  vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom `
  jest-axe @types/jest-axe
```

- [ ] **Step 3: Write the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',                       // required: Electron loads the build over file://
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Symptex Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules/
dist/
release/
*.local
.DS_Store
```

Add to `package.json` `"scripts"`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "electron:dev": "concurrently -k \"vite\" \"wait-on tcp:5173 && electron .\"",
    "dist": "npm run build && electron-builder"
  },
  "main": "electron/main.cjs"
}
```

- [ ] **Step 4: Set the design tokens**

**Owner's decision (2026-08-12): the admin program does NOT follow the public
symptex.uz design system.** That system — square corners, serif headings, teal for
action and periwinkle for reference, never red — is for the patient-facing site.
This is an internal tool used for hours at a time, so it gets a plain, functional
look optimised for reading data quickly. Do not import the public site's CSS and do
not copy its editorial spacing.

The palette below is still calm-clinical rather than shadcn grey, per `CLAUDE.md`.
Unlike the public site, a danger colour **is** used here — an admin needs errors to
be unmistakable. Create `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #eef6ff;
  --color-brand-100: #d9ecff;
  --color-brand-500: #2f7ec4;
  --color-brand-600: #256aa8;
  --color-brand-700: #1d5285;

  --color-ink-900: #12222f;
  --color-ink-700: #33485a;
  --color-ink-500: #63788a;
  --color-ink-200: #dbe4ec;
  --color-ink-100: #eef3f7;
  --color-surface:  #f7fafc;
  --color-card:     #ffffff;

  --color-ok:    #1f9d6b;
  --color-warn:  #c98a1b;
  --color-danger:#c0473f;

  --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;
  --radius-card: 12px;
}

html, body, #root { height: 100%; }
body { background: var(--color-surface); color: var(--color-ink-900); }
```

Create `src/tokens.ts` mirroring the same values so TypeScript code (charts) can use them:

```ts
export const tokens = {
  brand: { 50: '#eef6ff', 100: '#d9ecff', 500: '#2f7ec4', 600: '#256aa8', 700: '#1d5285' },
  ink: { 900: '#12222f', 700: '#33485a', 500: '#63788a', 200: '#dbe4ec', 100: '#eef3f7' },
  surface: '#f7fafc',
  card: '#ffffff',
  ok: '#1f9d6b',
  warn: '#c98a1b',
  danger: '#c0473f',
} as const
```

> **Rule from `CLAUDE.md`: never use emojis in this UI. Icons come from `lucide-react`.**

- [ ] **Step 5: Minimal app entry so the build is provable**

`src/main.tsx`:

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```

`src/App.tsx`:

```tsx
export default function App() {
  return <div className="p-8 text-ink-900">Symptex Admin</div>
}
```

`tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Verify it builds and runs**

```powershell
npm run build
npm run dev
```

Expected: `npm run build` succeeds; `npm run dev` serves http://localhost:5173 showing "Symptex Admin".

- [ ] **Step 7: Commit**

```bash
cd /c/Users/user/Desktop/symptex-admin
git init
git add -A
git commit -m "chore: scaffold Symptex Admin (Vite + React + TS + Tailwind v4)

Brand tokens taken from the live symptex.uz palette, not shadcn defaults."
```

---

## Task 11: The Electron shell

**Files:**
- Create: `electron/main.cjs`, `electron/preload.cjs`, `src/bridge.ts`
- Test: `tests/bridge.test.ts`

Plain CommonJS on purpose: the main process then needs no build step, so there is
exactly one bundler in this project.

- [ ] **Step 1: Write the main process**

`electron/main.cjs`:

```js
'use strict'
const { app, BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

const DEV_URL = 'http://localhost:5173'
const isDev = !app.isPackaged

const ENVIRONMENTS = {
  live: 'https://symptex.uz',
  local: 'http://127.0.0.1:5000',
}

function statePath(name) {
  return path.join(app.getPath('userData'), name)
}

function readEnvironment() {
  try {
    const raw = fs.readFileSync(statePath('environment.json'), 'utf8')
    const name = JSON.parse(raw).name
    if (ENVIRONMENTS[name]) return name
  } catch (e) { /* first run — fall through to the default */ }
  return 'live'
}

function writeEnvironment(name) {
  if (!ENVIRONMENTS[name]) throw new Error('unknown environment: ' + name)
  fs.writeFileSync(statePath('environment.json'), JSON.stringify({ name }), 'utf8')
  return name
}

function readToken() {
  try {
    const buf = fs.readFileSync(statePath('session.bin'))
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(buf)
  } catch (e) {
    return null
  }
}

function writeToken(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('This computer cannot store the session securely.')
  }
  fs.writeFileSync(statePath('session.bin'), safeStorage.encryptString(token))
}

function clearToken() {
  try { fs.unlinkSync(statePath('session.bin')) } catch (e) { /* already gone */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f7fafc',
    title: 'Symptex Admin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)
  if (isDev) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('token:get', () => readToken())
ipcMain.handle('token:set', (_e, token) => { writeToken(token); return true })
ipcMain.handle('token:clear', () => { clearToken(); return true })
ipcMain.handle('env:get', () => {
  const name = readEnvironment()
  return { name, baseUrl: ENVIRONMENTS[name] }
})
ipcMain.handle('env:set', (_e, name) => {
  writeEnvironment(name)
  return { name, baseUrl: ENVIRONMENTS[name] }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
```

- [ ] **Step 2: Write the preload**

`electron/preload.cjs`:

```js
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

// Exactly five functions cross the bridge. Nothing else is exposed to the page.
contextBridge.exposeInMainWorld('symptex', {
  getToken: () => ipcRenderer.invoke('token:get'),
  setToken: (t) => ipcRenderer.invoke('token:set', t),
  clearToken: () => ipcRenderer.invoke('token:clear'),
  getEnvironment: () => ipcRenderer.invoke('env:get'),
  setEnvironment: (name) => ipcRenderer.invoke('env:set', name),
})
```

- [ ] **Step 3: Write the failing bridge test**

`tests/bridge.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { bridge } from '../src/bridge'

describe('bridge', () => {
  beforeEach(() => { delete (globalThis as any).window.symptex })

  it('falls back to in-memory storage outside Electron', async () => {
    await bridge.setToken('abc')
    expect(await bridge.getToken()).toBe('abc')
    await bridge.clearToken()
    expect(await bridge.getToken()).toBeNull()
  })

  it('defaults to the live environment', async () => {
    expect((await bridge.getEnvironment()).name).toBe('live')
    expect((await bridge.getEnvironment()).baseUrl).toBe('https://symptex.uz')
  })

  it('prefers the Electron bridge when it exists', async () => {
    ;(globalThis as any).window.symptex = {
      getToken: async () => 'from-electron',
      setToken: async () => true,
      clearToken: async () => true,
      getEnvironment: async () => ({ name: 'local', baseUrl: 'http://127.0.0.1:5000' }),
      setEnvironment: async () => ({ name: 'local', baseUrl: 'http://127.0.0.1:5000' }),
    }
    expect(await bridge.getToken()).toBe('from-electron')
    expect((await bridge.getEnvironment()).name).toBe('local')
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — `Cannot find module '../src/bridge'`.

- [ ] **Step 5: Write the bridge**

`src/bridge.ts`:

```ts
export type EnvironmentName = 'live' | 'local'
export interface Environment { name: EnvironmentName; baseUrl: string }

interface SymptexBridge {
  getToken(): Promise<string | null>
  setToken(token: string): Promise<boolean>
  clearToken(): Promise<boolean>
  getEnvironment(): Promise<Environment>
  setEnvironment(name: EnvironmentName): Promise<Environment>
}

declare global {
  interface Window { symptex?: SymptexBridge }
}

const FALLBACK_URLS: Record<EnvironmentName, string> = {
  live: 'https://symptex.uz',
  local: 'http://127.0.0.1:5000',
}

// Used when the app runs in a plain browser (vitest, `npm run dev` without
// Electron). Deliberately memory-only: a browser must never persist the token.
let memoryToken: string | null = null
let memoryEnv: EnvironmentName = 'live'

export const bridge: SymptexBridge = {
  async getToken() {
    return window.symptex ? window.symptex.getToken() : memoryToken
  },
  async setToken(token: string) {
    if (window.symptex) return window.symptex.setToken(token)
    memoryToken = token
    return true
  },
  async clearToken() {
    if (window.symptex) return window.symptex.clearToken()
    memoryToken = null
    return true
  },
  async getEnvironment() {
    if (window.symptex) return window.symptex.getEnvironment()
    return { name: memoryEnv, baseUrl: FALLBACK_URLS[memoryEnv] }
  },
  async setEnvironment(name: EnvironmentName) {
    if (window.symptex) return window.symptex.setEnvironment(name)
    memoryEnv = name
    return { name, baseUrl: FALLBACK_URLS[name] }
  },
}
```

- [ ] **Step 6: Run it to verify it passes**

```powershell
npm test
```

Expected: 3 passed.

- [ ] **Step 7: Launch the real Electron window**

```powershell
npm run electron:dev
```

Expected: a desktop window titled "Symptex Admin" showing the placeholder text — no browser chrome, no menu bar.

- [ ] **Step 8: Commit**

```bash
git add electron src/bridge.ts tests/bridge.test.ts package.json
git commit -m "feat(shell): Electron window with safeStorage token and env switch

contextIsolation on, five functions across the bridge, token encrypted at rest
by the OS. Browser fallback is memory-only so a token is never persisted there."
```

---

## Task 12: The API client

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/api/admin.ts`
- Test: `tests/api.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, request, setUnauthorizedHandler } from '../src/api/client'
import { bridge } from '../src/bridge'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

describe('api client', () => {
  beforeEach(async () => {
    await bridge.clearToken()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()          // stubGlobal does not survive restoreAllMocks
  })

  it('prefixes the base url and sends no auth header when logged out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/health')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://symptex.uz/api/admin/v1/health')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sends the bearer token when one is stored', async () => {
    await bridge.setToken('s-1.secret')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/me')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s-1.secret')
  })

  it('throws ApiError carrying the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'wrong phone or password' }, 401)))

    await expect(request('/me')).rejects.toThrowError(ApiError)
    await expect(request('/me')).rejects.toMatchObject({
      status: 401, message: 'wrong phone or password',
    })
  })

  it('calls the unauthorized handler on 401 so the app can log out', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 401)))

    await request('/me').catch(() => undefined)

    expect(onUnauthorized).toHaveBeenCalledOnce()
    setUnauthorizedHandler(null)
  })

  it('reports an unreachable server as a network error, not as empty data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(request('/health')).rejects.toMatchObject({
      status: 0, isNetworkError: true,
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — `Cannot find module '../src/api/client'`.

- [ ] **Step 3: Write the types**

`src/api/types.ts`:

```ts
export interface AdminUser { id: string; phone: string; name: string; roles: string[] }

export interface LoginResponse { token: string; expires_at: string; user: AdminUser }

export interface DaySeriesPoint { date: string; n: number }

export interface DashboardSummary {
  totals: {
    clinics: number
    clinics_active: number
    doctors: number
    services_listed: number
    users: number
    bookings: number
  }
  bookings_by_status: { new: number; confirmed: number; completed: number; cancelled: number }
  bookings_by_day: DaySeriesPoint[]
  new_users_by_day: DaySeriesPoint[]
  /** Busiest clinics within `window_days`, not all-time. */
  top_clinics: { clinic_id: string; name: string; n: number }[]
  recent_bookings: {
    id: string
    clinic_name: string | null
    patient_name: string | null
    status: string
    starts_at: string | null
    created_at: string
  }[]
  /** Period the series and top_clinics cover. */
  window_days: number
  /** True if a window query hit its row ceiling — the UI must warn, not under-report. */
  truncated: boolean
}

export interface ClinicRow {
  id: string
  name_ru: string | null
  name: string | null
  slug: string | null
  city: string | null
  district: string | null
  clinic_type: string | null
  is_active: boolean
  created_at: string
  logo_url: string | null
  phone: string | null
  doctors_n: number
  services_n: number
}

export interface ClinicPage {
  items: ClinicRow[]
  total: number
  page: number
  per_page: number
}

export type ClinicStatus = 'all' | 'active' | 'inactive'
```

- [ ] **Step 4: Write the client**

`src/api/client.ts`:

```ts
import { bridge } from '../bridge'

const PREFIX = '/api/admin/v1'

export class ApiError extends Error {
  status: number
  isNetworkError: boolean
  constructor(message: string, status: number, isNetworkError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isNetworkError = isNetworkError
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const env = await bridge.getEnvironment()
  const token = await bridge.getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(env.baseUrl + PREFIX + path, { ...init, headers })
  } catch {
    // A dashboard of zeros is worse than an error: never let this look like data.
    throw new ApiError('Cannot reach the Symptex server.', 0, true)
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
    const message = (body as { error?: string } | null)?.error
      ?? `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return body as T
}
```

- [ ] **Step 5: Write the endpoint functions**

`src/api/admin.ts`:

```ts
import { request } from './client'
import type {
  ClinicPage, ClinicRow, ClinicStatus, DashboardSummary, LoginResponse, AdminUser,
} from './types'

export const api = {
  health: () => request<{ ok: boolean; version: string }>('/health'),

  login: (phone: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: AdminUser }>('/me'),

  dashboard: () => request<DashboardSummary>('/dashboard/summary'),

  clinics: (params: {
    q?: string; status?: ClinicStatus; city?: string; page?: number; per_page?: number
  } = {}) => {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.city) query.set('city', params.city)
    if (params.page) query.set('page', String(params.page))
    if (params.per_page) query.set('per_page', String(params.per_page))
    const qs = query.toString()
    return request<ClinicPage>('/clinics' + (qs ? `?${qs}` : ''))
  },

  clinic: (id: string) => request<{ clinic: ClinicRow }>(`/clinics/${encodeURIComponent(id)}`),
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```powershell
npm test
npx tsc --noEmit
```

Expected: 8 passed (3 bridge + 5 api); no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/api tests/api.test.ts
git commit -m "feat(api): typed admin API client

URLs live in exactly one file. A dead server raises a network error rather
than resolving to empty data."
```

---

## Task 13: Session and login screen

**Files:**
- Create: `src/auth/SessionContext.tsx`, `src/auth/LoginScreen.tsx`, `src/components/DataStates.tsx`
- Modify: `src/App.tsx`
- Test: `tests/login.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { LoginScreen } from '../src/auth/LoginScreen'

function renderLogin(signIn: (phone: string, password: string) => Promise<void>) {
  return render(<LoginScreen onSubmit={signIn} environmentName="live" />)
}

describe('LoginScreen', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows which server it will sign in to', () => {
    renderLogin(vi.fn())
    expect(screen.getByText(/symptex\.uz/i)).toBeInTheDocument()
  })

  it('will not submit an empty form', async () => {
    const signIn = vi.fn()
    renderLogin(signIn)
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))
    expect(signIn).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/телефон|пароль/i)
  })

  it('submits the phone and password', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    renderLogin(signIn)
    await userEvent.type(screen.getByLabelText(/телефон/i), '+998901234567')
    await userEvent.type(screen.getByLabelText(/пароль/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('+998901234567', 'secret123'))
  })

  it('shows the server error and keeps what was typed', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('wrong phone or password'))
    renderLogin(signIn)
    await userEvent.type(screen.getByLabelText(/телефон/i), '+998901234567')
    await userEvent.type(screen.getByLabelText(/пароль/i), 'nope')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong phone or password/i)
    expect(screen.getByLabelText(/телефон/i)).toHaveValue('+998901234567')
  })

  it('disables the button while signing in', async () => {
    let release: () => void = () => undefined
    const signIn = vi.fn().mockImplementation(() => new Promise<void>((r) => { release = r }))
    renderLogin(signIn)
    await userEvent.type(screen.getByLabelText(/телефон/i), '+998901234567')
    await userEvent.type(screen.getByLabelText(/пароль/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))
    expect(screen.getByRole('button', { name: /вход/i })).toBeDisabled()
    release()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderLogin(vi.fn())
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

Add to `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — `Cannot find module '../src/auth/LoginScreen'`.

- [ ] **Step 3: Write the shared state components**

`src/components/DataStates.tsx`:

```tsx
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'

export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-8 text-ink-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center text-ink-500">
      <Inbox className="h-6 w-6" aria-hidden="true" />
      <p className="font-medium text-ink-700">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-xl border border-danger/30 bg-danger/5 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium text-ink-900">Не удалось загрузить данные</p>
          <p className="mt-1 text-sm text-ink-700">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-card px-3 py-1.5 text-sm hover:bg-ink-100"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Повторить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the login screen**

`src/auth/LoginScreen.tsx`:

```tsx
import { useState } from 'react'
import { LogIn, ShieldCheck } from 'lucide-react'

export interface LoginScreenProps {
  onSubmit: (phone: string, password: string) => Promise<void>
  environmentName: 'live' | 'local'
}

const ENV_LABEL: Record<LoginScreenProps['environmentName'], string> = {
  live: 'symptex.uz',
  local: '127.0.0.1:5000 (локальный)',
}

export function LoginScreen({ onSubmit, environmentName }: LoginScreenProps) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !password) {
      setError('Введите телефон и пароль.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(phone.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-ink-200 bg-card p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Symptex Admin</h1>
        </div>

        <p className="mb-6 text-sm text-ink-500">
          Вход на сервер <span className="font-medium text-ink-700">{ENV_LABEL[environmentName]}</span>
        </p>

        <label className="mb-1 block text-sm font-medium" htmlFor="phone">Телефон</label>
        <input
          id="phone"
          type="tel"
          autoComplete="username"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-4 w-full rounded-lg border border-ink-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        <label className="mb-1 block text-sm font-medium" htmlFor="password">Пароль</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-ink-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Write the session context**

`src/auth/SessionContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/admin'
import { setUnauthorizedHandler } from '../api/client'
import { bridge, type Environment } from '../bridge'
import type { AdminUser } from '../api/types'

interface SessionValue {
  user: AdminUser | null
  environment: Environment | null
  ready: boolean
  signIn: (phone: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [ready, setReady] = useState(false)

  const signOut = useCallback(async () => {
    try { await api.logout() } catch { /* the session may already be gone */ }
    await bridge.clearToken()
    setUser(null)
  }, [])

  useEffect(() => {
    // A 401 anywhere means the stored token is dead — drop it and show login.
    setUnauthorizedHandler(() => {
      void bridge.clearToken()
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const env = await bridge.getEnvironment()
      if (!cancelled) setEnvironment(env)
      const token = await bridge.getToken()
      if (token) {
        try {
          const me = await api.me()
          if (!cancelled) setUser(me.user)
        } catch {
          await bridge.clearToken()
        }
      }
      if (!cancelled) setReady(true)
    }
    void restore()
    return () => { cancelled = true }
  }, [])

  const signIn = useCallback(async (phone: string, password: string) => {
    const result = await api.login(phone, password)
    await bridge.setToken(result.token)
    setUser(result.user)
  }, [])

  const value = useMemo(
    () => ({ user, environment, ready, signIn, signOut }),
    [user, environment, ready, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```powershell
npm test
npx tsc --noEmit
```

Expected: all pass including the axe check.

- [ ] **Step 7: Commit**

```bash
git add src/auth src/components/DataStates.tsx tests/login.test.tsx tests/setup.ts
git commit -m "feat(auth): session context and login screen

Shows which server it signs in to, surfaces the server's own error text, and
a 401 anywhere drops the stored token and returns to login."
```

---

## Task 14: The app shell

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Test: `tests/shell.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/shell.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { AppShell } from '../src/components/AppShell'

const user = { id: 'u-1', phone: '+998901234567', name: 'Owner', roles: ['admin'] }

describe('AppShell', () => {
  it('lists the Piece 1 sections', () => {
    render(
      <AppShell user={user} environmentName="live" onSignOut={vi.fn()}
                active="dashboard" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: /обзор/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /клиники/i })).toBeInTheDocument()
  })

  it('navigates when a section is clicked', async () => {
    const onNavigate = vi.fn()
    render(
      <AppShell user={user} environmentName="live" onSignOut={vi.fn()}
                active="dashboard" onNavigate={onNavigate}>
        <div>content</div>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: /клиники/i }))
    expect(onNavigate).toHaveBeenCalledWith('clinics')
  })

  it('warns visibly when pointed at the local server', () => {
    render(
      <AppShell user={user} environmentName="local" onSignOut={vi.fn()}
                active="dashboard" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>,
    )
    expect(screen.getByText(/локальный/i)).toBeInTheDocument()
  })

  it('signs out', async () => {
    const onSignOut = vi.fn()
    render(
      <AppShell user={user} environmentName="live" onSignOut={onSignOut}
                active="dashboard" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: /выйти/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <AppShell user={user} environmentName="live" onSignOut={vi.fn()}
                active="dashboard" onNavigate={vi.fn()}>
        <div>content</div>
      </AppShell>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the shell**

`src/components/AppShell.tsx`:

```tsx
import { Building2, LayoutDashboard, LogOut } from 'lucide-react'
import type { AdminUser } from '../api/types'

export type ScreenName = 'dashboard' | 'clinics'

const SECTIONS: { id: ScreenName; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Обзор', Icon: LayoutDashboard },
  { id: 'clinics', label: 'Клиники', Icon: Building2 },
]

export interface AppShellProps {
  user: AdminUser
  environmentName: 'live' | 'local'
  active: ScreenName
  onNavigate: (screen: ScreenName) => void
  onSignOut: () => void
  children: React.ReactNode
}

export function AppShell({
  user, environmentName, active, onNavigate, onSignOut, children,
}: AppShellProps) {
  return (
    <div className="flex h-full">
      <nav aria-label="Разделы" className="flex w-56 flex-col border-r border-ink-200 bg-card p-3">
        <div className="mb-6 px-2 pt-2">
          <p className="text-sm font-semibold">Symptex Admin</p>
          {environmentName === 'local' && (
            <p className="mt-1 rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn">
              локальный сервер
            </p>
          )}
        </div>

        <ul className="flex flex-1 flex-col gap-1">
          {SECTIONS.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active === id ? 'page' : undefined}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ' +
                  (active === id
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-ink-700 hover:bg-ink-100')
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-ink-200 pt-3">
          <p className="px-3 text-xs text-ink-500">{user.name}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Выйти
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Wire up `App.tsx`**

```tsx
import { useState } from 'react'
import { SessionProvider, useSession } from './auth/SessionContext'
import { LoginScreen } from './auth/LoginScreen'
import { AppShell, type ScreenName } from './components/AppShell'
import { Loading } from './components/DataStates'
import { DashboardScreen } from './screens/dashboard/DashboardScreen'
import { ClinicsScreen } from './screens/clinics/ClinicsScreen'

function Authenticated() {
  const { user, environment, ready, signIn, signOut } = useSession()
  const [screen, setScreen] = useState<ScreenName>('dashboard')

  if (!ready || !environment) return <Loading label="Запуск…" />
  if (!user) return <LoginScreen onSubmit={signIn} environmentName={environment.name} />

  return (
    <AppShell
      user={user}
      environmentName={environment.name}
      active={screen}
      onNavigate={setScreen}
      onSignOut={() => void signOut()}
    >
      {screen === 'dashboard' ? <DashboardScreen /> : <ClinicsScreen />}
    </AppShell>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <Authenticated />
    </SessionProvider>
  )
}
```

`DashboardScreen` and `ClinicsScreen` arrive in Tasks 15 and 16 — this task's tests
cover `AppShell` alone. Create the two screens as one-line placeholders now so the
build passes, then replace them:

`src/screens/dashboard/DashboardScreen.tsx`:
```tsx
export function DashboardScreen() { return <div className="p-6">Обзор</div> }
```

`src/screens/clinics/ClinicsScreen.tsx`:
```tsx
export function ClinicsScreen() { return <div className="p-6">Клиники</div> }
```

- [ ] **Step 5: Run the tests and the build**

```powershell
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass.

- [ ] **Step 6: Log in for real**

Start the local Flask server, then:

```powershell
npm run electron:dev
```

Sign in with the phone and password from Task 8. Expected: the login screen is
replaced by the shell with "Обзор" and "Клиники" in the sidebar.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppShell.tsx src/App.tsx src/screens tests/shell.test.tsx
git commit -m "feat(shell): sidebar navigation, sign out, local-server warning"
```

---

## Task 15: The dashboard screen

**Files:**
- Create: `src/components/StatTile.tsx`, `src/components/BarChart.tsx`
- Modify: `src/screens/dashboard/DashboardScreen.tsx`
- Test: `tests/dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DashboardScreen } from '../src/screens/dashboard/DashboardScreen'
import { api } from '../src/api/admin'
import { ApiError } from '../src/api/client'
import type { DashboardSummary } from '../src/api/types'

const SUMMARY: DashboardSummary = {
  totals: { clinics: 12, clinics_active: 9, doctors: 40,
            services_listed: 512, users: 1804, bookings: 233 },
  bookings_by_status: { new: 5, confirmed: 3, completed: 220, cancelled: 5 },
  bookings_by_day: Array.from({ length: 14 }, (_, i) => ({ date: `2026-08-${i + 1}`, n: i })),
  new_users_by_day: Array.from({ length: 14 }, (_, i) => ({ date: `2026-08-${i + 1}`, n: 1 })),
  top_clinics: [{ clinic_id: 'c-1', name: 'Клиника А', n: 17 }],
  recent_bookings: [{
    id: 'b-1', clinic_name: 'Клиника А', patient_name: 'Иванов',
    status: 'confirmed', starts_at: null, created_at: '2026-08-12T10:00:00',
  }],
  window_days: 14,
  truncated: false,
}

describe('DashboardScreen', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('shows a loading state first', () => {
    vi.spyOn(api, 'dashboard').mockReturnValue(new Promise(() => undefined))
    render(<DashboardScreen />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the totals', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(SUMMARY)
    render(<DashboardScreen />)
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('1804')).toBeInTheDocument()
    expect(screen.getByText('512')).toBeInTheDocument()
  })

  it('renders the top clinics and recent bookings', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(SUMMARY)
    render(<DashboardScreen />)
    expect(await screen.findByText('Клиника А')).toBeInTheDocument()
    expect(screen.getByText('Иванов')).toBeInTheDocument()
  })

  it('shows an error instead of zeros when the server is unreachable', async () => {
    vi.spyOn(api, 'dashboard').mockRejectedValue(
      new ApiError('Cannot reach the Symptex server.', 0, true))
    render(<DashboardScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach/i)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('warns when the server says the figures were truncated', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue({ ...SUMMARY, truncated: true })
    render(<DashboardScreen />)
    expect(await screen.findByText(/неполные данные/i)).toBeInTheDocument()
  })

  it('says what period the charts cover, so 14-day figures are not read as all-time', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(SUMMARY)
    render(<DashboardScreen />)
    expect(await screen.findByText(/14 дн/i)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(SUMMARY)
    const { container } = render(<DashboardScreen />)
    await screen.findByText('12')
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — the placeholder screen renders none of this.

- [ ] **Step 3: Write the presentational primitives**

`src/components/StatTile.tsx`:

```tsx
export function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-card p-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
```

`src/components/BarChart.tsx`:

```tsx
import type { DaySeriesPoint } from '../api/types'

/** 14-day bar chart. Deliberately plain CSS bars — no chart library for two series. */
export function BarChart({ title, points }: { title: string; points: DaySeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.n))
  return (
    <figure className="rounded-xl border border-ink-200 bg-card p-4">
      <figcaption className="mb-3 text-sm font-medium text-ink-700">{title}</figcaption>
      <div className="flex h-28 items-end gap-1" role="img"
           aria-label={`${title}: ${points.map((p) => `${p.date}: ${p.n}`).join(', ')}`}>
        {points.map((p) => (
          <div key={p.date} className="flex-1" title={`${p.date}: ${p.n}`}>
            <div
              className="w-full rounded-t bg-brand-500"
              style={{ height: `${Math.round((p.n / max) * 100)}%`, minHeight: p.n > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-500">
        <span>{points[0]?.date ?? ''}</span>
        <span>{points[points.length - 1]?.date ?? ''}</span>
      </div>
    </figure>
  )
}
```

- [ ] **Step 4: Write the screen**

`src/screens/dashboard/DashboardScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/admin'
import type { DashboardSummary } from '../../api/types'
import { BarChart } from '../../components/BarChart'
import { StatTile } from '../../components/StatTile'
import { ErrorState, Loading } from '../../components/DataStates'

const STATUS_LABEL: Record<keyof DashboardSummary['bookings_by_status'], string> = {
  new: 'Новые',
  confirmed: 'Подтверждённые',
  completed: 'Завершённые',
  cancelled: 'Отменённые',
}

export function DashboardScreen() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setData(null)
    api.dashboard().then(setData).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <Loading />

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Обзор</h1>

      {data.truncated && (
        <p role="status"
           className="mb-4 border-l-4 border-warn bg-warn/10 px-3 py-2 text-sm text-ink-900">
          Неполные данные: за выбранный период записей больше, чем удалось загрузить.
          Графики за период занижены — итоговые суммы вверху верны.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Клиники" value={data.totals.clinics}
                  sub={`активных: ${data.totals.clinics_active}`} />
        <StatTile label="Врачи" value={data.totals.doctors} />
        <StatTile label="Услуги" value={data.totals.services_listed} />
        <StatTile label="Пользователи" value={data.totals.users} />
        <StatTile label="Записи" value={data.totals.bookings} />
        <StatTile label="Новые записи" value={data.bookings_by_status.new} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <BarChart title={`Записи за ${data.window_days} дн.`} points={data.bookings_by_day} />
        <BarChart title={`Новые пользователи за ${data.window_days} дн.`}
                  points={data.new_users_by_day} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-ink-200 bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-700">Записи по статусу</h2>
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((key) => (
              <li key={key} className="flex justify-between">
                <span className="text-ink-700">{STATUS_LABEL[key]}</span>
                <span className="tabular-nums font-medium">{data.bookings_by_status[key]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-ink-200 bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-700">Клиники с наибольшим числом записей</h2>
          {data.top_clinics.length === 0 ? (
            <p className="text-sm text-ink-500">Пока нет записей.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.top_clinics.map((c) => (
                <li key={c.clinic_id} className="flex justify-between">
                  <span className="text-ink-700">{c.name}</span>
                  <span className="tabular-nums font-medium">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-ink-200 bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-700">Последние записи</h2>
        {data.recent_bookings.length === 0 ? (
          <p className="text-sm text-ink-500">Пока нет записей.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="pb-2 font-medium">Клиника</th>
                <th className="pb-2 font-medium">Пациент</th>
                <th className="pb-2 font-medium">Статус</th>
                <th className="pb-2 font-medium">Создано</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_bookings.map((b) => (
                <tr key={b.id} className="border-t border-ink-100">
                  <td className="py-1.5">{b.clinic_name ?? '—'}</td>
                  <td className="py-1.5">{b.patient_name ?? '—'}</td>
                  <td className="py-1.5">{b.status}</td>
                  <td className="py-1.5 text-ink-500">{b.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```powershell
npm test
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/dashboard src/components/StatTile.tsx src/components/BarChart.tsx tests/dashboard.test.tsx
git commit -m "feat(dashboard): totals, 14-day charts, status breakdown, recent bookings

An unreachable server renders an error with Retry, never a page of zeros."
```

---

## Task 16: The clinics screen

**Files:**
- Modify: `src/screens/clinics/ClinicsScreen.tsx`
- Create: `src/screens/clinics/ClinicDetail.tsx`
- Test: `tests/clinics.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/clinics.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ClinicsScreen } from '../src/screens/clinics/ClinicsScreen'
import { api } from '../src/api/admin'
import type { ClinicPage } from '../src/api/types'

const PAGE: ClinicPage = {
  items: [{
    id: 'c-1', name_ru: 'Клиника А', name: 'Clinic A', slug: 'clinic-a',
    city: 'Ташкент', district: 'Yunusobod', clinic_type: 'organization',
    is_active: true, created_at: '2026-08-01T00:00:00', logo_url: null,
    phone: '+998901111111', doctors_n: 4, services_n: 30,
  }],
  total: 1, page: 1, per_page: 25,
}

describe('ClinicsScreen', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('lists clinics with their counts', async () => {
    vi.spyOn(api, 'clinics').mockResolvedValue(PAGE)
    render(<ClinicsScreen />)
    expect(await screen.findByText('Клиника А')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('searches with a debounce', async () => {
    const spy = vi.spyOn(api, 'clinics').mockResolvedValue(PAGE)
    render(<ClinicsScreen />)
    await screen.findByText('Клиника А')
    await userEvent.type(screen.getByLabelText(/поиск/i), 'альфа')
    await waitFor(() => {
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'альфа', page: 1 }))
    }, { timeout: 2000 })
  })

  it('filters by status', async () => {
    const spy = vi.spyOn(api, 'clinics').mockResolvedValue(PAGE)
    render(<ClinicsScreen />)
    await screen.findByText('Клиника А')
    await userEvent.selectOptions(screen.getByLabelText(/статус/i), 'active')
    await waitFor(() => {
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active' }))
    })
  })

  it('shows an empty state that explains what to do', async () => {
    vi.spyOn(api, 'clinics').mockResolvedValue({ items: [], total: 0, page: 1, per_page: 25 })
    render(<ClinicsScreen />)
    expect(await screen.findByText(/клиник(и|) не найден/i)).toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    vi.spyOn(api, 'clinics').mockRejectedValue(new Error('Cannot reach the Symptex server.'))
    render(<ClinicsScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach/i)
    expect(screen.getByRole('button', { name: /повторить/i })).toBeInTheDocument()
  })

  it('opens the read-only detail panel', async () => {
    vi.spyOn(api, 'clinics').mockResolvedValue(PAGE)
    vi.spyOn(api, 'clinic').mockResolvedValue({ clinic: PAGE.items[0] })
    render(<ClinicsScreen />)
    await userEvent.click(await screen.findByRole('button', { name: /Клиника А/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('clinic-a')
  })

  it('has no accessibility violations', async () => {
    vi.spyOn(api, 'clinics').mockResolvedValue(PAGE)
    const { container } = render(<ClinicsScreen />)
    await screen.findByText('Клиника А')
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm test
```

Expected: FAIL — the placeholder renders none of this.

- [ ] **Step 3: Write the detail panel**

`src/screens/clinics/ClinicDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../../api/admin'
import type { ClinicRow } from '../../api/types'
import { ErrorState, Loading } from '../../components/DataStates'

const FIELDS: { key: keyof ClinicRow; label: string }[] = [
  { key: 'slug', label: 'Адрес страницы' },
  { key: 'city', label: 'Город' },
  { key: 'district', label: 'Район' },
  { key: 'phone', label: 'Телефон' },
  { key: 'clinic_type', label: 'Тип' },
  { key: 'doctors_n', label: 'Врачей' },
  { key: 'services_n', label: 'Услуг' },
  { key: 'created_at', label: 'Создана' },
]

export function ClinicDetail({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const [clinic, setClinic] = useState<ClinicRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setClinic(null)
    setError(null)
    api.clinic(clinicId)
      .then((r) => { if (!cancelled) setClinic(r.clinic) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [clinicId])

  return (
    <aside role="dialog" aria-label="Карточка клиники"
           className="w-96 shrink-0 border-l border-ink-200 bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{clinic?.name_ru ?? 'Клиника'}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть"
                className="rounded p-1 text-ink-500 hover:bg-ink-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {!error && !clinic && <Loading />}
      {clinic && (
        <>
          <dl className="space-y-2 text-sm">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right text-ink-900">{String(clinic[key] ?? '—')}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 rounded-lg bg-ink-100 p-3 text-xs text-ink-500">
            Редактирование появится в следующем этапе.
          </p>
        </>
      )}
    </aside>
  )
}
```

- [ ] **Step 4: Write the list screen**

`src/screens/clinics/ClinicsScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/admin'
import type { ClinicPage, ClinicStatus } from '../../api/types'
import { Empty, ErrorState, Loading } from '../../components/DataStates'
import { ClinicDetail } from './ClinicDetail'

const PER_PAGE = 25
const DEBOUNCE_MS = 350

export function ClinicsScreen() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<ClinicStatus>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ClinicPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setError(null)
    setData(null)
    api.clinics({ q: debouncedQ || undefined, status, page, per_page: PER_PAGE })
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [debouncedQ, status, page])

  useEffect(() => { load() }, [load])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-4 text-xl font-semibold">Клиники</h1>

        <div className="mb-4 flex flex-wrap gap-3">
          <div>
            <label htmlFor="clinic-q" className="mb-1 block text-xs text-ink-500">Поиск</label>
            <input
              id="clinic-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="название, адрес страницы или телефон"
              className="w-72 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="clinic-status" className="mb-1 block text-xs text-ink-500">Статус</label>
            <select
              id="clinic-status"
              value={status}
              onChange={(e) => { setStatus(e.target.value as ClinicStatus); setPage(1) }}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Отключённые</option>
            </select>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {!error && !data && <Loading />}
        {data && data.items.length === 0 && (
          <Empty title="Клиники не найдены"
                 hint="Измените поиск или фильтр статуса." />
        )}

        {data && data.items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="pb-2 font-medium">Название</th>
                  <th className="pb-2 font-medium">Город / район</th>
                  <th className="pb-2 font-medium">Врачей</th>
                  <th className="pb-2 font-medium">Услуг</th>
                  <th className="pb-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-100/50">
                    <td className="py-2">
                      <button type="button" onClick={() => setSelected(c.id)}
                              className="text-brand-700 hover:underline">
                        {c.name_ru ?? c.name ?? c.slug}
                      </button>
                    </td>
                    <td className="py-2 text-ink-700">
                      {[c.city, c.district].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-2 tabular-nums">{c.doctors_n}</td>
                    <td className="py-2 tabular-nums">{c.services_n}</td>
                    <td className="py-2">
                      <span className={
                        'rounded px-1.5 py-0.5 text-xs ' +
                        (c.is_active ? 'bg-ok/15 text-ok' : 'bg-ink-200 text-ink-700')
                      }>
                        {c.is_active ? 'активна' : 'отключена'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center gap-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                      className="rounded-lg border border-ink-200 px-3 py-1.5 disabled:opacity-50">
                Назад
              </button>
              <span className="text-ink-500">Страница {data.page} из {pages} · всего {data.total}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-ink-200 px-3 py-1.5 disabled:opacity-50">
                Вперёд
              </button>
            </div>
          </>
        )}
      </div>

      {selected && <ClinicDetail clinicId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```powershell
npm test
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/clinics tests/clinics.test.tsx
git commit -m "feat(clinics): searchable, filterable, paginated clinic list with detail panel"
```

---

## Task 17: Package the installer and hand over

**Files:**
- Modify: `package.json` (electron-builder configuration)
- Create: `build/icon.ico`

- [ ] **Step 1: Create the application icon**

Ask the owner for the Symptex logo as PNG (512×512 or larger). Convert it to
`build/icon.ico` (electron-builder requires `.ico` on Windows; use any PNG→ICO
converter, or `npx png-to-ico logo.png > build/icon.ico`).

If no logo is supplied, ship without a custom icon for now — do **not** block the
build on it, and record it in the handover note.

- [ ] **Step 2: Configure electron-builder**

Add to `package.json`:

```json
{
  "name": "symptex-admin",
  "version": "1.0.0",
  "description": "Symptex Admin",
  "build": {
    "appId": "uz.symptex.admin",
    "productName": "Symptex Admin",
    "files": ["dist/**/*", "electron/**/*", "package.json"],
    "directories": { "output": "release", "buildResources": "build" },
    "win": { "target": ["nsis"], "icon": "build/icon.ico" },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Symptex Admin"
    }
  }
}
```

- [ ] **Step 3: Build the installer**

```powershell
cd C:\Users\user\Desktop\symptex-admin
npm run dist
```

Expected: `release\Symptex Admin Setup 1.0.0.exe` exists.

- [ ] **Step 4: Install and verify from the icon**

Run the installer. Windows SmartScreen will warn that the publisher is unknown —
expected for unsigned software; choose "More info" → "Run anyway".

Then, **from the Desktop icon, not from a terminal**:

- [ ] the window opens, titled "Symptex Admin", no browser chrome
- [ ] logging in with the phone + password from Task 8 succeeds
- [ ] the dashboard shows real figures
- [ ] those figures match the live site (clinic count against https://symptex.uz/ru/clinics)
- [ ] the clinic list loads, search works, the status filter works, paging works
- [ ] clicking a clinic opens the read-only detail panel
- [ ] "Выйти" returns to the login screen
- [ ] closing and reopening the program keeps you signed in (the token survived)
- [ ] with the internet disconnected, the program shows a clear error — **not** a page of zeros

- [ ] **Step 5: Commit and tag**

```bash
git add package.json build
git commit -m "build: package Symptex Admin as a Windows installer with a Desktop shortcut"
git tag piece1-v1.0.0
```

- [ ] **Step 6: Write the handover note**

Create `README.md` in `symptex-admin`:

```markdown
# Symptex Admin

Windows program for running Symptex. Piece 1: sign in, dashboard, clinic list.
Read-only — editing arrives in a later piece.

## Install
Run `release/Symptex Admin Setup <version>.exe`. Windows warns about an unknown
publisher because the installer is unsigned; that is expected.

## Sign in
Phone + password. The account must carry the `admin` role — grant it with
`scripts/grant_admin.py` in the symptex-next repo.

## Develop
- `npm run dev` — renderer only, in a browser
- `npm run electron:dev` — the real desktop window
- `npm test` — vitest
- `npm run dist` — build the installer

The server side lives in `symptex-next` under `app/blueprints/admin_api/`.
Point the app at a local server by switching the environment to `local`
(defaults to `live` = https://symptex.uz).
```

```bash
git add README.md && git commit -m "docs: how to install, sign in and develop"
```

---

## Self-review against the spec

| Spec section | Covered by |
|---|---|
| §4.1 Two Desktop folders | Task 1, Task 10 |
| §4.2 Server layout | Tasks 2–8 |
| §4.3 Extract `_stats_data` | Task 2 |
| §5.1 Token authentication | Task 4, Task 5 |
| §5.2 Endpoints | Task 5 (health/login/logout/me), Task 6 (clinics), Task 7 (dashboard) |
| §5.3 Dashboard payload | Task 7 |
| §5.4 Clinic list rules incl. batched counts | Task 6 |
| §5.5 Audit log | Task 3 (table), Task 4 (helper), Task 5 (login/logout events) |
| §6.1 Electron shell, safeStorage, env switch | Task 11 |
| §6.2 Brand tokens, lucide, no emojis | Task 10 |
| §6.3 Screens | Tasks 13–16 |
| §6.4 Module boundaries | Tasks 12–16 |
| §6.5 Four states, 401 handling | Tasks 12, 13, 15, 16 |
| §7 Migration + verify the id type | Task 3 |
| §8 Bootstrap admin account | Task 8 |
| §9 Security | Tasks 4, 5, 11 |
| §10 Testing | every task; manual acceptance in Task 17 |
| §11 Local dev + deploy | Task 1, Task 9 |
| §13 Risks | Task 3 Step 2 (id type), Task 8 (login), Task 17 Step 4 (SmartScreen, offline) |
