# Symptex Services Structure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Symptex's `/services` into a tabbed hub + keyword-rich SEO pages (Group → Category → Type → Service, v5 order), all rendered from a local v5 catalog, with pagination and a value-chain-optimized "where to get it + price + book" path.

**Architecture:** Symptex reads catalog *structure* from its own local Supabase tables (the v5 mirror, synced from medcore which the owner rewrites), and *live* price/clinic data from the EasyMed gateway keyed by the shared catalog service ID. Flask blueprint routes render server-side (SEO), reusing the existing `services.html` + header patterns.

**Tech Stack:** Python 3.10 / Flask 3.0.3, gunicorn, Supabase (service-role client via `sb()`), Jinja2 templates, vanilla JS/CSS (`app/static`), pytest.

---

## Dependency & sequencing note (READ FIRST)

- **Catalog content is the owner's task.** The owner rewrites medcore's service content to v5 (new sequential IDs, new hierarchy) so EasyMed renders it too. Symptex **syncs its local copy from medcore**. Phases 1–2 can be **built and unit-tested now against sample v5 data**; full integration test waits until the owner loads the catalog.
- **ID consistency is the one hard invariant:** local `services.id` MUST equal the medcore/gateway v5 service ID, or `pricing.catalog_min_prices()` and `clinics_for_service()` won't join. The sync (Task 1.3) enforces this.
- **Gateway currently returns the OLD hierarchy.** Symptex no longer depends on it for structure (reads local). It still calls the gateway for live prices/clinics/availability/doctors.

## File structure map

| File | Phase | Responsibility |
|---|---|---|
| `migrations/2026-08-03_catalog_v5.sql` | 1 | Add v5 parent FKs + SEO columns to local catalog tables (idempotent) |
| `app/services/catalog.py` **(new)** | 1 | Local-first catalog read layer: groups/categories/types/services in v5 order, with SEO fields + pagination |
| `scripts/sync_catalog_v5.py` **(new)** | 1 | Sync medcore→local mirror (upsert by v5 ID); Excel-import fallback |
| `tests/test_catalog.py` **(new)** | 1 | Unit tests for `catalog.py` (mock `sb()`) |
| `app/blueprints/public/__init__.py` | 2,3 | Restructure `/services*` routes to v5 order + service detail + hub |
| `app/templates/public/services.html` | 2,3 | `level` branches reordered (group→category→type→service) + tabbed hub + pagination |
| `app/templates/public/service_detail.html` **(new)** | 2 | Per-service page: description/preparation + "где сдать" + book |
| `app/sitemap.py` | 2 | Sitemap loop → local v5 tree + new order + service pages |
| `app/services/seo_content.py` **(new)** | 2 | Build title/description/keywords/FAQ-jsonld from a catalog row |
| `tests/test_services_routes.py` **(new)** | 2,3 | Route tests (mock catalog) |
| `app/static/css/symptex.css` | 3,4 | Tabs, filter row, mega-menu, mobile accordion styles |
| `app/static/js/site.js` | 3,4 | Tab switching, filter query-param wiring, mega-menu + drawer accordion |
| `app/templates/_layout/public.html` | 4 | Услуги mega-menu (desktop) + drawer accordion (mobile) |

## Phase roadmap

| Phase | Delivers | Depends on | Testable |
|---|---|---|---|
| **1 · Data layer** | v5 local tables + `catalog.py` read module + sync | sample v5 data | unit tests (mock sb) |
| **2 · SEO pages** | group/category/type/service pages in v5 order, meta/keywords/FAQ, pagination, sitemap, 301s | Phase 1 | route tests + live pages |
| **3 · Tabbed hub** | `/services` with 5 tabs, search, per-group filters, paginated results | Phase 1–2 | route tests + manual |
| **4 · Mega-menu** | desktop hover mega-menu + mobile drawer accordion | Phase 2 (group URLs) | manual + a11y |

Phase 1 is **code-complete below**. Phases 2–4 are **task-detailed**; each task's exact template/CSS/JS is finalized against the live files at the start of that phase (subagent-driven-development reads fresh per task) — the recon in the design thread gives the anchors (file:line, selectors, function names).

---

## PHASE 1 — v5 catalog data layer

### Task 1.1: Migration — reshape local catalog to v5 + SEO columns

**Files:**
- Create: `migrations/2026-08-03_catalog_v5.sql`

Local tables today mirror the OLD order (`service_types.service_group_id`, `service_categories.service_type_id`, `services.service_category_id`). v5 is Group→Category→Type→Service, and every level needs SEO fields. All idempotent `ADD COLUMN IF NOT EXISTS` (matches the repo's manual-migration convention; applied by hand to Supabase).

- [ ] **Step 1: Write the migration SQL**

```sql
-- 2026-08-03_catalog_v5.sql — reshape local catalog mirror to v5 (Group->Category->Type->Service)
-- + SEO fields on every level. Idempotent; safe to re-run. Apply manually to Symptex Supabase.

-- v5 re-parenting (new FK columns; old ones left in place until Phase 2 cutover verified)
alter table service_categories add column if not exists service_group_id    bigint;
alter table service_types      add column if not exists service_category_id bigint;
alter table services           add column if not exists service_type_id     bigint;

-- SEO fields (RU/UZ) on groups
alter table service_groups
  add column if not exists meta_title_ru text,       add column if not exists meta_title_uz text,
  add column if not exists meta_description_ru text,  add column if not exists meta_description_uz text,
  add column if not exists keywords_ru text,          add column if not exists keywords_uz text,
  add column if not exists faq_ru jsonb,              add column if not exists faq_uz jsonb;

-- SEO fields on categories (editorial what/when/how/prep already exist)
alter table service_categories
  add column if not exists meta_title_ru text,       add column if not exists meta_title_uz text,
  add column if not exists keywords_ru text,          add column if not exists keywords_uz text,
  add column if not exists faq_ru jsonb,              add column if not exists faq_uz jsonb,
  add column if not exists is_popular boolean default false;

-- SEO fields on types
alter table service_types
  add column if not exists meta_title_ru text,       add column if not exists meta_title_uz text,
  add column if not exists meta_description_ru text,  add column if not exists meta_description_uz text,
  add column if not exists keywords_ru text,          add column if not exists keywords_uz text,
  add column if not exists faq_ru jsonb,              add column if not exists faq_uz jsonb,
  add column if not exists is_popular boolean default false;

-- Service editorial (name/slug/description/preparation)
alter table services
  add column if not exists description_ru text,  add column if not exists description_uz text,
  add column if not exists preparation_ru text,  add column if not exists preparation_uz text;

-- Lookup indexes for the new parents
create index if not exists idx_categories_group on service_categories(service_group_id);
create index if not exists idx_types_category   on service_types(service_category_id);
create index if not exists idx_services_type     on services(service_type_id);
```

- [ ] **Step 2: Verify idempotency locally (syntax only — no live apply here)**

Run: `python -c "import pathlib,re; s=pathlib.open if False else open('migrations/2026-08-03_catalog_v5.sql').read(); assert s.count('if not exists')>=15; print('ok', s.count('add column if not exists'),'columns')"`
Expected: `ok N columns` (N ≥ 20). Live apply happens in Task 1.3 rollout, by hand, against Supabase.

- [ ] **Step 3: Commit**

```bash
git add migrations/2026-08-03_catalog_v5.sql
git commit -m "feat(symptex): v5 catalog migration — re-parent + SEO columns"
```

### Task 1.2: `catalog.py` — local-first read layer (v5 order, SEO, pagination)

**Files:**
- Create: `app/services/catalog.py`
- Test: `tests/test_catalog.py`

Single source for reading the v5 catalog from local Supabase. Mirrors the `search_index.py` cache pattern (per-lang, TTL). Returns view dicts with SEO fields. `services()` paginates.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_catalog.py
from unittest.mock import MagicMock, patch

def _rows(data):
    m = MagicMock(); m.data = data; return m

def test_groups_v5_order_and_seo():
    fake = MagicMock()
    # sb().table('service_groups').select(...).eq('is_active',True).order('sort_order').execute()
    fake.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = _rows([
        {"id":3,"slug":"laboratory","name_ru":"Лаборатория","name_uz":"Laboratoriya",
         "meta_title_ru":"Анализы в Ташкенте","meta_description_ru":"Сдать анализы","keywords_ru":"анализы, кровь","faq_ru":[{"q":"?","a":"!"}],"is_popular":True},
    ])
    with patch("app.services.catalog.sb", return_value=fake):
        import app.services.catalog as c; c._CACHE.clear()
        gs = c.groups("ru")
    assert gs[0]["slug"] == "laboratory"
    assert gs[0]["name"] == "Лаборатория"
    assert gs[0]["meta_title"] == "Анализы в Ташкенте"
    assert gs[0]["keywords"] == "анализы, кровь"
    assert gs[0]["faq"] == [{"q":"?","a":"!"}]

def test_services_paginates():
    fake = MagicMock()
    q = fake.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value
    q.execute.return_value = _rows([{"id":i,"slug":f"s{i}","name_ru":f"S{i}","service_type_id":7} for i in range(24)])
    # count query
    cnt = MagicMock(); cnt.count = 51
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value = cnt
    with patch("app.services.catalog.sb", return_value=fake):
        import app.services.catalog as c; c._CACHE.clear()
        page = c.services(type_id=7, page=1, per_page=24, lang="ru")
    assert page["total"] == 51 and page["pages"] == 3 and len(page["items"]) == 24 and page["page"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_catalog.py -v`
Expected: FAIL — `ModuleNotFoundError: app.services.catalog`.

- [ ] **Step 3: Implement `catalog.py`**

```python
# app/services/catalog.py — local-first v5 catalog reader (structure + SEO fields).
# Live price/clinic data stays in pricing.py / core_gateway.py, keyed by the shared service id.
import time
from ..extensions import sb

_CACHE = {}
_TTL = 1800

def _cached(key, fn):
    now = time.time(); hit = _CACHE.get(key)
    if hit and now - hit[0] < _TTL: return hit[1]
    val = fn()
    if val is not None: _CACHE[key] = (now, val)
    return val if val is not None else (hit[1] if hit else None)

def _L(row, base, lang):
    return (row.get(f"{base}_{lang}") or row.get(f"{base}_ru") or "").strip()

def _seo(row, lang):
    return {
        "meta_title": _L(row, "meta_title", lang),
        "meta_description": _L(row, "meta_description", lang),
        "keywords": _L(row, "keywords", lang),
        "faq": row.get(f"faq_{lang}") or row.get("faq_ru") or [],
    }

def _view(row, lang, extra=None):
    v = {"id": row.get("id"), "slug": row.get("slug"), "name": _L(row, "name", lang),
         "is_popular": bool(row.get("is_popular"))}
    v.update(_seo(row, lang))
    if extra: v.update(extra)
    return v

def groups(lang="ru"):
    def _f():
        c = sb()
        if not c: return []
        rows = c.table("service_groups").select("*").eq("is_active", True).order("sort_order").execute().data or []
        return [_view(r, lang) for r in rows]
    return _cached(f"groups:{lang}", _f) or []

def group(slug, lang="ru"):
    return next((g for g in groups(lang) if g["slug"] == slug), None)

def categories(group_id, lang="ru"):
    def _f():
        c = sb()
        if not c: return []
        rows = c.table("service_categories").select("*").eq("service_group_id", group_id).order("sort_order").execute().data or []
        return [_view(r, lang, {"description": _L(r, "description", lang)}) for r in rows]
    return _cached(f"cats:{group_id}:{lang}", _f) or []

def category(group_id, slug, lang="ru"):
    return next((x for x in categories(group_id, lang) if x["slug"] == slug), None)

def types(category_id, lang="ru"):
    def _f():
        c = sb()
        if not c: return []
        rows = c.table("service_types").select("*").eq("service_category_id", category_id).order("sort_order").execute().data or []
        return [_view(r, lang) for r in rows]
    return _cached(f"types:{category_id}:{lang}", _f) or []

def type_(category_id, slug, lang="ru"):
    return next((x for x in types(category_id, lang) if x["slug"] == slug), None)

def services(type_id=None, category_id=None, q="", page=1, per_page=24, lang="ru"):
    c = sb()
    if not c: return {"items": [], "total": 0, "page": 1, "pages": 0}
    parent_col, parent_val = ("service_type_id", type_id) if type_id else ("service_category_id", category_id)
    base = c.table("services").select("*", count="exact").eq("is_active", True).eq(parent_col, parent_val)
    if q: base = base.ilike("name_ru", f"%{q}%")
    total = base.execute().count or 0
    lo = (page - 1) * per_page
    rows = (c.table("services").select("*").eq("is_active", True).eq(parent_col, parent_val)
            .order("name_ru").range(lo, lo + per_page - 1).execute().data or [])
    items = [_view(r, lang, {"description": _L(r, "description", lang),
                             "preparation": _L(r, "preparation", lang),
                             "type_id": r.get("service_type_id")}) for r in rows]
    pages = (total + per_page - 1) // per_page
    return {"items": items, "total": total, "page": page, "pages": pages}

def service(type_id, slug, lang="ru"):
    c = sb()
    if not c: return None
    rows = c.table("services").select("*").eq("service_type_id", type_id).eq("slug", slug).limit(1).execute().data or []
    if not rows: return None
    r = rows[0]
    return _view(r, lang, {"description": _L(r, "description", lang), "preparation": _L(r, "preparation", lang),
                           "type_id": r.get("service_type_id")})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_catalog.py -v`
Expected: PASS (2 tests). If the mock chain mismatches the Supabase client's real call order, align the test's `MagicMock` chain to the code — do not change the code to satisfy a wrong mock.

- [ ] **Step 5: Commit**

```bash
git add app/services/catalog.py tests/test_catalog.py
git commit -m "feat(symptex): local-first v5 catalog read layer with pagination + SEO"
```

### Task 1.3: Sync medcore → local mirror (by v5 ID)

**Files:**
- Create: `scripts/sync_catalog_v5.py`

Pulls the v5 catalog from medcore and upserts into the local tables **preserving IDs** (so the price join holds). Primary source: gateway `/catalog/*` once it serves v5; fallback: import the v5 Excel export. Run manually after the owner loads medcore.

- [ ] **Step 1: Write the sync script**

```python
# scripts/sync_catalog_v5.py — upsert local catalog mirror from medcore (v5), preserving ids.
# Usage: python scripts/sync_catalog_v5.py            (from gateway /catalog/*)
#        python scripts/sync_catalog_v5.py --xlsx path/to/v5.xlsx   (fallback import)
import sys, argparse
from app import create_app
from app.extensions import sb
from app.services import core_gateway as cg

def _upsert(table, rows):
    c = sb()
    if not c or not rows: return 0
    c.table(table).upsert(rows, on_conflict="id").execute()
    return len(rows)

def from_gateway():
    # NOTE: requires the gateway to serve the v5 hierarchy (group->category->type->service).
    groups = cg._data(cg._get("/catalog/groups", auth=False))
    total = _upsert("service_groups", [{"id": g["id"], "slug": g["slug"], "name_ru": g.get("name_ru"),
        "name_uz": g.get("name_uz"), "meta_title_ru": g.get("meta_title_ru"), "meta_description_ru": g.get("meta_description_ru"),
        "keywords_ru": g.get("keywords_ru"), "faq_ru": g.get("faq_ru"), "is_active": True} for g in groups])
    for g in groups:
        cats = cg._data(cg._get("/catalog/categories", params={"group_id": g["id"]}, auth=False))
        total += _upsert("service_categories", [{"id": c["id"], "slug": c["slug"], "service_group_id": g["id"],
            "name_ru": c.get("name_ru"), "name_uz": c.get("name_uz"), "keywords_ru": c.get("keywords_ru"),
            "faq_ru": c.get("faq_ru"), "is_popular": c.get("is_popular", False), "is_active": True} for c in cats])
        for cat in cats:
            types = cg._data(cg._get("/catalog/types", params={"category_id": cat["id"]}, auth=False))
            total += _upsert("service_types", [{"id": t["id"], "slug": t["slug"], "service_category_id": cat["id"],
                "name_ru": t.get("name_ru"), "name_uz": t.get("name_uz"), "keywords_ru": t.get("keywords_ru"),
                "faq_ru": t.get("faq_ru"), "is_popular": t.get("is_popular", False), "is_active": True} for t in types])
            for t in types:
                svcs = cg.services(type_id=t["id"], limit=1000)["items"]
                total += _upsert("services", [{"id": s["id"], "slug": s["slug"], "service_type_id": t["id"],
                    "name_ru": s.get("name"), "is_active": True} for s in svcs])
    return total

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--xlsx"); args = ap.parse_args()
    app = create_app()
    with app.app_context():
        n = from_gateway() if not args.xlsx else _import_xlsx(args.xlsx)  # _import_xlsx: see Phase 1 addendum
        print(f"synced {n} catalog rows")
```

- [ ] **Step 2: Dry-run against sample data**

Run: `python scripts/sync_catalog_v5.py` (with a staging gateway or a stub). Expected: prints `synced N catalog rows`, N > 0; local tables populated in v5 order. If the gateway isn't v5 yet, use `--xlsx` fallback (the `_import_xlsx` addendum reads the same 6 sheets with openpyxl and upserts by id).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync_catalog_v5.py
git commit -m "feat(symptex): sync local catalog mirror from medcore v5 (id-preserving)"
```

> **Phase 1 addendum (write during execution):** `_import_xlsx(path)` — openpyxl reader mirroring `from_gateway`'s upserts, mapping the 6 sheets (Groups/Categories/Types/Services/Specialties/Filters) to the same columns. Specialties → a `specialties` local table (or reuse the doctors filter source); Filters → a `catalog_filters` config table read by Phase 3.

---

## PHASE 2 — SEO pages (v5 order) + pagination + sitemap

Goal: server-rendered group/category/type/service pages in the new order, each with title/description/keywords/FAQ from the catalog, paginated, in the sitemap, with 301s from old URLs.

### Task 2.1: Reorder + extend routes (`app/blueprints/public/__init__.py`)
- Replace the `services_group/services_type/services_category` trio (which reads the gateway in old order) with v5-order routes reading `catalog.py`:
  - `/services/<group>` → `catalog.group` + `catalog.categories(group_id)` → `level="group"`.
  - `/services/<group>/<category>` → `catalog.category` + `catalog.types(cat_id)` → `level="category"`.
  - `/services/<group>/<category>/<type>` → `catalog.type_` + `catalog.services(type_id, page=?, per_page=24)` + `pricing.catalog_min_prices()` join → `level="type"` (paginated list).
  - `/services/<group>/<category>/<type>/<service>` → `catalog.service` + `clinics_for_service(service.id)` + standalone → **new** `level="service"` / `service_detail.html`.
  - Keep `/services/consultations/<specialty>` → doctors (existing specialty path).
- `?page=N` parsed on the type-level (and hub) list routes; pass `page/pages` to the template.
- **Verification:** route tests in `tests/test_services_routes.py` with `catalog` + `pricing` patched; assert 200, correct template `level`, `page`/`pages` in context, and that a bad slug → 404. TDD: write the failing test first per route.

### Task 2.2: SEO helper (`app/services/seo_content.py`)
- `page_seo(row, kind, lang)` → `{title, description, keywords, faq_ld}` where `faq_ld` is a schema.org FAQPage dict from `row["faq"]`; falls back to name-derived title when meta blank. Reused by all levels. Emit via existing `seo.seo_tags(...)` + `seo.jsonld(...)` in `{% block head %}`.
- **Verification:** unit test — a row with `faq` → valid FAQPage JSON-LD; blank meta → sensible fallback title. TDD.

### Task 2.3: Template — reorder branches + pagination + service detail
- `services.html`: rename/reorder `level` branches to `group → category → type`; the **type** branch renders the paginated service list (reuse the current category-level list markup at L136-197, incl. `price_from`/`offers_n`, `siblings`, FAQ `<details>`), plus a **pagination control** (`<a rel="prev/next">` built from `page`/`pages`).
- New `service_detail.html`: H1 (name + synonyms from keywords), description + preparation, **"Где сдать"** = `clinics` (cheapest-first, price, Book button → existing `booking.booking?service=&sid=`), related services, `Service`/`AggregateOffer` + FAQ JSON-LD.
- **Verification:** render both templates in a test request; assert H1, price-from, pagination links, and JSON-LD present. Manual: load a real category with >24 services → page 2 works, first paint fast.

### Task 2.4: Sitemap + 301 redirects (`app/sitemap.py`, `app/redirects.py`)
- Rewrite `_all_paths` catalog loop to use `catalog.groups/categories/types` (local, v5 order) + append service-detail paths (cap per type, e.g. first 500) so pages are discoverable; keep consultations→specialty paths.
- Add 301s old `/services/<g>/<type>/<category>` → new `/services/<g>/<category>/<type>` where a slug map resolves; unknown → 404.
- **Verification:** `GET /sitemap-ru.xml` contains new-order URLs + service pages; an old URL returns 301 to the new one. Test with the Flask test client.

## PHASE 3 — Tabbed hub `/services` + filters + search

### Task 3.1: Hub route + tabs
- `/services` renders `level="hub"` with all 5 groups as tabs (default first / `?tab=<group>`), the active group's title/description, and its paginated services (`catalog.services(category or type filters)`), search box, filter row.
- Filters from a `catalog_filters` config (from the v5 Filters sheet): consultations = specialty(idx)/patient/city/district/date; others = category(idx)/type(idx)/city/district/date. **Indexable** filters that are set redirect to the canonical SEO URL; non-indexable ones stay `?query` with `<meta noindex>` + canonical→clean.
- **Verification:** `GET /services?tab=laboratory&city=tashkent&page=2` → 200, correct active tab, noindex on refined view, canonical present. Route test.

### Task 3.2: Hub template + CSS + JS
- `services.html` hub branch: tab strip (horizontal-scroll on mobile), search, filter chips, results grid + pagination.
- `symptex.css`: `.svc-tabs`, `.svc-filters`, mobile filter bottom-sheet.
- `site.js`: tab switch (updates `?tab`), filter change → query-param navigation, mobile "Фильтры" sheet open/close.
- **Verification:** manual on desktop + ≤400px width; keyboard operable; no horizontal body scroll.

## PHASE 4 — Header mega-menu + mobile accordion

### Task 4.1: Desktop mega-menu (`_layout/public.html`, `symptex.css`)
- Turn the Услуги nav item into a `.nav-more`-style trigger whose `.nav-drop` is a 5-column mega-menu (group dot + a few `is_popular` categories from `catalog` + "Все … →"). Reuse the existing `::after` hover-bridge + `.open` toggle in `site.js`; add `aria-expanded`, `role="menu"`, and keyboard focus handling.
- **Verification:** hover + keyboard both open it; links resolve to group pages; no overlap with the search box.

### Task 4.2: Mobile drawer accordion (`_layout/public.html`, `site.js`, `symptex.css`)
- In `.drawer__nav`, make Услуги an expandable row (chevron) revealing the 5 groups; add a click handler toggling an `.open` class on that row (mirrors the existing drawer toggle pattern).
- **Verification:** tap expands/collapses; each group link navigates; drawer close still works.

---

## Self-review

**Spec coverage:** §4 two surfaces → P2 (SEO pages) + P3 (hub). §5 URL architecture → 2.1. §6 page contents → 2.1/2.3/3.1. §7 mega-menu → P4. §8 filters/pagination → 2.1/2.3/3.1. §9 local mirror → 1.1–1.3. §10 decisions → all reflected (Latin slugs 2.1; hub↔group 2.1/3.1; service click→detail 2.3; surgery 2-level = data-driven, no code branch; storage 1.x; pagination 2.1/2.3/3.1). §11 value-chain (price-from hero, где-сдать, synonym search, SEO landings) → 2.3/3.1. §13 risks: ID consistency (1.3 invariant), gateway-vs-import (1.3 dual source), 301s (2.4). **No gaps found.**

**Placeholder scan:** Phase 1 is code-complete. Phases 2–4 are task-level by design (template/CSS/JS finalized against live files at execution, per the roadmap note) — the one deferred code fragment (`_import_xlsx`) is explicitly scoped in the addendum. No hidden TODOs in Phase 1.

**Type consistency:** `catalog.py` returns are used consistently (`groups()`→`group()`; `services()`→`{items,total,page,pages}` consumed by 2.1/2.3/3.1; `service.id` = the join key for `pricing.catalog_min_prices()` and `clinics_for_service`, per the 1.3 invariant). Local FK columns (`service_group_id`/`service_category_id`/`service_type_id`) match between 1.1 (migration), 1.2 (queries), and 1.3 (upserts).

---

## Execution handoff

Phase 1 is execution-ready now (build + unit-test against sample v5 data). Phases 2–4 execute after Phase 1 and are best run task-by-task with a fresh read of each live file.
