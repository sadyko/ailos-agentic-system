# Symptex Phase 1 — Accounts & Identity Implementation Plan

> ⚠️ **SUPERSEDED (2026-07-01) — DO NOT EXECUTE.** Built against the stale `/var/www/symptex` copy and creates parallel `sx_` tables. The live site (`/var/www/symptex-next`) already has `users`/`clinics`/`doctors`/`registrator_clinics`. Use the revised plan once written. See `docs/superpowers/specs/2026-07-01-symptex-phase1-accounts-design-v2.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Symptex real phone+password logins for admin/clinic/doctor/registrator, backed by its own Supabase, with admin/clinic screens to create those accounts.

**Architecture:** Add 3 Supabase tables (`sx_accounts`, `sx_clinics`, `sx_doctors`) in Symptex's project. A thin server-side Supabase client (`app/db.py`, PostgREST + service key) is the only DB access; the browser never touches Supabase. `app/auth.py` is rewritten to verify phone+password against `sx_accounts` (keeping its decorators + session shape), with an env break-glass admin. A new `app/services/accounts.py` holds create/reset/deactivate use-cases with role + clinic scoping. Panel routes + templates expose admin "Users" and clinic staff management, plus a forced first-login password change.

**Tech Stack:** Flask 3, Flask-WTF (CSRF), Werkzeug password hashing, `requests` (PostgREST + Management API), Supabase (project `ydcpwtwhbetkbwhgxizv`), pytest. Server: `/var/www/symptex` on `45.77.242.169` (gunicorn on `127.0.0.1:8000`, systemd `EnvironmentFile=/var/www/symptex/.env`). All shell steps run over `ssh root@45.77.242.169`.

**Spec:** `docs/superpowers/specs/2026-07-01-symptex-phase1-accounts-design.md`

---

## File Structure

- `migrations/2026-07-01_phase1_accounts.sql` (create) — DDL for the 3 tables + indexes + RLS.
- `scripts/apply_migration.py` (create) — applies a `.sql` via the Supabase Management API PAT.
- `app/config.py` (modify) — add `SUPABASE_URL`, `SUPABASE_KEY`.
- `app/db.py` (create) — server-side Supabase PostgREST client (select/insert/update).
- `app/services/phones.py` (create) — `normalize_phone`.
- `app/auth.py` (modify) — DB-backed phone+password auth; session carries role/clinic_id/doctor_id/must_change_password; break-glass admin.
- `app/services/accounts.py` (create) — create_clinic/doctor/registrator, reset_password, deactivate, list — with authorization.
- `app/blueprints/panel/__init__.py` (modify) — POST routes + real list data + first-login gate.
- `app/blueprints/auth/__init__.py` (modify) — pass identifier to verify; relabel field.
- `app/templates/panel/admin.html` (modify) — real Users tab (list + create form).
- `app/templates/panel/clinic.html` (modify) — Doctors/staff tab (list + create form).
- `app/templates/panel/_change_password.html` (create) — first-login/change-password screen.
- `app/templates/auth/login.html` (modify) — relabel username→phone.
- `app/__init__.py` (modify) — drop the file `seed_admin` call.
- `tests/` (create) — `conftest.py`, `test_phones.py`, `test_auth.py`, `test_accounts.py`.

**Conventions:** Werkzeug `generate_password_hash`/`check_password_hash`. Phones stored as `+998XXXXXXXXX`. `sx_` table prefix = Symptex-native. Tests mock `app.db` functions (no live DB in unit tests).

---

## Task 0: Pre-flight — confirm target, install pytest, test scaffold

**Files:**
- Create: `tests/conftest.py`

- [ ] **Step 1: Confirm the live deployment serves from `/var/www/symptex` (port 8000)**

Run:
```bash
ssh root@45.77.242.169 'grep -aE "proxy_pass|server_name|root" /etc/nginx/sites-enabled/symptex; echo "---"; systemctl status symptex* --no-pager | grep -E "Loaded|Active|WorkingDirectory" '
```
Expected: the `symptex` server block (server_name symptex.uz/www.symptex.uz) proxies to `127.0.0.1:8000`, whose gunicorn `WorkingDirectory=/var/www/symptex`. If instead symptex.uz maps to `/var/www/symptex-next`, STOP and re-point this plan's paths to that directory before continuing.

- [ ] **Step 2: Install pytest into the venv**

Run:
```bash
ssh root@45.77.242.169 '/var/www/symptex/venv/bin/pip install pytest==8.2.0 && /var/www/symptex/venv/bin/pytest --version'
```
Expected: `pytest 8.2.0`.

- [ ] **Step 3: Create `tests/conftest.py` that loads `.env` so DB creds are present**

```python
# tests/conftest.py — load /var/www/symptex/.env into os.environ for tests
# (systemd injects it in production; pytest runs need it explicitly).
import os
from pathlib import Path

_ENV = Path(__file__).resolve().parent.parent / ".env"
if _ENV.exists():
    for line in _ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
```

- [ ] **Step 4: Verify pytest collects with no tests yet**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest -q'
```
Expected: `no tests ran` (exit 5) — confirms discovery works.

- [ ] **Step 5: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add tests/conftest.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "test: pytest scaffold + .env loader for Phase 1"'
```

---

## Task 1: Database migration — create the 3 tables

**Files:**
- Create: `migrations/2026-07-01_phase1_accounts.sql`
- Create: `scripts/apply_migration.py`

- [ ] **Step 1: Write the migration SQL**

`migrations/2026-07-01_phase1_accounts.sql`:
```sql
-- Symptex Phase 1 — accounts & minimal clinic/doctor entities.
create extension if not exists pgcrypto;

create table if not exists sx_clinics (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null,
  name_uz text,
  name_en text,
  core_clinic_id uuid,
  origin text not null default 'symptex' check (origin in ('symptex','easymed')),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists sx_doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sx_clinics(id),
  full_name_ru text not null,
  full_name_uz text,
  full_name_en text,
  core_doctor_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sx_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','clinic','doctor','registrator')),
  display_name text not null,
  clinic_id uuid references sx_clinics(id),
  doctor_id uuid references sx_doctors(id),
  must_change_password boolean not null default true,
  active boolean not null default true,
  lang text not null default 'ru',
  created_by uuid references sx_accounts(id),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint sx_accounts_links_ck check (
    (role = 'admin'       and clinic_id is null and doctor_id is null) or
    (role = 'clinic'      and clinic_id is not null and doctor_id is null) or
    (role = 'doctor'      and clinic_id is not null and doctor_id is not null) or
    (role = 'registrator' and clinic_id is not null and doctor_id is null)
  )
);

create index if not exists sx_accounts_clinic_idx on sx_accounts(clinic_id);
create index if not exists sx_doctors_clinic_idx on sx_doctors(clinic_id);

alter table sx_clinics  enable row level security;
alter table sx_doctors  enable row level security;
alter table sx_accounts enable row level security;
-- No policies => only the service_role key (server-side) can read/write. The
-- browser never talks to Supabase directly; the Flask server is the only client.
```

- [ ] **Step 2: Write the migration applier (Management API PAT, browser UA to bypass Cloudflare 1010)**

`scripts/apply_migration.py`:
```python
import os, sys, json, urllib.request, urllib.error

def _env(name):
    v = os.environ.get(name)
    if not v:
        # fall back to .env file
        from pathlib import Path
        p = Path(__file__).resolve().parent.parent / ".env"
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith(name + "="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
    return v

def main(path):
    ref = _env("SUPABASE_PROJECT_REF")
    pat = _env("SUPABASE_ACCESS_TOKEN")
    sql = open(path, encoding="utf-8").read()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": "Bearer " + pat, "Content-Type": "application/json",
                 "User-Agent": "Mozilla/5.0 Chrome/124", "Accept": "application/json"},
        method="POST")
    try:
        print("OK", urllib.request.urlopen(req, timeout=60).read().decode() or "[]")
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read().decode()[:400]); sys.exit(1)

if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 3: Apply the migration**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/python scripts/apply_migration.py migrations/2026-07-01_phase1_accounts.sql'
```
Expected: `OK []`.

- [ ] **Step 4: Verify the tables + RLS exist**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/python - <<PY
import scripts.apply_migration as m, os, json, urllib.request
ref=m._env("SUPABASE_PROJECT_REF"); pat=m._env("SUPABASE_ACCESS_TOKEN")
q="select table_name, row_security from information_schema.tables t join pg_class c on c.relname=t.table_name where table_schema=\x27public\x27 and table_name like \x27sx_%\x27;"
req=urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query",data=json.dumps({"query":q}).encode(),headers={"Authorization":"Bearer "+pat,"Content-Type":"application/json","User-Agent":"Mozilla/5.0 Chrome/124"},method="POST")
print(urllib.request.urlopen(req,timeout=30).read().decode())
PY'
```
Expected: rows for `sx_accounts`, `sx_clinics`, `sx_doctors`.

- [ ] **Step 5: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add migrations/2026-07-01_phase1_accounts.sql scripts/apply_migration.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(db): Phase 1 sx_accounts/sx_clinics/sx_doctors migration + applier"'
```

---

## Task 2: Config — expose Supabase URL + service key

**Files:**
- Modify: `app/config.py`

- [ ] **Step 1: Add the two config fields**

In `app/config.py`, inside `class Config`, after the `GATEWAY_API_TOKEN` line, add:
```python
    # Symptex's own Supabase (server-side only — service key never reaches the browser).
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
```

- [ ] **Step 2: Verify they resolve on the server**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && set -a; . ./.env; set +a; venv/bin/python -c "from app.config import Config; print(bool(Config.SUPABASE_URL), bool(Config.SUPABASE_KEY))"'
```
Expected: `True True`.

- [ ] **Step 3: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/config.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(config): expose Symptex Supabase URL + service key (server-side)"'
```

---

## Task 3: `app/db.py` — server-side Supabase client

**Files:**
- Create: `app/db.py`
- Test: `tests/test_db.py`

- [ ] **Step 1: Write the failing test (mock `requests`)**

`tests/test_db.py`:
```python
from unittest.mock import patch, MagicMock
from app import db

def _resp(json_data, status=200):
    r = MagicMock(); r.status_code = status; r.json.return_value = json_data; r.text = str(json_data)
    return r

@patch("app.db.requests.get")
def test_select_builds_url_and_headers(mget):
    mget.return_value = _resp([{"id": "1"}])
    rows = db.select("sx_accounts", {"phone": "eq.+998901234567", "select": "id,phone"})
    assert rows == [{"id": "1"}]
    url = mget.call_args[0][0]
    assert url.endswith("/rest/v1/sx_accounts")
    assert mget.call_args[1]["headers"]["apikey"]  # service key attached

@patch("app.db.requests.post")
def test_insert_returns_row(mpost):
    mpost.return_value = _resp([{"id": "abc"}], 201)
    row = db.insert("sx_clinics", {"name_ru": "Test"})
    assert row == {"id": "abc"}
```

- [ ] **Step 2: Run it — expect failure**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_db.py -q'`
Expected: FAIL (`ModuleNotFoundError: app.db` / no attribute).

- [ ] **Step 3: Implement `app/db.py`**

```python
"""Server-side Supabase (PostgREST) client. The service key stays here — the
browser never talks to Supabase directly. Thin helpers over `requests`."""
import requests
from .config import Config

_BASE = (Config.SUPABASE_URL or "").rstrip("/") + "/rest/v1"


def _headers(extra=None):
    h = {"apikey": Config.SUPABASE_KEY,
         "Authorization": "Bearer " + Config.SUPABASE_KEY,
         "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def select(table, params=None):
    r = requests.get(f"{_BASE}/{table}", headers=_headers(), params=params or {}, timeout=8)
    r.raise_for_status()
    return r.json()


def select_one(table, params=None):
    p = dict(params or {}); p["limit"] = 1
    rows = select(table, p)
    return rows[0] if rows else None


def insert(table, row):
    r = requests.post(f"{_BASE}/{table}", headers=_headers({"Prefer": "return=representation"}),
                      json=row, timeout=8)
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) and data else data


def update(table, match, patch):
    # match: dict of column -> value (equality). e.g. {"id": "<uuid>"}
    params = {k: f"eq.{v}" for k, v in match.items()}
    r = requests.patch(f"{_BASE}/{table}", headers=_headers({"Prefer": "return=representation"}),
                       params=params, json=patch, timeout=8)
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) and data else None
```

- [ ] **Step 4: Run tests — expect pass**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_db.py -q'`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/db.py tests/test_db.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(db): server-side Supabase client (select/insert/update)"'
```

---

## Task 4: `app/services/phones.py` — phone normalization

**Files:**
- Create: `app/services/phones.py`
- Test: `tests/test_phones.py`

- [ ] **Step 1: Write the failing test**

`tests/test_phones.py`:
```python
import pytest
from app.services.phones import normalize_phone

@pytest.mark.parametrize("raw,expected", [
    ("+998 90 123 45 67", "+998901234567"),
    ("998901234567", "+998901234567"),
    ("901234567", "+998901234567"),
    ("  90-123-45-67 ", "+998901234567"),
    ("", ""),
    (None, ""),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected
```

- [ ] **Step 2: Run it — expect failure**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_phones.py -q'`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`app/services/phones.py`:
```python
"""Canonical phone format for login identity: +998XXXXXXXXX (Uzbekistan)."""
import re


def normalize_phone(raw):
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 9:                      # local 9-digit → prepend country code
        digits = "998" + digits
    if not digits:
        return ""
    return "+" + digits
```

- [ ] **Step 4: Run tests — expect pass**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_phones.py -q'`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/services/phones.py tests/test_phones.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(auth): phone normalization helper"'
```

---

## Task 5: Rewrite `app/auth.py` internals to DB-backed phone auth

**Files:**
- Modify: `app/auth.py`
- Modify: `app/__init__.py` (drop the file `seed_admin` call)
- Test: `tests/test_auth.py`

- [ ] **Step 1: Write the failing test (mock `app.db`)**

`tests/test_auth.py`:
```python
from unittest.mock import patch
from werkzeug.security import generate_password_hash
from app import auth

def _acct(**kw):
    base = dict(id="u1", phone="+998901234567", password_hash=generate_password_hash("secret"),
                role="clinic", display_name="Clinic A", clinic_id="c1", doctor_id=None,
                must_change_password=False, active=True, lang="ru")
    base.update(kw); return base

@patch("app.auth.db.select_one")
def test_verify_success_returns_user(mone):
    mone.return_value = _acct()
    u = auth.verify("90 123 45 67", "secret")
    assert u and u["roles"] == ["clinic"] and u["clinic_id"] == "c1"

@patch("app.auth.db.select_one")
def test_verify_wrong_password(mone):
    mone.return_value = _acct()
    assert auth.verify("+998901234567", "nope") is None

@patch("app.auth.db.select_one")
def test_verify_inactive_rejected(mone):
    mone.return_value = _acct(active=False)
    assert auth.verify("+998901234567", "secret") is None

@patch("app.auth.db.select_one")
def test_break_glass_admin_when_no_db_account(mone):
    mone.return_value = None
    with patch.object(auth.Config, "ADMIN_USERNAME", "root"), patch.object(auth.Config, "ADMIN_PASSWORD", "pw"):
        u = auth.verify("root", "pw")
    assert u and u["roles"] == ["admin"]
```

- [ ] **Step 2: Run it — expect failure**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_auth.py -q'`
Expected: FAIL.

- [ ] **Step 3: Rewrite `app/auth.py`** (replace the file-store internals; keep decorators + `ROLES`/`ROLE_HOME`)

Replace the module body with:
```python
"""Session auth backed by Symptex's Supabase (sx_accounts). Phone + password.
Decorators and session shape are stable (login_required / role_required).
An env break-glass admin (Config.ADMIN_USERNAME/PASSWORD) works only when no DB
account matches, so the owner can never be locked out."""
from functools import wraps

from flask import session, redirect, url_for, request, g, abort
from werkzeug.security import generate_password_hash, check_password_hash

from . import db
from .config import Config
from .services.phones import normalize_phone

ROLES = ("patient", "doctor", "clinic", "registrator", "admin")
ROLE_HOME = {
    "admin": "panel.admin",
    "clinic": "panel.clinic",
    "doctor": "panel.doctor",
    "registrator": "panel.registrator",
    "patient": "public.home",
}


def _to_user(acct):
    return {
        "id": acct["id"],
        "phone": acct.get("phone"),
        "display_name": acct.get("display_name") or acct.get("phone"),
        "roles": [acct["role"]],
        "role": acct["role"],
        "clinic_id": acct.get("clinic_id"),
        "doctor_id": acct.get("doctor_id"),
        "must_change_password": bool(acct.get("must_change_password")),
        "lang": acct.get("lang", "ru"),
    }


def find_by_phone(phone):
    return db.select_one("sx_accounts", {"phone": f"eq.{phone}"})


def verify(identifier, password):
    phone = normalize_phone(identifier)
    acct = find_by_phone(phone) if phone else None
    if acct and acct.get("active") and check_password_hash(acct["password_hash"], password):
        return _to_user(acct)
    # break-glass env admin — only when no DB account matched
    if not acct and identifier == Config.ADMIN_USERNAME and password == Config.ADMIN_PASSWORD:
        return {"id": "env-admin", "phone": identifier, "display_name": "Администратор",
                "roles": ["admin"], "role": "admin", "clinic_id": None, "doctor_id": None,
                "must_change_password": False, "lang": "ru"}
    return None


def set_password(account_id, new_password):
    db.update("sx_accounts", {"id": account_id},
              {"password_hash": generate_password_hash(new_password), "must_change_password": False})


def login_user(user):
    session["uid"] = user["id"]
    session["phone"] = user.get("phone")
    session["display_name"] = user.get("display_name")
    session["roles"] = user.get("roles", [])
    session["role"] = user.get("role")
    session["clinic_id"] = user.get("clinic_id")
    session["doctor_id"] = user.get("doctor_id")
    session["must_change_password"] = user.get("must_change_password", False)
    session["lang"] = user.get("lang", "ru")


def logout_user():
    for k in ("uid", "phone", "display_name", "roles", "role", "clinic_id",
              "doctor_id", "must_change_password", "lang"):
        session.pop(k, None)


def current_user():
    if not session.get("uid"):
        return None
    return {
        "id": session["uid"],
        "phone": session.get("phone"),
        "display_name": session.get("display_name"),
        "roles": session.get("roles", []),
        "role": session.get("role"),
        "clinic_id": session.get("clinic_id"),
        "doctor_id": session.get("doctor_id"),
        "must_change_password": session.get("must_change_password", False),
    }


def load_user():
    g.user = current_user()


def login_required(view):
    @wraps(view)
    def wrapped(*a, **kw):
        if not session.get("uid"):
            return redirect(url_for("auth.login", next=request.path))
        return view(*a, **kw)
    return wrapped


def role_required(*roles):
    def deco(view):
        @wraps(view)
        def wrapped(*a, **kw):
            if not session.get("uid"):
                return redirect(url_for("auth.login", next=request.path))
            have = set(session.get("roles", []))
            if "admin" in have or have.intersection(roles):
                return view(*a, **kw)
            abort(403)
        return wrapped
    return deco
```

- [ ] **Step 4: Drop the obsolete `seed_admin` call in `app/__init__.py`**

In `app/__init__.py`, delete the line:
```python
    auth.seed_admin(app.config["ADMIN_USERNAME"], app.config["ADMIN_PASSWORD"])
```
(The break-glass admin now lives in `auth.verify`; no file seeding needed.)

- [ ] **Step 5: Run tests — expect pass**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_auth.py -q'`
Expected: 4 passed.

- [ ] **Step 6: Sanity-check the app still imports**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && set -a; . ./.env; set +a; venv/bin/python -c "from app import create_app; create_app(); print(\"app ok\")"'`
Expected: `app ok`.

- [ ] **Step 7: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/auth.py app/__init__.py tests/test_auth.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(auth): DB-backed phone+password auth with break-glass admin"'
```

---

## Task 6: `app/services/accounts.py` — create/reset/deactivate with scoping

**Files:**
- Create: `app/services/accounts.py`
- Test: `tests/test_accounts.py`

- [ ] **Step 1: Write the failing test (mock `app.db`)**

`tests/test_accounts.py`:
```python
from unittest.mock import patch
import pytest
from app.services import accounts

ADMIN = {"role": "admin", "id": "a1", "clinic_id": None}
CLINIC = {"role": "clinic", "id": "cu1", "clinic_id": "c1"}

@patch("app.services.accounts.db.insert")
@patch("app.services.accounts.db.select_one", return_value=None)
def test_admin_creates_clinic(mone, mins):
    mins.side_effect = [{"id": "cNew"}, {"id": "acctNew"}]
    out = accounts.create_clinic_account(ADMIN, name_ru="Aram", phone="901112233", password="pw123456")
    assert out["account"]["id"] == "acctNew"
    assert mins.call_args_list[0][0][0] == "sx_clinics"   # clinic row first
    assert mins.call_args_list[1][0][0] == "sx_accounts"

@patch("app.services.accounts.db.insert")
@patch("app.services.accounts.db.select_one", return_value=None)
def test_clinic_creates_doctor_forced_to_own_clinic(mone, mins):
    mins.side_effect = [{"id": "dNew"}, {"id": "acctNew"}]
    out = accounts.create_doctor_account(CLINIC, clinic_id="SOMEONE_ELSE", full_name_ru="Dr X",
                                         phone="901112244", password="pw123456")
    # doctor row must be created under the caller's own clinic, not the passed one
    doctor_row = mins.call_args_list[0][0][1]
    assert doctor_row["clinic_id"] == "c1"

def test_clinic_cannot_create_clinic_account():
    with pytest.raises(PermissionError):
        accounts.create_clinic_account(CLINIC, name_ru="X", phone="9", password="pw123456")

@patch("app.services.accounts.db.select_one", return_value=None)
def test_duplicate_phone_rejected(mone):
    with patch("app.services.accounts.db.select_one", return_value={"id": "exists"}):
        with pytest.raises(ValueError):
            accounts.create_registrator_account(ADMIN, clinic_id="c1", display_name="R",
                                                phone="901112255", password="pw123456")

def test_short_password_rejected():
    with pytest.raises(ValueError):
        accounts.create_registrator_account(ADMIN, clinic_id="c1", display_name="R",
                                            phone="901112266", password="123")
```

- [ ] **Step 2: Run it — expect failure**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_accounts.py -q'`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `app/services/accounts.py`**

```python
"""Account creation use-cases with authorization + clinic scoping. Callers pass
the acting user dict (role, id, clinic_id). All writes go through app.db."""
from werkzeug.security import generate_password_hash

from .. import db
from .phones import normalize_phone

MIN_PW = 6


def _check_password(pw):
    if not pw or len(pw) < MIN_PW:
        raise ValueError(f"Пароль должен быть не короче {MIN_PW} символов.")


def _norm_unique_phone(raw):
    phone = normalize_phone(raw)
    if not phone:
        raise ValueError("Укажите телефон.")
    if db.select_one("sx_accounts", {"phone": f"eq.{phone}"}):
        raise ValueError("Этот телефон уже используется.")
    return phone


def _insert_account(actor, phone, password, role, display_name, clinic_id=None, doctor_id=None):
    return db.insert("sx_accounts", {
        "phone": phone,
        "password_hash": generate_password_hash(password),
        "role": role,
        "display_name": display_name,
        "clinic_id": clinic_id,
        "doctor_id": doctor_id,
        "must_change_password": True,
        "active": True,
        "created_by": actor.get("id") if actor.get("id") != "env-admin" else None,
    })


def create_clinic_account(actor, name_ru, phone, password, name_uz=None, name_en=None):
    if actor.get("role") != "admin":
        raise PermissionError("Только администратор может создавать клиники.")
    _check_password(password)
    phone = _norm_unique_phone(phone)
    clinic = db.insert("sx_clinics", {"name_ru": name_ru, "name_uz": name_uz, "name_en": name_en,
                                      "origin": "symptex", "created_by": actor.get("id") if actor.get("id") != "env-admin" else None})
    account = _insert_account(actor, phone, password, "clinic", name_ru, clinic_id=clinic["id"])
    return {"clinic": clinic, "account": account}


def _resolve_clinic_scope(actor, requested_clinic_id):
    if actor.get("role") == "admin":
        if not requested_clinic_id:
            raise ValueError("Выберите клинику.")
        return requested_clinic_id
    if actor.get("role") == "clinic":
        return actor.get("clinic_id")   # forced to own clinic; ignore requested
    raise PermissionError("Недостаточно прав.")


def create_doctor_account(actor, clinic_id, full_name_ru, phone, password, full_name_uz=None, full_name_en=None):
    scope = _resolve_clinic_scope(actor, clinic_id)
    _check_password(password)
    phone = _norm_unique_phone(phone)
    doctor = db.insert("sx_doctors", {"clinic_id": scope, "full_name_ru": full_name_ru,
                                      "full_name_uz": full_name_uz, "full_name_en": full_name_en})
    account = _insert_account(actor, phone, password, "doctor", full_name_ru,
                              clinic_id=scope, doctor_id=doctor["id"])
    return {"doctor": doctor, "account": account}


def create_registrator_account(actor, clinic_id, display_name, phone, password):
    scope = _resolve_clinic_scope(actor, clinic_id)
    _check_password(password)
    phone = _norm_unique_phone(phone)
    account = _insert_account(actor, phone, password, "registrator", display_name, clinic_id=scope)
    return {"account": account}


def _assert_can_manage(actor, target):
    if actor.get("role") == "admin":
        return
    if actor.get("role") == "clinic" and target.get("clinic_id") == actor.get("clinic_id") \
            and target.get("role") in ("doctor", "registrator"):
        return
    raise PermissionError("Недостаточно прав.")


def reset_password(actor, account_id, new_password):
    _check_password(new_password)
    target = db.select_one("sx_accounts", {"id": f"eq.{account_id}"})
    if not target:
        raise ValueError("Аккаунт не найден.")
    _assert_can_manage(actor, target)
    db.update("sx_accounts", {"id": account_id},
              {"password_hash": generate_password_hash(new_password), "must_change_password": True})
    return True


def deactivate(actor, account_id):
    target = db.select_one("sx_accounts", {"id": f"eq.{account_id}"})
    if not target:
        raise ValueError("Аккаунт не найден.")
    _assert_can_manage(actor, target)
    db.update("sx_accounts", {"id": account_id}, {"active": False})
    return True


def list_accounts(actor):
    """Admin: all. Clinic: only its own staff (doctor/registrator)."""
    params = {"select": "id,phone,role,display_name,clinic_id,doctor_id,active,must_change_password,created_at",
              "order": "created_at.desc"}
    if actor.get("role") == "clinic":
        params["clinic_id"] = f"eq.{actor.get('clinic_id')}"
        params["role"] = "in.(doctor,registrator)"
    return db.select("sx_accounts", params)
```

- [ ] **Step 4: Run tests — expect pass**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest tests/test_accounts.py -q'`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/services/accounts.py tests/test_accounts.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(accounts): create/reset/deactivate use-cases with role+clinic scoping"'
```

---

## Task 7: Panel routes — create, reset, deactivate, first-login gate, real lists

**Files:**
- Modify: `app/blueprints/panel/__init__.py`

- [ ] **Step 1: Add clinics list helper + POST routes + first-login gate**

At the top of `app/blueprints/panel/__init__.py`, extend imports:
```python
from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify, flash, abort
from ... import auth as A, content
from ...config import Config
from ...services import core_gateway, accounts
from ... import db
```

Add a `before_request` on the blueprint to force the first-login password change (place after `bp = Blueprint(...)`):
```python
@bp.before_request
def _force_password_change():
    if session.get("uid") and session.get("must_change_password"):
        allowed = {"panel.change_password", "panel.do_change_password"}
        if request.endpoint not in allowed:
            return redirect(url_for("panel.change_password"))
```

- [ ] **Step 2: Replace the `admin()` route to pass real data**

```python
@bp.get("/admin")
@A.role_required("admin")
def admin():
    gw = {
        "configured": core_gateway.configured(),
        "url": Config.GATEWAY_API_URL,
        "token_masked": _mask_token(Config.GATEWAY_API_TOKEN),
        "whoami": core_gateway.whoami(),
    }
    acts = accounts.list_accounts(A.current_user())
    clinics = db.select("sx_clinics", {"select": "id,name_ru", "order": "name_ru.asc"})
    return render_template("panel/admin.html", gw=gw, accounts=acts, clinics=clinics, **_ctx("admin"))
```

- [ ] **Step 3: Replace `clinic()` route to pass its staff + own clinic**

```python
@bp.get("/clinic")
@A.role_required("clinic")
def clinic():
    acts = accounts.list_accounts(A.current_user())
    return render_template("panel/clinic.html", accounts=acts, **_ctx("clinic"))
```

- [ ] **Step 4: Add the create / reset / deactivate / password routes**

```python
def _flash_err(e):
    flash(str(e) or "Ошибка.", "error")


@bp.post("/users/create")
@A.role_required("admin", "clinic")
def users_create():
    f = request.form
    actor = A.current_user()
    role = f.get("acc_role")
    try:
        if role == "clinic":
            accounts.create_clinic_account(actor, name_ru=f.get("name", "").strip(),
                                            phone=f.get("phone", ""), password=f.get("password", ""))
        elif role == "doctor":
            accounts.create_doctor_account(actor, clinic_id=f.get("clinic_id") or None,
                                           full_name_ru=f.get("name", "").strip(),
                                           phone=f.get("phone", ""), password=f.get("password", ""))
        elif role == "registrator":
            accounts.create_registrator_account(actor, clinic_id=f.get("clinic_id") or None,
                                                display_name=f.get("name", "").strip(),
                                                phone=f.get("phone", ""), password=f.get("password", ""))
        else:
            raise ValueError("Выберите тип аккаунта.")
        flash("Аккаунт создан.", "ok")
    except (ValueError, PermissionError) as e:
        _flash_err(e)
    dest = "panel.clinic" if actor.get("role") == "clinic" else "panel.admin"
    return redirect(url_for(dest, tab="users" if dest == "panel.admin" else "doctors"))


@bp.post("/users/<account_id>/reset")
@A.role_required("admin", "clinic")
def users_reset(account_id):
    try:
        accounts.reset_password(A.current_user(), account_id, request.form.get("password", ""))
        flash("Пароль сброшен.", "ok")
    except (ValueError, PermissionError) as e:
        _flash_err(e)
    return redirect(request.referrer or url_for("panel.index"))


@bp.post("/users/<account_id>/deactivate")
@A.role_required("admin", "clinic")
def users_deactivate(account_id):
    try:
        accounts.deactivate(A.current_user(), account_id)
        flash("Аккаунт отключён.", "ok")
    except (ValueError, PermissionError) as e:
        _flash_err(e)
    return redirect(request.referrer or url_for("panel.index"))


@bp.get("/account/password")
@A.login_required
def change_password():
    return render_template("panel/_change_password.html",
                           forced=bool(session.get("must_change_password")))


@bp.post("/account/password")
@A.login_required
def do_change_password():
    pw = request.form.get("password", "")
    if len(pw) < 6:
        flash("Пароль должен быть не короче 6 символов.", "error")
        return redirect(url_for("panel.change_password"))
    A.set_password(session["uid"], pw)
    session["must_change_password"] = False
    flash("Пароль обновлён.", "ok")
    return redirect(url_for(A.ROLE_HOME[session.get("role", "patient")]))
```

- [ ] **Step 5: Verify the app imports + routes register**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && set -a; . ./.env; set +a; venv/bin/python -c "from app import create_app; a=create_app(); print([r.rule for r in a.url_map.iter_rules() if \"/panel\" in r.rule])"'
```
Expected: list including `/panel/users/create`, `/panel/account/password`, etc.

- [ ] **Step 6: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/blueprints/panel/__init__.py && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(panel): account create/reset/deactivate routes + first-login gate + real lists"'
```

---

## Task 8: Templates — admin Users tab, clinic staff tab, change-password, login relabel

**Files:**
- Modify: `app/templates/panel/admin.html`
- Modify: `app/templates/panel/clinic.html`
- Create: `app/templates/panel/_change_password.html`
- Modify: `app/templates/auth/login.html`

- [ ] **Step 1: Replace the admin `users` section with a real create form + accounts table**

In `app/templates/panel/admin.html`, replace the entire `{# ============ USERS ============ #}` `<section data-tab="users">…</section>` block with:
```html
  {# ============ USERS ============ #}
  <section data-tab="users">
    {% with msgs = get_flashed_messages(with_categories=true) %}
      {% for cat, m in msgs %}<div class="card" style="border-left:3px solid {{ 'var(--teal-600)' if cat=='ok' else 'var(--warning-600)' }};margin-bottom:14px">{{ m }}</div>{% endfor %}
    {% endwith %}
    <div class="card" style="margin-bottom:18px">
      <h3 style="font-size:16px;margin-bottom:14px">Создать аккаунт</h3>
      <form method="post" action="{{ url_for('panel.users_create') }}" class="grid g-2" style="gap:12px">
        <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
        <label class="fl">Тип
          <select class="input select" name="acc_role" id="acc_role" style="margin-top:6px" onchange="document.getElementById('clinic_pick').style.display=this.value==='clinic'?'none':'block'">
            <option value="clinic">Клиника</option>
            <option value="doctor">Врач</option>
            <option value="registrator">Регистратор</option>
          </select>
        </label>
        <label class="fl" id="clinic_pick" style="display:none">Клиника
          <select class="input select" name="clinic_id" style="margin-top:6px">
            {% for c in clinics %}<option value="{{ c.id }}">{{ c.name_ru }}</option>{% endfor %}
          </select>
        </label>
        <label class="fl">Имя / название<input class="input" name="name" required style="margin-top:6px"></label>
        <label class="fl">Телефон<input class="input" name="phone" placeholder="+998 90 123 45 67" required style="margin-top:6px"></label>
        <label class="fl">Пароль<input class="input" name="password" minlength="6" required style="margin-top:6px"></label>
        <div style="display:flex;align-items:flex-end"><button class="btn btn--primary" type="submit"><i class="ph ph-plus"></i>Создать</button></div>
      </form>
    </div>
    <div class="reshead"><span class="cnt"><b style="color:var(--ink-900)">{{ accounts|length }}</b> аккаунтов</span></div>
    {{ p.ptable(['Имя','Телефон','Роль','Статус',''], [
      [ acc.display_name, acc.phone,
        {'clinic':'Клиника','doctor':'Врач','registrator':'Регистратор','admin':'Админ'}.get(acc.role, acc.role),
        (p.pill('completed','Активен') if acc.active else p.pill('cancelled','Отключён')),
        ('<form method="post" action="' ~ url_for('panel.users_deactivate', account_id=acc.id) ~ '" onsubmit="return confirm(\'Отключить аккаунт?\')"><input type="hidden" name="csrf_token" value="' ~ csrf_token() ~ '"><button class="btn btn--secondary btn--sm" type="submit">Отключить</button></form>') if acc.active else ''
      ] for acc in accounts
    ]) }}
  </section>
```

- [ ] **Step 2: Replace the clinic `doctors` section with staff create + list**

In `app/templates/panel/clinic.html`, replace the `<section data-tab="doctors">…</section>` block with:
```html
  <section data-tab="doctors">
    {% with msgs = get_flashed_messages(with_categories=true) %}
      {% for cat, m in msgs %}<div class="card" style="border-left:3px solid {{ 'var(--teal-600)' if cat=='ok' else 'var(--warning-600)' }};margin-bottom:14px">{{ m }}</div>{% endfor %}
    {% endwith %}
    <div class="card" style="margin-bottom:18px">
      <h3 style="font-size:16px;margin-bottom:14px">Добавить врача или регистратора</h3>
      <form method="post" action="{{ url_for('panel.users_create') }}" class="grid g-2" style="gap:12px">
        <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
        <label class="fl">Тип
          <select class="input select" name="acc_role" style="margin-top:6px">
            <option value="doctor">Врач</option>
            <option value="registrator">Регистратор</option>
          </select>
        </label>
        <label class="fl">Имя<input class="input" name="name" required style="margin-top:6px"></label>
        <label class="fl">Телефон<input class="input" name="phone" placeholder="+998 90 123 45 67" required style="margin-top:6px"></label>
        <label class="fl">Пароль<input class="input" name="password" minlength="6" required style="margin-top:6px"></label>
        <div style="display:flex;align-items:flex-end"><button class="btn btn--primary" type="submit"><i class="ph ph-plus"></i>Добавить</button></div>
      </form>
    </div>
    <div class="reshead"><span class="cnt"><b style="color:var(--ink-900)">{{ accounts|length }}</b> сотрудников</span></div>
    {{ p.ptable(['Имя','Телефон','Роль','Статус'], [
      [ acc.display_name, acc.phone,
        {'doctor':'Врач','registrator':'Регистратор'}.get(acc.role, acc.role),
        (p.pill('completed','Активен') if acc.active else p.pill('cancelled','Отключён')) ] for acc in accounts
    ]) }}
  </section>
```

- [ ] **Step 3: Create the change-password screen**

`app/templates/panel/_change_password.html`:
```html
{% extends "_layout/base.html" %}
{% block title %}Смена пароля — Symptex{% endblock %}
{% block body %}
<div style="max-width:420px;margin:64px auto;padding:0 16px">
  <div class="card">
    <h2 style="font-size:18px;margin-bottom:6px">Смена пароля</h2>
    <p class="muted" style="font-size:13px;margin-bottom:16px">
      {% if forced %}Для продолжения задайте новый пароль.{% else %}Задайте новый пароль для входа.{% endif %}
    </p>
    {% with msgs = get_flashed_messages(with_categories=true) %}
      {% for cat, m in msgs %}<div style="margin-bottom:12px;color:{{ 'var(--teal-700)' if cat=='ok' else 'var(--warning-700)' }}">{{ m }}</div>{% endfor %}
    {% endwith %}
    <form method="post" action="{{ url_for('panel.do_change_password') }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
      <label class="fl">Новый пароль<input class="input" type="password" name="password" minlength="6" required style="margin-top:6px"></label>
      <button class="btn btn--primary" type="submit" style="margin-top:16px;width:100%">Сохранить</button>
    </form>
  </div>
</div>
{% endblock %}
```

- [ ] **Step 4: Relabel the login field from username to phone**

In `app/templates/auth/login.html`, change the login/username input's label text to `Телефон` and its placeholder to `+998 90 123 45 67`. Keep the input `name="username"` (the route reads `request.form.get("username")` and passes it to `verify` as the identifier — phone or the break-glass admin name). Do not rename the field.

- [ ] **Step 5: Reload gunicorn and smoke-check pages render**

Run:
```bash
ssh root@45.77.242.169 'systemctl restart symptex && sleep 2 && curl -s -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:8000/login && curl -s -o /dev/null -w "health:%{http_code}\n" http://127.0.0.1:8000/healthz'
```
Expected: `login:200`, `health:200`.

- [ ] **Step 6: Commit**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git add app/templates/panel/admin.html app/templates/panel/clinic.html app/templates/panel/_change_password.html app/templates/auth/login.html && git -c user.name=ops -c user.email=ops@symptex commit -q -m "feat(panel): real Users/staff tabs, change-password screen, phone login label"'
```

---

## Task 9: Full test run + integration smoke (live DB) + manual click-through

**Files:** none (verification)

- [ ] **Step 1: Run the whole unit suite**

Run: `ssh root@45.77.242.169 'cd /var/www/symptex && venv/bin/pytest -q'`
Expected: all tests pass (test_db, test_phones, test_auth, test_accounts).

- [ ] **Step 2: Live integration smoke — create a clinic, log in, cleanup**

Run:
```bash
ssh root@45.77.242.169 'cd /var/www/symptex && set -a; . ./.env; set +a; venv/bin/python - <<PY
from app.services import accounts
from app import auth, db
admin = {"role":"admin","id":"env-admin","clinic_id":None}
r = accounts.create_clinic_account(admin, name_ru="ZZ Test Clinic", phone="+998900000001", password="test123456")
acc = r["account"]; clinic = r["clinic"]
u = auth.verify("+998900000001", "test123456")
print("login role:", u and u["roles"], "must_change:", u and u["must_change_password"])
assert u and u["roles"] == ["clinic"] and u["must_change_password"] is True
# cleanup
db.update("sx_accounts", {"id": acc["id"]}, {"active": False})
import requests
base = db._BASE
h = db._headers()
requests.delete(f"{base}/sx_accounts", headers=h, params={"id": f"eq.{acc[\"id\"]}"})
requests.delete(f"{base}/sx_clinics", headers=h, params={"id": f"eq.{clinic[\"id\"]}"})
print("smoke OK + cleaned up")
PY'
```
Expected: `login role: ['clinic'] must_change: True` then `smoke OK + cleaned up`.

- [ ] **Step 3: Manual click-through (owner-facing acceptance)**

On https://symptex.uz (or the origin), log in as the break-glass admin, then:
1. Users tab → create a Clinic (name + phone + password) → appears in the list.
2. Log out → log in as that clinic (its phone + password) → forced to change password → lands on the clinic panel.
3. In the clinic panel → add a Doctor and a Registrator → both appear in the staff list.
4. Log in as the doctor → forced password change → lands on the doctor panel. Same for registrator.
5. Confirm the clinic login only sees its own staff (not other clinics).

Record pass/fail for each; if any fails, STOP and debut with systematic-debugging before proceeding.

- [ ] **Step 4: Final commit / tag Phase 1 complete**

```bash
ssh root@45.77.242.169 'cd /var/www/symptex && git -c user.name=ops -c user.email=ops@symptex commit -q --allow-empty -m "chore(symptex): Phase 1 accounts & identity complete + verified"'
```

---

## Self-review notes (author)
- **Spec coverage:** phone+password login (T5), 3 tables (T1), admin creates clinic/doctor/registrator (T6/T7/T8), clinic creates doctor/registrator scoped to own clinic (T6 `_resolve_clinic_scope`, tested), forced first-login change (T7 gate + T8 screen), password reset + deactivate (T6/T7), break-glass admin (T5), migration of file-admin → retired via break-glass (T5 drops `seed_admin`), security/RLS (T1), tests (T3–T6) + manual click-through (T9). All spec §8 acceptance items map to T6 unit tests and T9 smoke/click-through.
- **Out of scope (correctly absent):** rich profiles/services (Phase 2), clinic API (Phase 3), stats (Phase 4).
- **Type consistency:** `db.select/select_one/insert/update` used identically across auth/accounts; account dict keys (`role`, `clinic_id`, `doctor_id`, `must_change_password`) consistent from `_to_user` → session → `current_user` → services.
- **Note:** English (`name_en`) columns exist but are unused until Phase 3; that's intentional.
