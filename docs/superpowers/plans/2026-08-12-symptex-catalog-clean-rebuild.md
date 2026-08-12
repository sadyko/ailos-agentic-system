# Symptex Catalog Clean Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire services catalog with the owner's Excel workbook — 1797 services across 7 groups — deleting the old 1229-service catalog, the surgery section and the Medion clinic, with the workbook's structure landing in medcore and its SEO/editorial content landing in Symptex.

**Architecture:** A service page is assembled from two Supabase projects. **medcore** (`yolpfhwtjdltjuwfkegf`) is the master: structure, slugs, names — served to the site through the `easymed-api` gateway on `127.0.0.1:8001/api/v1`. **Symptex** (`ydcpwtwhbetkbwhgxizv`) holds a mirror keyed on *identical ids*, plus every SEO and editorial column (`meta_*`, `keywords_*`, `faq_*`, `description_*`, `preparation_*`), looked up **by slug**. So we import structure into medcore, copy medcore into Symptex verbatim to guarantee id parity, then enrich Symptex by slug. Deletes are direct SQL outside the importer, guarded only by a backup — medcore has no foreign keys on the catalog.

**Tech Stack:** Python 3 + `supabase-py` (`/var/www/symptex/venv/bin/python`), openpyxl, pytest 8.2.0, Flask app context for config, systemd (`symptex-next`, `sxdev`, `easymed-api`).

**Spec:** `docs/superpowers/specs/2026-08-12-symptex-catalog-clean-rebuild-design.md`

---

## Critical Context

Read before touching anything.

- **Staging is not isolated.** `sxdev` (:8013) runs with `EnvironmentFile=/var/www/symptex-next/.env` — the live database. It stages code, not data. The Task 1 backup is the only undo.
- **medcore has no foreign keys on the catalog.** Nothing will stop a wrong delete. Verify counts before and after every destructive step.
- **Never `git merge --ff-only`** — the owner commits UI/CSS on master in parallel. Use `--no-edit`. Never pipe a merge into `tail`/`head`; the pipe masks the exit status.
- **Always invoke the SQL tools by absolute path**, e.g. `python C:/Users/user/.claude/easymed-tools/sbq_mc.py "<sql>"`. Relative invocations fall through the permission allowlist and get denied.
- `sbq_mc.py` and `sbq_sx.py` truncate output at 6000 chars. Aggregate in SQL; page with `limit`/`offset` under ~120 rows per call.
- **The gateway caches for 30 minutes** (`_TTL = 1800` in `app/services/core_gateway.py`). `systemctl reload symptex-next` clears it.
- **Supabase clients must pin HTTP/1.1.** `app/extensions.py:27-33` builds its client with `http1=True, http2=False` because *"Cloudflare in front of Supabase drops H2 mid-stream."* A bare `create_client(url, key)` lets postgrest negotiate H2 (`h2` is installed), so any script client must copy that transport — otherwise the 1229-row medcore import runs on the exact transport the codebase documents as unreliable, and a mid-stream drop leaves a half-written catalog. Clients must also be memoized per `Importer`: constructing one costs ~83 ms, so a per-row client is ~102 s of pure construction plus a TLS handshake and an unclosed pool per row.
- **Import order in `scripts/sync_catalog_v5.py` is load-bearing.** `app/config.py:52` reads `os.environ` in the `Config` **class body**, which executes on the first `import app`. `scripts/catalog_targets.py` calls `load_dotenv()` at import. So `catalog_targets` must be imported *before* `app`, or `Config` is built from an empty environment: `client("symptex")` raises "missing credentials", and — worse — `_sync_filters` writes nothing through an offline `sb()` while reporting success. Pinned by `test_catalog_targets_is_imported_before_app`; the `# noqa: E402` markers advertise the file as import-unusual, and an import sorter would undo it silently.
- **Column allowlists are not optional.** medcore's `services` has no `preparation_ru`, no `description_en`, no `synonyms_*`. medcore's `service_groups`/`service_types` have no `meta_*`, `keywords_*` or `faq_*`. Writing them raises PostgREST errors and aborts a partially-applied import.

### Schema reference (measured 2026-08-12)

| Table | medcore columns the workbook can fill | Symptex adds |
|---|---|---|
| `service_groups` | `slug, name_ru, name_uz, name_en` | `meta_title_*, meta_description_*, keywords_*, faq_*` |
| `service_types` | `slug, name_ru, name_uz, name_en, description_ru, description_uz` | `meta_*, keywords_*, faq_*, is_popular` |
| `service_categories` | `slug, name_ru, name_uz, name_en, description_ru, description_uz, meta_title_*, meta_description_*, what_*, when_*, how_*, preparation_ru, preparation_uz` | `keywords_*, faq_*, is_popular` |
| `services` | `slug, name_ru, name_uz, name_en, description_ru, description_uz` | `description_en, preparation_ru/uz/en, synonyms_*, biomaterial_*, ready_in_*, indications_*, result_means_*` |

**Vocabulary inversion — the single easiest thing to get wrong.** The workbook's *Category* is broad; the database's `service_types` is broad. So:

| Workbook sheet | Database table | Parent column |
|---|---|---|
| `Groups` | `service_groups` | — |
| `Categories` (29) | `service_types` | `service_group_id` |
| `Types` (204) | `service_categories` | `service_type_id` |
| `Services` (1797) | `services` | `service_category_id` |

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/catalog_targets.py` *(create)* | Build a Supabase client for `symptex` or `medcore`; own the per-target column allowlists. |
| `scripts/sync_catalog_v5.py` *(modify)* | Import the workbook. Gains `--target` and `--enrich-only`; sheet→table mapping corrected. |
| `scripts/catalog_backup.py` *(create)* | Dump every table this plan destroys, both projects, to timestamped JSON. |
| `scripts/catalog_wipe.py` *(create)* | Delete Medion, and the old catalog rows in either project, in FK-safe order. |
| `scripts/catalog_mirror.py` *(create)* | Copy medcore's catalog into Symptex verbatim, ids preserved. |
| `tests/test_catalog_targets.py` *(create)* | Allowlist filtering. |
| `tests/test_sync_catalog_v5.py` *(create)* | Sheet→table mapping, enrich-only behaviour. |
| `tests/test_catalog_mirror.py` *(create)* | Row transformation and id preservation. |

---

## Task 0: Set up the working branch

**Files:** none (environment only)

- [ ] **Step 1: Confirm the dev worktree is clean**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git status --porcelain && git branch --show-current"
```

Expected: no output from `git status --porcelain` (clean tree), followed by the current branch name. If the tree is dirty, stop and report — do not stash the owner's work.

- [ ] **Step 2: Create the feature branch off master**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git fetch . master:master 2>/dev/null; git checkout -b feat/catalog-v5-rebuild master && git branch --show-current"
```

Expected: `feat/catalog-v5-rebuild`

- [ ] **Step 3: Copy the workbook to the server, outside the repo**

Run from Windows:

```bash
ssh root@45.77.242.169 "mkdir -p /root/catalog"
scp "C:/Users/user/Desktop/service complete list (v5 first-row preview).xlsx" root@45.77.242.169:/root/catalog/v5.xlsx
ssh root@45.77.242.169 "ls -l /root/catalog/v5.xlsx"
```

Expected: a file of roughly 900 000 bytes.

- [ ] **Step 4: Verify openpyxl reads it on the server**

```bash
ssh root@45.77.242.169 "/var/www/symptex/venv/bin/python -c \"import openpyxl; wb=openpyxl.load_workbook('/root/catalog/v5.xlsx', read_only=True); print(wb.sheetnames)\""
```

Expected: `['README', 'Groups', 'Categories', 'Types', 'Services', 'Specialties', 'Filters']`

---

## Task 1: Back up everything this plan destroys

Nothing else in this plan may run until this task is complete and the dump is off the server.

**Files:**
- Create: `/var/www/symptex-next-dev/scripts/catalog_backup.py`

> **The code blocks below are the original draft. Review found four defects in them; the
> versions committed on `feat/catalog-v5-rebuild` are authoritative.** Fixed after review:
> paged reads now `.order()` (unordered paging can drop a row across a page boundary while
> the count still reads 1229 — and `registrator_clinics` has no `id`, so it orders on
> `user_id`); `catalog_targets.py` calls `load_dotenv()` with an explicit path so the
> documented command works standalone; `filter_payload` no longer waves through the three
> v6 parent columns medcore lacks; and `MANIFEST.json` now carries the restore recipe.

- [ ] **Step 1: Write the backup script**

```python
#!/usr/bin/env python3
"""Dump every table the catalog rebuild destroys, from BOTH projects, to timestamped JSON.

This is the only undo for the rebuild: medcore has no foreign keys on the catalog, so the
database will not refuse a wrong delete. Run this, copy the output off the server, and
verify the row counts before anything is deleted.

    /var/www/symptex/venv/bin/python scripts/catalog_backup.py --out /root/catalog/backup
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.catalog_targets import client  # noqa: E402

SYMPTEX_TABLES = ["service_groups", "service_types", "service_categories", "services",
                  "specialties", "catalog_filters",
                  "clinics", "departments", "department_services", "registrator_clinics"]
MEDCORE_TABLES = ["service_groups", "service_types", "service_categories", "services",
                  "clinic_services", "lab_panels"]


def dump(c, table):
    """Page through a table; PostgREST caps a single select at 1000 rows."""
    out, step, off = [], 1000, 0
    while True:
        rows = c.table(table).select("*").range(off, off + step - 1).execute().data or []
        out += rows
        if len(rows) < step:
            return out
        off += step


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="directory to write into")
    args = ap.parse_args()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = os.path.join(args.out, stamp)
    os.makedirs(root, exist_ok=True)

    manifest = {"taken_at": stamp, "tables": {}}
    for target, tables in (("symptex", SYMPTEX_TABLES), ("medcore", MEDCORE_TABLES)):
        c = client(target)
        for t in tables:
            rows = dump(c, t)
            path = os.path.join(root, f"{target}.{t}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(rows, f, ensure_ascii=False, indent=1)
            manifest["tables"][f"{target}.{t}"] = len(rows)
            print(f"  {target}.{t:22s} {len(rows):5d} -> {path}")

    with open(os.path.join(root, "MANIFEST.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"\nBackup complete: {root}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write the targets module the backup depends on**

Create `/var/www/symptex-next-dev/scripts/catalog_targets.py`:

```python
#!/usr/bin/env python3
"""Supabase clients and per-target column allowlists for the catalog rebuild.

Two projects are involved and they do NOT have the same schema:

  medcore  (yolpfhwtjdltjuwfkegf) — the master catalog: structure, slugs, names.
                                    Served to the site by easymed-api on :8001.
  symptex  (ydcpwtwhbetkbwhgxizv) — the mirror (ids identical to medcore) plus every
                                    SEO and editorial column, looked up by slug.

Writing a column the target does not have raises a PostgREST error mid-import, so every
payload is filtered through ALLOW below.
"""
import os

from supabase import create_client

MEDCORE_ENV = os.environ.get("MEDCORE_ENV_FILE", "/opt/easymed-api/.env")


def _read_env_file(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def client(target):
    """A service-role client for 'symptex' or 'medcore'."""
    if target == "symptex":
        from app.config import Config
        url, key = Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY
    elif target == "medcore":
        env = _read_env_file(MEDCORE_ENV)
        url, key = env.get("MEDCORE_URL"), env.get("MEDCORE_SERVICE_KEY")
    else:
        raise ValueError(f"unknown target {target!r} (expected 'symptex' or 'medcore')")
    if not url or not key:
        raise SystemExit(f"missing credentials for target {target!r}")
    return create_client(url, key)


# Columns each target actually has, per table. Measured 2026-08-12; keep in step with the
# spec's schema reference table.
_MEDCORE_NAMES = ["name_ru", "name_uz", "name_en"]
_SEO = ["meta_title_ru", "meta_title_uz", "meta_description_ru", "meta_description_uz",
        "keywords_ru", "keywords_uz", "faq_ru", "faq_uz"]

ALLOW = {
    "medcore": {
        "service_groups": list(_MEDCORE_NAMES),
        "service_types": _MEDCORE_NAMES + ["description_ru", "description_uz"],
        "service_categories": _MEDCORE_NAMES + [
            "description_ru", "description_uz",
            "meta_title_ru", "meta_title_uz", "meta_description_ru", "meta_description_uz",
            "what_ru", "what_uz", "when_ru", "when_uz", "how_ru", "how_uz",
            "preparation_ru", "preparation_uz"],
        "services": _MEDCORE_NAMES + ["description_ru", "description_uz"],
    },
    "symptex": {
        "service_groups": _MEDCORE_NAMES + _SEO,
        "service_types": _MEDCORE_NAMES + _SEO + ["description_ru", "description_uz",
                                                  "is_popular"],
        "service_categories": _MEDCORE_NAMES + _SEO + [
            "description_ru", "description_uz", "is_popular",
            "what_ru", "what_uz", "when_ru", "when_uz", "how_ru", "how_uz",
            "preparation_ru", "preparation_uz"],
        "services": _MEDCORE_NAMES + [
            "description_ru", "description_uz", "description_en",
            "preparation_ru", "preparation_uz", "preparation_en",
            "synonyms_ru", "synonyms_uz", "synonyms_en",
            "biomaterial_ru", "biomaterial_uz", "ready_in_ru", "ready_in_uz",
            "indications_ru", "indications_uz", "result_means_ru", "result_means_uz"],
        "specialties": _MEDCORE_NAMES + _SEO,
    },
}


def allowed(target, table):
    """Column allowlist for (target, table). Empty tuple means 'unknown — write nothing'."""
    return tuple(ALLOW.get(target, {}).get(table, ()))


def filter_payload(target, table, payload):
    """Drop keys the target's table does not have. Structural keys always pass."""
    keep = set(allowed(target, table)) | {"id", "slug", "is_active", "sort_order",
                                          "service_group_id", "service_type_id",
                                          "service_category_id"}
    return {k: v for k, v in payload.items() if k in keep}
```

- [ ] **Step 3: Write the allowlist test**

Create `/var/www/symptex-next-dev/tests/test_catalog_targets.py`:

```python
"""The allowlists are the only thing standing between the import and a PostgREST error
halfway through 1797 inserts. medcore genuinely lacks these columns."""
from scripts.catalog_targets import allowed, filter_payload


def test_medcore_services_rejects_preparation_and_synonyms():
    got = filter_payload("medcore", "services", {
        "slug": "tsh", "name_ru": "ТТГ", "description_ru": "текст",
        "preparation_ru": "натощак", "synonyms_ru": "тиреотропин", "description_en": "x",
    })
    assert got == {"slug": "tsh", "name_ru": "ТТГ", "description_ru": "текст"}


def test_symptex_services_keeps_preparation_and_synonyms():
    got = filter_payload("symptex", "services", {
        "slug": "tsh", "preparation_ru": "натощак", "synonyms_ru": "тиреотропин",
    })
    assert got["preparation_ru"] == "натощак"
    assert got["synonyms_ru"] == "тиреотропин"


def test_medcore_groups_and_types_reject_seo_columns():
    for table in ("service_groups", "service_types"):
        got = filter_payload("medcore", table, {
            "slug": "laboratory", "name_ru": "Лаборатория",
            "meta_title_ru": "T", "keywords_ru": "k", "faq_ru": [{"q": "?", "a": "!"}],
        })
        assert got == {"slug": "laboratory", "name_ru": "Лаборатория"}, table


def test_medcore_categories_keep_meta_but_not_keywords_or_faq():
    got = filter_payload("medcore", "service_categories", {
        "slug": "krov", "meta_title_ru": "T", "meta_description_ru": "D",
        "keywords_ru": "k", "faq_ru": [{"q": "?", "a": "!"}], "preparation_ru": "натощак",
    })
    assert got["meta_title_ru"] == "T"
    assert got["meta_description_ru"] == "D"
    assert got["preparation_ru"] == "натощак"
    assert "keywords_ru" not in got and "faq_ru" not in got


def test_structural_keys_always_survive():
    got = filter_payload("medcore", "services", {
        "id": "u", "slug": "s", "is_active": True, "service_category_id": "c",
        "preparation_ru": "drop me",
    })
    assert got == {"id": "u", "slug": "s", "is_active": True, "service_category_id": "c"}


def test_unknown_table_allows_nothing_beyond_structure():
    assert allowed("medcore", "specialties") == ()
    assert filter_payload("medcore", "specialties", {"name_ru": "x", "slug": "y"}) == {"slug": "y"}
```

- [ ] **Step 4: Run the allowlist tests**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_catalog_targets.py -v"
```

Expected: 6 passed.

- [ ] **Step 5: Run the backup**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_backup.py --out /root/catalog/backup"
```

Expected, exactly — if any number differs, stop and re-measure before proceeding:

```
  symptex.service_groups          5
  symptex.service_types          81
  symptex.service_categories    138
  symptex.services             1229
  symptex.specialties             0
  symptex.catalog_filters         0
  symptex.clinics                 1
  symptex.departments             1
  symptex.department_services   200
  symptex.registrator_clinics     1
  medcore.service_groups          5
  medcore.service_types          81
  medcore.service_categories    138
  medcore.services             1229
  medcore.clinic_services         5
  medcore.lab_panels              7
```

- [ ] **Step 6: Copy the backup off the server and verify it opens**

```bash
scp -r root@45.77.242.169:/root/catalog/backup "C:/Users/user/Desktop/symptex-catalog-backup"
python -c "import json,glob,os; d=sorted(glob.glob('C:/Users/user/Desktop/symptex-catalog-backup/*/MANIFEST.json'))[-1]; print(json.load(open(d,encoding='utf-8'))['tables'])"
```

Expected: the same counts as Step 5, printed as a dict.

- [ ] **Step 7: Commit**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git add scripts/catalog_targets.py scripts/catalog_backup.py tests/test_catalog_targets.py && git commit -m 'feat(catalog): per-target clients, column allowlists and a full backup script'"
```

---

## Task 2: Correct the importer's sheet→table mapping

The importer currently writes the v6 chain (`service_categories.service_group_id`, `service_types.service_category_id`, `services.service_type_id`). Those columns exist only in Symptex, are empty, and are read by nothing. medcore has only the real chain.

**Files:**
- Modify: `/var/www/symptex-next-dev/scripts/sync_catalog_v5.py` (the `run()` function, and `Importer.sync`)
- Create: `/var/www/symptex-next-dev/tests/test_sync_catalog_v5.py`

- [ ] **Step 1: Write the failing mapping test**

Create `/var/www/symptex-next-dev/tests/test_sync_catalog_v5.py`:

```python
"""The workbook and the database use 'category' and 'type' in OPPOSITE senses:

    workbook Category (29, broad)  ->  table service_types      (broad)
    workbook Type     (204, narrow)->  table service_categories (narrow)

These assert the table each sheet lands in and the parent column used, so the inversion
cannot silently flip back.
"""
from unittest.mock import MagicMock, patch

import scripts.sync_catalog_v5 as sync


def _wb():
    """Minimal workbook: one row per level, parents referenced by row number."""
    def sheet(rows):
        ws = MagicMock()
        ws.iter_rows.return_value = iter(rows)
        return ws
    wb = MagicMock()
    wb.sheetnames = ["Groups", "Categories", "Types", "Services"]
    wb.__getitem__.side_effect = {
        "Groups": sheet([("id", "slug", "name_ru"), (1, "laboratory", "Лаборатория")]),
        "Categories": sheet([("id", "slug", "group_id", "name_ru"),
                             (1, "biohimiya", 1, "Биохимия")]),
        "Types": sheet([("id", "slug", "category_id", "name_ru"),
                        (1, "krov", 1, "Кровь")]),
        "Services": sheet([("id", "slug", "type_id", "name_ru"),
                           (1, "alt", 1, "АЛТ")]),
    }.__getitem__
    return wb


def test_each_sheet_lands_in_the_inverted_table_with_the_right_parent():
    calls = []

    def record(table, rows, parent_col=None, parent_map=None, text_cols=None):
        calls.append((table, parent_col))
        return {1: f"{table}-uuid"}

    imp = MagicMock()
    imp.sync.side_effect = record
    imp.log = {"insert": 0, "update": 0, "deactivate": 0, "slug_made": 0, "skip_empty": 0}

    with patch.object(sync, "Importer", return_value=imp), \
         patch("openpyxl.load_workbook", return_value=_wb()):
        sync.run("/tmp/x.xlsx", apply=False, target="medcore")

    assert calls == [
        ("service_groups", None),
        ("service_types", "service_group_id"),
        ("service_categories", "service_type_id"),
        ("services", "service_category_id"),
    ]
```

- [ ] **Step 2: Run it and watch it fail**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_sync_catalog_v5.py -v"
```

Expected: FAIL. Either `TypeError: run() got an unexpected keyword argument 'target'`, or an assertion showing the current order — `service_categories` with `service_group_id`, `service_types` with `service_category_id`, `services` with `service_type_id`.

- [ ] **Step 3: Rewrite `run()` with the corrected mapping**

In `scripts/sync_catalog_v5.py`, replace the body of `run()` from the `g = imp.sync(...)` line down to (but not including) the `# Specialties:` comment:

```python
def run(path, apply, allow_mass=False, target="symptex", enrich_only=False):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    _APPLY[0] = apply
    imp = Importer(apply, allow_mass, target=target, enrich_only=enrich_only)
    print(("APPLYING" if apply else "DRY RUN — nothing will be written")
          + f"  target={target}  enrich_only={enrich_only}  ({path})\n")

    # NOTE ON VOCABULARY — the workbook and the database invert these two words.
    # The workbook's «Категория» is the BROAD level and belongs in `service_types`;
    # its «Тип» is the NARROW level and belongs in `service_categories`. The database
    # chain is service_groups -> service_types -> service_categories -> services, and it
    # is the only chain medcore has. Do not "fix" this to match the sheet names.
    g = imp.sync("service_groups", _rows(wb["Groups"]))
    print(f"  groups      {imp.log}")
    base = dict(imp.log)

    c = imp.sync("service_types", _rows(wb["Categories"]),
                 parent_col="service_group_id", parent_map=g)
    print(f"  types(<-Categories)  { {k: imp.log[k]-base[k] for k in imp.log} }")
    base = dict(imp.log)

    t = imp.sync("service_categories", _rows(wb["Types"]),
                 parent_col="service_type_id", parent_map=c)
    print(f"  categories(<-Types)  { {k: imp.log[k]-base[k] for k in imp.log} }")
    base = dict(imp.log)

    imp.sync("services", _rows(wb["Services"]),
             parent_col="service_category_id", parent_map=t, text_cols=SVC_TEXTS)
    print(f"  services    { {k: imp.log[k]-base[k] for k in imp.log} }")
    base = dict(imp.log)
```

- [ ] **Step 4: Give `Importer` the `target` and `enrich_only` parameters**

Replace `Importer.__init__` and add client/filtering. In `scripts/sync_catalog_v5.py`:

> **`slug_fixed` must survive this edit.** Commit `635aca0` (SLUG_CLEAN_V1) added a
> `slug_fixed` counter to `self.log` and increments it inside `sync()`. Dropping the key
> from the dict below would raise `KeyError` on the first owner-typed slug that needed
> normalising. It is included — do not "tidy" it away.

```python
    def __init__(self, apply, allow_mass_deactivate=False, target="symptex",
                 enrich_only=False):
        self.apply = apply
        self.allow_mass = allow_mass_deactivate
        self.target = target
        self.enrich_only = enrich_only
        self.log = {"insert": 0, "update": 0, "deactivate": 0,
                    "slug_made": 0, "slug_fixed": 0, "skip_empty": 0, "missing": 0}

    def _c(self):
        from .catalog_targets import client
        return client(self.target)
```

Then replace every `sb()` inside `Importer` with `self._c()`. There are three: one in `_existing`, and two in `sync` (the update and the insert), plus the deactivate loop. Add the import at the top of the file:

```python
from scripts.catalog_targets import filter_payload
```

- [ ] **Step 5: Filter payloads and honour enrich-only inside `sync`**

In `Importer.sync`, replace the block from `payload = _fields(r, text_cols)` through the insert branch with:

```python
            payload = filter_payload(self.target, table, _fields(r, text_cols))
            if parent_col and not self.enrich_only:
                pv = parent_map.get(_row_no(r.get(parent_col))) if parent_map else None
                if pv:
                    payload[parent_col] = pv
            cur = existing.get(slug)
            if cur:
                rid = cur["id"]
                if not self.enrich_only:
                    payload["is_active"] = True
                if self.apply and payload:
                    self._c().table(table).update(payload).eq("id", rid).execute()
                self.log["update"] += 1
            elif self.enrich_only:
                # Enrich runs after the mirror copy, so every slug should already exist.
                # A miss means the mirror is incomplete — surface it, never insert.
                self.log["missing"] += 1
                continue
            else:
                rid = str(_uuid.uuid4())
                payload.update(id=rid, slug=slug, is_active=True)
                if self.apply:
                    self._c().table(table).insert(payload).execute()
                self.log["insert"] += 1
            by_rowno[rn] = rid
```

Also skip the deactivate pass entirely when enriching — add immediately before the `gone = [...]` line:

```python
        if self.enrich_only:
            return by_rowno
```

- [ ] **Step 5b: Gate specialties and filters on the Symptex target**

`run()` currently syncs both unconditionally. Under `--target medcore` that would (a) update
medcore's 50 already-complete specialties with a structure-only payload, and (b) write
**Symptex's** `catalog_filters` during a medcore run, because `_sync_filters` calls `sb()`
directly rather than the target's client. Both tables are Symptex-only in this rebuild.

Wrap the two existing calls at the end of `run()`:

```python
    # Symptex-only. medcore's specialties are already complete in ru/uz/en and are
    # deliberately never written; catalog_filters exists only in Symptex, and
    # _sync_filters() uses sb() directly, so it must not run under another target.
    if target == "symptex":
        if "Specialties" in wb.sheetnames:
            imp.sync("specialties", _rows(wb["Specialties"]), text_cols=SPEC_TEXTS)
            print("  specialties", {k: imp.log[k]-base[k] for k in imp.log})
        if "Filters" in wb.sheetnames:
            print("  filters     rows:", _sync_filters(wb["Filters"], apply=apply))
```

Note `catalog_filters` deliberately has **no** `ALLOW` entry and must not be routed through
`filter_payload` — `_sync_filters` builds its own payload against 11 columns
(`group_slug`, `filter_key`, `label_*`, `source`, `values`, `indexable`, `landing_*`) and
the table has no `slug`, so filtering it would strip every column to nothing.

- [ ] **Step 6: Add the CLI flags**

In `main()`, add to the argument parser and pass through:

```python
    ap.add_argument("--target", choices=["symptex", "medcore"], default="symptex",
                    help="which project to write to (default: symptex)")
    ap.add_argument("--enrich-only", action="store_true",
                    help="update existing rows by slug only; never insert, never deactivate")
```

and change the call to:

```python
            run(args.xlsx, args.apply, args.allow_mass_deactivate,
                target=args.target, enrich_only=args.enrich_only)
```

- [ ] **Step 7: Run the mapping test — it must pass now**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_sync_catalog_v5.py -v"
```

Expected: 1 passed.

- [ ] **Step 8: Add the enrich-only test**

Append to `tests/test_sync_catalog_v5.py`:

```python
def _importer(target, enrich_only, existing):
    imp = sync.Importer(apply=True, target=target, enrich_only=enrich_only)
    fake = MagicMock()
    imp._c = lambda: fake
    imp._existing = lambda table: existing
    return imp, fake


def test_enrich_only_updates_by_slug_and_never_inserts():
    imp, fake = _importer("symptex", True, {"alt": {"id": "uuid-1", "is_active": True}})
    rows = [{"id": 1, "slug": "alt", "name_ru": "АЛТ", "preparation_ru": "натощак"},
            {"id": 2, "slug": "ghost", "name_ru": "Нет такой"}]

    imp.sync("services", rows, parent_col="service_category_id",
             parent_map={1: "cat-uuid"}, text_cols=sync.SVC_TEXTS)

    assert imp.log["update"] == 1
    assert imp.log["insert"] == 0
    assert imp.log["missing"] == 1
    fake.table.return_value.insert.assert_not_called()
    sent = fake.table.return_value.update.call_args[0][0]
    assert sent["preparation_ru"] == "натощак"
    assert "service_category_id" not in sent, "enrich must not re-parent"


def test_enrich_only_never_deactivates():
    imp, fake = _importer("symptex", True,
                          {"alt": {"id": "u1", "is_active": True},
                           "dropped": {"id": "u2", "is_active": True}})
    imp.sync("services", [{"id": 1, "slug": "alt", "name_ru": "АЛТ"}],
             text_cols=sync.SVC_TEXTS)
    assert imp.log["deactivate"] == 0


def test_medcore_import_strips_columns_medcore_lacks():
    imp, fake = _importer("medcore", False, {})
    imp.sync("services", [{"id": 1, "slug": "alt", "name_ru": "АЛТ",
                           "preparation_ru": "натощак", "synonyms_ru": "ALT"}],
             text_cols=sync.SVC_TEXTS)
    sent = fake.table.return_value.insert.call_args[0][0]
    assert sent["name_ru"] == "АЛТ"
    assert "preparation_ru" not in sent
    assert "synonyms_ru" not in sent
```

- [ ] **Step 9: Run the full test file**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_sync_catalog_v5.py tests/test_catalog_targets.py -v"
```

Expected: 10 passed.

- [ ] **Step 10: Commit**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git add scripts/sync_catalog_v5.py tests/test_sync_catalog_v5.py && git commit -m 'fix(catalog): import into the real hierarchy, add --target and --enrich-only'"
```

---

## Task 3: Dry-run the workbook against medcore

No writes. This proves the mapping and the allowlists survive contact with the real 1797-row workbook before anything is deleted.

**Files:** none

- [ ] **Step 1: Dry run against medcore**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target medcore"
```

Expected: `DRY RUN — nothing will be written  target=medcore  enrich_only=False`, then per-level lines. Because the old catalog is still present and its slugs differ, expect roughly: groups 2 insert / 5 update; types(<-Categories) 29 insert; categories(<-Types) 204 insert; services 1797 insert. It will then **refuse** with `STOP: service_types — the sheet would deactivate 81 of 81 live rows (100%)`.

**That refusal is correct and expected** — it is the guard doing its job while the old catalog is still there. Task 5 deletes the old rows first, after which nothing is left to deactivate.

- [ ] **Step 2: Confirm nothing was written**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_mc.py "select (select count(*) from services) as services, (select count(*) from service_types) as types, (select count(*) from service_categories) as cats, (select count(*) from service_groups) as groups"
```

Expected: `1229, 81, 138, 5` — unchanged.

---

## Task 4: Write the wipe script

**Files:**
- Create: `/var/www/symptex-next-dev/scripts/catalog_wipe.py`

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Delete the old catalog, and optionally the Medion clinic, in foreign-key-safe order.

Deliberately NOT part of sync_catalog_v5.py: that importer never hard-deletes by design
(a row missing from the sheet becomes is_active=false). The rebuild needs the old rows
gone, so the deletes live here, are explicit, and refuse to run without --yes.

medcore has NO foreign keys on the catalog, so nothing but this ordering and the backup
protects the data. Run scripts/catalog_backup.py first.

    python scripts/catalog_wipe.py --target medcore --catalog --yes
    python scripts/catalog_wipe.py --target symptex --clinic --catalog --yes
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.catalog_targets import client  # noqa: E402

# PostgREST refuses an unfiltered DELETE; this id cannot exist, so `neq` matches every row.
_ALL = "00000000-0000-0000-0000-000000000000"

# Children first. service_groups is intentionally absent: all five live slugs are in the
# workbook, so the importer updates them by slug and their ids stay stable.
CATALOG_ORDER = ["services", "service_categories", "service_types"]


def count(c, table):
    return c.table(table).select("id", count="exact").limit(1).execute().count or 0


def wipe_catalog(c, apply):
    for table in CATALOG_ORDER:
        before = count(c, table)
        if apply:
            c.table(table).delete().neq("id", _ALL).execute()
        after = count(c, table) if apply else before
        print(f"  {table:20s} {before:5d} -> {after:5d}")


def wipe_clinic(c, apply):
    """One delete on clinics; the cascade takes departments, department_services (200),
    registrator_clinics, invite_tokens, reviews and the rest."""
    rows = c.table("clinics").select("id,name_ru").execute().data or []
    for r in rows:
        print(f"  deleting clinic {r.get('name_ru')} ({r['id']})")
        if apply:
            c.table("clinics").delete().eq("id", r["id"]).execute()
    left = count(c, "clinics") if apply else len(rows)
    print(f"  clinics remaining: {left}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["symptex", "medcore"], required=True)
    ap.add_argument("--catalog", action="store_true", help="delete services/categories/types")
    ap.add_argument("--clinic", action="store_true", help="delete clinics (symptex only)")
    ap.add_argument("--yes", action="store_true", help="actually delete (default: dry run)")
    args = ap.parse_args()

    if args.clinic and args.target != "symptex":
        raise SystemExit("--clinic only applies to the symptex project")
    if not (args.catalog or args.clinic):
        raise SystemExit("nothing to do: pass --catalog and/or --clinic")

    c = client(args.target)
    print(("DELETING" if args.yes else "DRY RUN — nothing will be deleted")
          + f"  target={args.target}\n")
    if args.clinic:
        wipe_clinic(c, args.yes)
    if args.catalog:
        wipe_catalog(c, args.yes)
    if not args.yes:
        print("\nNothing was deleted. Re-run with --yes to commit.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Dry-run it against both targets**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_wipe.py --target medcore --catalog && /var/www/symptex/venv/bin/python scripts/catalog_wipe.py --target symptex --clinic --catalog"
```

Expected: medcore shows `services 1229 -> 1229`, `service_categories 138 -> 138`, `service_types 81 -> 81`; symptex shows the Medion line plus the same three counts. Both end with "Nothing was deleted."

- [ ] **Step 3: Commit**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git add scripts/catalog_wipe.py && git commit -m 'feat(catalog): FK-safe wipe script, dry-run by default'"
```

---

## Task 5: Delete the old catalog and the clinic, then import into medcore

**This is the destructive step.** Confirm Task 1's backup exists off-server before starting.

**Files:** none (data only)

- [ ] **Step 1: Re-confirm the backup is on the Windows desktop**

```bash
python -c "import json,glob; d=sorted(glob.glob('C:/Users/user/Desktop/symptex-catalog-backup/*/MANIFEST.json'))[-1]; m=json.load(open(d,encoding='utf-8'))['tables']; assert m['medcore.services']==1229 and m['symptex.department_services']==200, m; print('backup OK', d)"
```

Expected: `backup OK <path>`. If this fails, **stop** and re-run Task 1.

- [ ] **Step 2: Delete Medion and the Symptex catalog**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_wipe.py --target symptex --clinic --catalog --yes"
```

Expected: the Medion delete line, `clinics remaining: 0`, then `services 1229 -> 0`, `service_categories 138 -> 0`, `service_types 81 -> 0`.

- [ ] **Step 3: Verify the cascade took the prices**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select (select count(*) from clinics) as clinics, (select count(*) from departments) as departments, (select count(*) from department_services) as priced, (select count(*) from services) as services, (select count(*) from service_groups) as groups"
```

Expected: `0, 0, 0, 0, 5` — groups survive by design.

- [ ] **Step 4: Delete the medcore catalog**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_wipe.py --target medcore --catalog --yes"
```

Expected: `services 1229 -> 0`, `service_categories 138 -> 0`, `service_types 81 -> 0`.

- [ ] **Step 5: Import structure and names into medcore**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target medcore --apply"
```

Expected: `APPLYING  target=medcore`, then groups 2 insert / 5 update, types(<-Categories) 29 insert, categories(<-Types) 204 insert, services 1797 insert. No `STOP:` line — the tables were empty, so nothing could be deactivated.

- [ ] **Step 6: Verify medcore and its hierarchy**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_mc.py "select (select count(*) from service_groups) as groups, (select count(*) from service_types) as types, (select count(*) from service_categories) as cats, (select count(*) from services) as services, (select count(*) from services where service_category_id is not null) as svc_parented, (select count(*) from service_categories where service_type_id is not null) as cat_parented, (select count(*) from service_types where service_group_id is not null) as typ_parented"
```

Expected: `groups 7, types 29, cats 204, services 1797, svc_parented 1797, cat_parented 204, typ_parented 29`.

If any `*_parented` count is below its table's total, the parent mapping broke — **stop**, restore from backup, and re-check Task 2.

- [ ] **Step 7: Verify the gateway now serves the new catalog**

```bash
ssh root@45.77.242.169 "systemctl restart easymed-api && sleep 3 && curl -s 'http://127.0.0.1:8001/api/v1/catalog/services?limit=1' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"total:\", d.get(\"total\")); print(d[\"data\"][0][\"slug\"], d[\"data\"][0][\"name_ru\"])'"
```

Expected: `total: 1797` and a Russian-transliterated slug with a Russian name.

---

## Task 6: Mirror medcore into Symptex with identical ids

`sync_catalog_services()` only handles the `services` table and only when the category is already mirrored, so groups, types and categories must be copied explicitly. Ids must match or the mirror, `department_services` and `standalone_clinics_for_service` all break.

**Files:**
- Create: `/var/www/symptex-next-dev/scripts/catalog_mirror.py`
- Create: `/var/www/symptex-next-dev/tests/test_catalog_mirror.py`

- [ ] **Step 1: Write the failing transformation test**

Create `/var/www/symptex-next-dev/tests/test_catalog_mirror.py`:

```python
"""The mirror must preserve ids exactly — department_services.service_id and the gateway's
svc["id"] are medcore ids — while dropping medcore-only columns Symptex does not have."""
from scripts.catalog_mirror import mirror_row


def test_id_and_structure_are_preserved():
    got = mirror_row("services", {
        "id": "abc-123", "slug": "alt", "name_ru": "АЛТ", "name_uz": None,
        "service_category_id": "cat-9", "is_active": True, "sort_order": 3,
    })
    assert got["id"] == "abc-123"
    assert got["service_category_id"] == "cat-9"
    assert got["slug"] == "alt"
    assert got["sort_order"] == 3


def test_medcore_only_columns_are_dropped():
    got = mirror_row("services", {
        "id": "abc-123", "slug": "alt", "name_ru": "АЛТ",
        "avg_duration_min": 15, "preparation_notes": "натощак",
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-02T00:00:00Z",
    })
    assert "avg_duration_min" not in got
    assert "preparation_notes" not in got
    assert "updated_at" not in got, "Symptex.services has no updated_at column"
    assert "created_at" not in got, "let the target default it"


def test_empty_uzbek_is_left_empty_not_backfilled_with_russian():
    """Decision 6: name_uz stays NULL so 'still needs translating' remains queryable.
    The site already falls back to Russian at render time."""
    got = mirror_row("services", {"id": "i", "slug": "s", "name_ru": "АЛТ", "name_uz": None})
    assert got.get("name_uz") is None
    assert got["name_ru"] == "АЛТ"


def test_group_rows_keep_only_columns_symptex_shares():
    got = mirror_row("service_groups", {
        "id": "g1", "slug": "laboratory", "name_ru": "Лаборатория", "name_uz": "Laboratoriya",
        "default_provider_type": "lab", "icon": "flask", "updated_at": "x",
    })
    assert got == {"id": "g1", "slug": "laboratory", "name_ru": "Лаборатория",
                   "name_uz": "Laboratoriya", "icon": "flask",
                   "default_provider_type": "lab"}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_catalog_mirror.py -v"
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.catalog_mirror'`.

- [ ] **Step 3: Write the mirror script**

Create `/var/www/symptex-next-dev/scripts/catalog_mirror.py`:

```python
#!/usr/bin/env python3
"""Copy medcore's catalog into Symptex verbatim, ids preserved.

Symptex's copy is a MIRROR: sync_catalog_services() upserts on conflict of `id`,
department_services.service_id holds medcore ids, and standalone_clinics_for_service() is
called with the gateway's id. If the ids diverge, all three break silently.

sync_catalog_services() only covers `services`, and only for categories that are already
mirrored, so this script copies all four levels, parents first.

    python scripts/catalog_mirror.py            # dry run
    python scripts/catalog_mirror.py --apply
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.catalog_targets import client  # noqa: E402

# Parents first — Symptex enforces RESTRICT between the levels.
ORDER = ["service_groups", "service_types", "service_categories", "services"]

# Columns present in BOTH projects. medcore-only columns (avg_duration_min,
# preparation_notes, updated_at) and server-defaulted ones (created_at) are dropped.
SHARED = {
    "service_groups": ["id", "slug", "name_ru", "name_uz", "name_en", "icon",
                       "default_provider_type", "sort_order", "is_active"],
    "service_types": ["id", "slug", "service_group_id", "name_ru", "name_uz", "name_en",
                      "description_ru", "description_uz", "icon", "sort_order", "is_active"],
    "service_categories": ["id", "slug", "service_type_id", "name_ru", "name_uz", "name_en",
                           "description_ru", "description_uz",
                           "what_ru", "what_uz", "when_ru", "when_uz", "how_ru", "how_uz",
                           "preparation_ru", "preparation_uz",
                           "meta_title_ru", "meta_title_uz",
                           "meta_description_ru", "meta_description_uz",
                           "icon", "sort_order", "is_active"],
    "services": ["id", "slug", "service_category_id", "name_ru", "name_uz", "name_en",
                 "description_ru", "description_uz", "sort_order", "is_active"],
}


def mirror_row(table, row):
    """Keep only the columns both projects share, and only those actually present."""
    return {k: row[k] for k in SHARED[table] if k in row}


def read_all(c, table):
    out, step, off = [], 1000, 0
    while True:
        rows = c.table(table).select("*").range(off, off + step - 1).execute().data or []
        out += rows
        if len(rows) < step:
            return out
        off += step


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually write (default: dry run)")
    args = ap.parse_args()

    src, dst = client("medcore"), client("symptex")
    print(("APPLYING" if args.apply else "DRY RUN — nothing will be written") + "\n")

    for table in ORDER:
        rows = [mirror_row(table, r) for r in read_all(src, table)]
        if args.apply:
            for i in range(0, len(rows), 200):
                dst.table(table).upsert(rows[i:i + 200], on_conflict="id").execute()
        have = dst.table(table).select("id", count="exact").limit(1).execute().count or 0
        print(f"  {table:20s} medcore {len(rows):5d} -> symptex {have:5d}")

    if not args.apply:
        print("\nNothing was written. Re-run with --apply to commit.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the mirror tests**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && /var/www/symptex/venv/bin/python -m pytest tests/test_catalog_mirror.py -v"
```

Expected: 4 passed.

- [ ] **Step 5: Dry-run the mirror**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_mirror.py"
```

Expected: `service_groups medcore 7 -> symptex 5`, `service_types medcore 29 -> symptex 0`, `service_categories medcore 204 -> symptex 0`, `services medcore 1797 -> symptex 0`.

- [ ] **Step 6: Apply the mirror**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/catalog_mirror.py --apply"
```

Expected: every line reads `medcore N -> symptex N` — 7/7, 29/29, 204/204, 1797/1797.

- [ ] **Step 7: Verify id parity on a sample**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_mc.py "select id, slug from services order by slug limit 3"
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select id, slug from services order by slug limit 3"
```

Expected: the two outputs are identical — same three slugs, same three UUIDs. If they differ, **stop**: the mirror is broken and `department_services` would not survive a future clinic onboarding.

- [ ] **Step 8: Commit**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git add scripts/catalog_mirror.py tests/test_catalog_mirror.py && git commit -m 'feat(catalog): mirror medcore into symptex with ids preserved'"
```

---

## Task 7: Enrich Symptex with the SEO and editorial content

Every SEO column (`meta_*`, `keywords_*`, `faq_*`) and every editorial column (`description_*`, `preparation_*`, `synonyms_*`) exists only in Symptex. This is where the workbook's real value lands.

**Files:** none (data only)

- [ ] **Step 1: Dry-run the enrich pass**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target symptex --enrich-only"
```

Expected: `enrich_only=True`, with `update` counts of 7, 29, 204 and 1797, `insert` 0, `deactivate` 0, and **`missing` 0**.

Read `update` as **rows matched by slug, not rows written**. Under `--enrich-only` the payload is no longer force-stamped with `is_active=True`, so a row whose every column is stripped by `filter_payload` produces an empty payload; `if self.apply and payload` correctly skips the write while the counter still increments. That cannot happen on a normal run, only an enrich one.

A non-zero `missing` is a **stop condition, not a warning** — it means a workbook slug has no mirrored row. Enrich deliberately never populates parent columns, so continuing past a non-zero `missing` leaves silent holes in the hierarchy that nothing downstream will flag. Re-run Task 6 instead of letting the importer insert an unmirrored row.

- [ ] **Step 2: Apply it**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target symptex --enrich-only --apply"
```

Expected: the same counts, now written.

- [ ] **Step 3: Verify the content landed and Uzbek was left empty**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select count(*) as services, count(*) filter (where coalesce(description_ru,'')<>'') as with_desc, count(*) filter (where coalesce(preparation_ru,'')<>'') as with_prep, count(*) filter (where coalesce(name_uz,'')<>'') as with_uz from services"
```

Expected: `services 1797, with_desc 1797, with_prep 1797, with_uz 0`.

`with_uz 0` is the intended outcome of decision 6 — the site falls back to Russian, and this keeps "still needs translating" queryable.

- [ ] **Step 4: Verify category-level SEO landed**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select 'service_types' as t, count(*) as n, count(*) filter (where coalesce(meta_title_ru,'')<>'') as meta, count(*) filter (where faq_ru is not null) as faq from service_types union all select 'service_categories', count(*), count(*) filter (where coalesce(meta_title_ru,'')<>''), count(*) filter (where faq_ru is not null) from service_categories"
```

Expected: `service_types 29 / 29 / 29` and `service_categories 204 / 204 / 204`.

---

## Task 8: Import specialties and filters

Both Symptex tables are empty. medcore's specialties are already complete in all three languages and are **not** touched.

**Files:** none (data only)

- [ ] **Step 1: Dry run**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target symptex 2>&1 | tail -6"
```

Expected: `specialties` showing 50 inserts and `filters     rows: 23`.

Note this is the *full* run, not enrich-only, so it also re-walks the catalog sheets. Because every slug already exists from Tasks 6 and 7, those levels should report updates and **zero** deactivations.

- [ ] **Step 2: Apply**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python scripts/sync_catalog_v5.py --xlsx /root/catalog/v5.xlsx --target symptex --apply 2>&1 | tail -8"
```

Expected: the same counts, written, with no `STOP:` line.

- [ ] **Step 3: Verify**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select (select count(*) from specialties) as specialties, (select count(*) from catalog_filters) as filters, (select count(*) from catalog_filters where indexable) as indexable, (select count(*) from services where is_active) as active_services"
```

Expected: `specialties 50, filters 23, indexable ≥ 1, active_services 1797`.

---

## Task 9: Drop the three dead v6 columns

They exist only in Symptex, hold no data, have no foreign keys, and are read by nothing. Removing them stops the trap being rediscovered.

**Files:** none (schema only)

- [ ] **Step 1: Confirm they are still empty**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select (select count(*) from services where service_type_id is not null) as svc_v6, (select count(*) from service_categories where service_group_id is not null) as cat_v6, (select count(*) from service_types where service_category_id is not null) as typ_v6"
```

Expected: `0, 0, 0`. If any is non-zero, **stop** — something wrote the dead chain and Task 2 needs re-checking.

- [ ] **Step 2: Confirm nothing in the code reads them**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && grep -rn 'service_type_id\|service_group_id\|service_category_id' app/ --include=*.py | grep -v 'app/services/catalog.py' | grep -v sitemap.py | head -20"
```

Expected: only `core_gateway.py` (lines ~577/584, reading the real chain from the gateway's JSON) and `clinic_services.py`. `app/services/catalog.py` is dead code and is excluded above; it is the only reader of the v6 columns.

- [ ] **Step 3: Delete the dead module and its test**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git rm app/services/catalog.py tests/test_catalog.py"
```

- [ ] **Step 4: Confirm the app still imports**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python -c 'from app import create_app; create_app(); print(\"app imports OK\")'"
```

Expected: `app imports OK`. If it fails on a missing `catalog` import, restore the file with `git checkout -- app/services/catalog.py` and stop — the module is not dead after all.

- [ ] **Step 5: Drop the columns**

Run in the Supabase SQL editor for project `ydcpwtwhbetkbwhgxizv` (the read-only `sbq_sx.py` will refuse DDL):

```sql
alter table services            drop column if exists service_type_id;
alter table service_categories  drop column if exists service_group_id;
alter table service_types       drop column if exists service_category_id;
```

- [ ] **Step 6: Verify they are gone**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select count(*) as dead_columns_left from information_schema.columns where table_schema='public' and (table_name='services' and column_name='service_type_id' or table_name='service_categories' and column_name='service_group_id' or table_name='service_types' and column_name='service_category_id')"
```

Expected: `dead_columns_left 0`.

- [ ] **Step 7: Commit**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && git commit -m 'chore(catalog): remove the dead v5 reader and the unused v6 columns'"
```

---

## Task 10: Verify on staging, then ship

**Files:** none

- [ ] **Step 1: Restart staging on the branch and check the catalog pages**

```bash
ssh root@45.77.242.169 "systemctl restart sxdev && sleep 4 && for p in /ru/services /ru/services/laboratory /ru/services/diagnostics /ru/services/consultations /ru/services/procedures /ru/services/dentistry /ru/services/aesthetics /ru/services/surgery; do printf '%-36s ' \$p; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8013\$p; done"
```

Expected: `200` for all eight. Surgery must be `200` with an empty list, not a 500 or a 404.

- [ ] **Step 2: Check a real service page end to end**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next-dev && set -a && . /var/www/symptex-next/.env && set +a && /var/www/symptex/venv/bin/python -c \"
from app import create_app
from app.extensions import sb
app = create_app()
with app.app_context():
    r = sb().table('services').select('slug').eq('is_active', True).limit(1).execute().data[0]
    print('slug:', r['slug'])
\""
```

Take the printed slug, then find its full path and fetch it:

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_sx.py "select g.slug as g, t.slug as t, c.slug as c, s.slug as s from services s join service_categories c on c.id=s.service_category_id join service_types t on t.id=c.service_type_id join service_groups g on g.id=t.service_group_id limit 1"
```

```bash
ssh root@45.77.242.169 "curl -s 'http://127.0.0.1:8013/ru/services/<g>/<t>/<c>/<s>' | grep -c 'description\|Подготовка' || true; curl -s -o /dev/null -w 'ru:%{http_code}\n' 'http://127.0.0.1:8013/ru/services/<g>/<t>/<c>/<s>'; curl -s -o /dev/null -w 'uz:%{http_code}\n' 'http://127.0.0.1:8013/uz/services/<g>/<t>/<c>/<s>'"
```

Expected: both `200`, and the page contains the description/preparation text. The `/uz/` page must render the **Russian** name rather than a blank — that is decision 6 working.

- [ ] **Step 3: Check search returns services**

```bash
ssh root@45.77.242.169 "curl -s -o /dev/null -w 'search:%{http_code}\n' 'http://127.0.0.1:8013/ru/search?q=%D0%BA%D1%80%D0%BE%D0%B2%D1%8C'"
```

Expected: `200`.

- [ ] **Step 4: Check the clinic pages survive having zero clinics**

```bash
ssh root@45.77.242.169 "for p in /ru/clinics /ru/doctors /ru/laboratories; do printf '%-20s ' \$p; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8013\$p; done"
```

Expected: `200` for all three — empty states, not errors.

- [ ] **Step 5: Merge to master and reload live**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next && git merge --no-edit feat/catalog-v5-rebuild"
ssh root@45.77.242.169 "cd /var/www/symptex-next && git log --oneline -1 && systemctl reload symptex-next && sleep 3 && systemctl is-active symptex-next"
```

Expected: the merge commit, then `active`. Do **not** pipe the merge through `tail` or `head` — the pipe masks a failed merge's exit status.

- [ ] **Step 6: Verify the live site**

```bash
ssh root@45.77.242.169 "for p in /ru/services /ru/services/laboratory /ru/services/dentistry; do printf '%-32s ' \$p; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8011\$p; done"
```

Expected: `200` for all three. The reload cleared the gateway consumer's 30-minute cache, so the new catalog appears immediately.

- [ ] **Step 7: Regenerate and check the sitemap**

```bash
ssh root@45.77.242.169 "curl -s 'http://127.0.0.1:8011/sitemap-ru.xml' | grep -o '<loc>' | wc -l"
```

Expected: substantially more than the pre-rebuild count, reflecting 1797 services plus 204 categories, 29 types, 7 groups and 50 specialties.

- [ ] **Step 8: Confirm no sitemap URL 404s**

```bash
ssh root@45.77.242.169 "curl -s 'http://127.0.0.1:8011/sitemap-ru.xml' | grep -o 'https://symptex.uz[^<]*' | shuf -n 25 | while read u; do p=\${u#https://symptex.uz}; c=\$(curl -s -o /dev/null -w '%{http_code}' \"http://127.0.0.1:8011\$p\"); [ \"\$c\" = 200 ] || echo \"\$c \$p\"; done; echo 'sample check done'"
```

Expected: only `sample check done` — no lines printed before it.

- [ ] **Step 9: Re-point or clear the 8 dangling medcore references**

```bash
export PYTHONIOENCODING=utf-8
python C:/Users/user/.claude/easymed-tools/sbq_mc.py "select 'clinic_services' as t, count(*) as rows, count(*) filter (where core_service_id not in (select id from services)) as dangling from clinic_services union all select 'lab_panels', count(*), count(*) filter (where core_service_id is not null and core_service_id not in (select id from services)) from lab_panels"
```

Expected: `clinic_services 5` and `lab_panels 7`, with the dangling counts showing how many now point at deleted ids. Report the numbers to the owner with the affected rows; do not silently clear them — these belong to EasyMed, not Symptex.

- [ ] **Step 10: Push**

```bash
ssh root@45.77.242.169 "cd /var/www/symptex-next && git push origin master 2>&1 | tail -3"
```

Only if the owner has asked for it. The repo has no remote configured for the server checkout in some setups — if push fails with "no configured push destination", report it rather than adding a remote.

---

## Rollback

If anything goes wrong after Task 5 begins:

1. Stop. Do not run further steps.
2. Restore from `C:/Users/user/Desktop/symptex-catalog-backup/<timestamp>/`. Each file is a JSON array of complete rows, so restoration is an upsert on `id`, parents before children: `service_groups`, `service_types`, `service_categories`, `services`, then `clinics`, `departments`, `department_services`, `registrator_clinics`.
3. Restore **medcore first**, then Symptex, so the mirror's ids match their source.
4. `systemctl reload symptex-next` to clear the gateway cache.
5. Verify with the Task 1 expected counts.

---

## Self-Review Notes

Checked against the spec on 2026-08-12:

- **Spec coverage.** Steps 0–9 of the spec's order of operations map to Tasks 1, 2, 5, 5, 5, 6, 7, 8, 9, 10 respectively. Decision 6 (Uzbek) is enforced by `test_empty_uzbek_is_left_empty_not_backfilled_with_russian` and verified by Task 7 Step 3. The spec's acceptance list is covered by Tasks 5 Step 6, 6 Step 7, 7 Steps 3–4, 8 Step 3, and 10 Steps 1–9.
- **Known deviation.** The spec numbers the medcore delete before the Symptex delete; this plan reverses them so that Medion's cascade (which needs Symptex's `services` intact until it runs) completes first. Same end state, one fewer ordering hazard.
- **Not covered by design.** Redirects for the 1229 dead URLs (decision 3 — do nothing) and Uzbek generation (decision 6 — owner supplies later).
- **Type consistency.** `filter_payload(target, table, payload)` and `allowed(target, table)` are used with that signature in Tasks 1 and 2. `mirror_row(table, row)` matches between Task 6's test and script. `Importer(apply, allow_mass_deactivate, target, enrich_only)` matches its call in `run()` and in the tests' `_importer` helper. The `missing` counter is added to `self.log` in Task 2 Step 4 before it is read in Task 2 Step 5 and Task 7 Step 1.