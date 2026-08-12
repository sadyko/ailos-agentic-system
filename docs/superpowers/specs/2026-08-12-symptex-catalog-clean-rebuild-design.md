# Symptex — services catalog clean rebuild (design)

Date: 2026-08-12
Status: target corrected to **medcore** and verified; owner confirmed the EasyMed/Symptex
catalog sharing is intentional. One open decision remains — Uzbek coverage for services and
types. The order of operations below still needs rewriting against medcore before execution.
Supersedes the plan in `2026-08-12-symptex-catalog-v9-rebuild-handout.md`

## Summary

Replace the entire Symptex services catalog with the owner's finished Excel workbook. The
old catalog and the platform's only clinic are deleted outright; the Excel becomes the sole
source of truth. This is a destructive, one-way change to a live site, taken deliberately.

**Correction, found while verifying the spec:** the catalog the public site renders does not
live in Symptex's database. It lives in a third Supabase project (`medcore`) shared with
EasyMed, and Symptex holds a one-way mirror of it. Importing the workbook into Symptex's
database — the plan in the rest of this document, and in the earlier handout — would change
nothing on the site and would be partly reverted by the next mirror sync.

Source file: `C:\Users\user\Desktop\service complete list (v5 first-row preview).xlsx`
(despite the name, this is the newest and largest workbook — 0.86 MB, modified 2026-08-12
19:05 — and is the consolidated final version.)

## Verified starting state

All figures measured on 2026-08-12 against the live database (`ydcpwtwhbetkbwhgxizv`) and
the workbook itself. Nothing here is inherited from the earlier handout.

### The workbook

| Sheet | Real rows (non-empty slug) |
|---|---|
| Groups | 7 |
| Categories | 29 |
| Types | 204 |
| Services | 1797 |
| Specialties | 50 |
| Filters | 23 |

Services per group: laboratory 1002, diagnostics 493, consultations 98, procedures 92,
dentistry 66, aesthetics 46. **Surgery has no content.**

No duplicate slugs, no orphaned parent references, no placeholder text. Every service has
`name_ru`, `description_ru` and `preparation_ru`. `name_uz` is empty for all services and
all types; groups and categories do carry `name_uz`.

All four "дополнение" supplement workbooks are already folded in — verified individually:
the v2 deletion (кардиальный миоглобин removed, plain Миоглобин retained), the v2 type
rename (`Гормоны щитовидной и паращитовидных желёз`), the v2 typo fix (ДНК-генеалогия),
v3 consultations and procedures, v4 dentistry/cosmetology/trichology, and the ophthalmology
supplement (`oftalmologicheskaya-diagnostika`). No supplement covers surgery.

### The live catalog

1229 services, all active, across 5 groups: surgery 404, laboratory 374, diagnostics 314,
procedures 137, consultations 0. Plus 81 `service_types` and 138 `service_categories`.

Live services carry `name_ru` and `name_uz` (1229/1229) but **zero** have `description_ru`
or `preparation_ru`. The live pages are names only.

Live slugs are English transliterations (`complete-blood-count-cbc`); the workbook uses
Russian ones (`klinicheskiy-analiz-krovi`). Only **16 of 1229** live slugs appear in the
workbook, so the workbook is a replacement catalog, not an update.

### The two hierarchies

Every catalog table carries two parent columns. Only one chain is populated and only that
chain has foreign keys:

| Level | Live chain (populated, has FKs) | Dead chain (0 rows, no FKs) |
|---|---|---|
| 2 | `service_types.service_group_id` 81/81 | `service_categories.service_group_id` 0/138 |
| 3 | `service_categories.service_type_id` 138/138 | `service_types.service_category_id` 0/81 |
| 4 | `services.service_category_id` 1229/1229 | `services.service_type_id` 0/1229 |

The app (`app/sitemap.py`, `app/services/catalog.py`, `app/services/clinic_services.py`)
reads the live chain. The importer writes the dead chain. This is the original trap and
must be fixed before any import.

The vocabularies are inverted but the shapes are identical:

- Workbook: Group → **Category** (broad) → **Type** (narrow) → Service
- Database: Group → **service_types** (broad) → **service_categories** (narrow) → Service

### Referential constraints

```
services            → service_categories   RESTRICT
service_categories  → service_types        RESTRICT
service_types       → service_groups       RESTRICT
department_services → services             RESTRICT, NOT NULL   (200 rows)
lab_results         → services             SET NULL             (0 rows)
```

Nothing else references the catalog tables.

### The clinic

`clinics` contains exactly **one** row: Medion Лабзак (`medion-5660ed`, Tashkent, created
2026-07-02). `doctors` is empty. Attached: 1 department, 200 priced laboratory services
(25 000–1 755 000 UZS, entered 2–3 July), 1 registrator link. Zero appointments, zero
slots, zero reviews, zero clinic_hours.

Deleting the clinic cascades into `departments`, `department_services`, `appointment_slots`,
`clinic_hours`, `doctor_clinic_requests`, `invite_tokens`, `lab_results`, `referral_partners`,
`registrator_clinics`, `registrator_requests`, `registrator_zones`, `reviews`.
`appointments` and `doctors` are RESTRICT but both are empty, so nothing blocks the delete.

### Staging is not isolated

`sxdev` (port 8013) runs with `EnvironmentFile=/var/www/symptex-next/.env` and therefore
uses the **live database**. It stages code, not data. There is no data preview; the backup
is the only undo.

## Owner decisions

Recorded verbatim, each made with the measured consequences presented:

1. **Changeover** — wipe the catalog and rebuild from the Excel, rather than bridging the
   old catalog to the new one.
2. **Surgery** — wipe it too. The surgery group survives as an empty section (its row is in
   the workbook) until the owner supplies content. Accepted that the section shows nothing
   in the meantime.
3. **Old URLs** — do nothing. All 1229 existing page addresses will return 404. No redirects.
   Accepted that the accumulated search ranking of those pages is lost.
4. **Medion** — delete the clinic, its login and its 200 prices along with the catalog.
   Presented and reaffirmed after being shown that it is the platform's only clinic and that
   deletion leaves Symptex with zero clinics and zero doctors. Re-onboarding would require
   re-entering all 200 prices and issuing new credentials.

Decision 4 removes the only RESTRICT blocker, so no price re-pointing or service matching is
needed anywhere in this work.

## Blocker: the catalog lives in medcore, not in Symptex

Measured 2026-08-12 while verifying the claim that the app reads the live chain.

### Three databases, not one

| Project ref | Role |
|---|---|
| `ydcpwtwhbetkbwhgxizv` | **Symptex** — marketplace data + a *mirror* of the catalog. What `sbq_sx.py` reaches, and everything measured above. |
| `yolpfhwtjdltjuwfkegf` | **medcore** — the *master* services catalog. No SQL tool exists for it. |
| `jfgxkjolacpbylgxbafl` | **EasyMed main** — clinic-local services (1371 rows, unrelated schema, no group/type/category tables). What `sbq.py` reaches. |

### How the pages are actually served

`app/blueprints/public/__init__.py` renders every catalog page through `_svc_group` /
`_svc_type` / `_svc_cat` / `core_gateway.services(...)`, all of which call
`app/services/core_gateway.py` — a read-only HTTP consumer of `GATEWAY_API_URL`
(`http://127.0.0.1:8001/api/v1`). That is `easymed-api.service`, a FastAPI/uvicorn process
in `/opt/easymed-api` whose only Supabase target is `MEDCORE_URL` = `yolpfhwtjdltjuwfkegf`.

The gateway's own docstring: *"Read-only consumer of the EasyMed CORE gateway. Symptex NEVER
writes to medcore."*

Confirmed empirically — the gateway and Symptex return **identical UUIDs** for the same rows
(`service_groups.laboratory` = `f41be74f-e02d-47c0-a812-915522e8c98e`; service
`e37ccd15-aa68-4da4-a3cf-a6641ad6a47b` = `mri-brain-without-contrast` in both) and the same
total, 1229. They are two copies of one catalog.

### The mirror runs medcore → Symptex, one way

`clinic_services.sync_catalog_services()` (SX_CATALOG_SYNC_V1) pages the gateway's
`/catalog/services`, then **upserts into Symptex's local `services` on conflict of `id`** —
"inserts missing ids AND realigns drifted category/name assignments". Symptex's copy exists
so standalone clinics (Medion) can price the full catalog; it is downstream, not upstream.

### Consequences for this design

1. Importing the workbook into Symptex's database **would not change a single public page.**
   The site would keep serving the old 1229 services from medcore. This is the exact failure
   the earlier handout predicted, arriving by a different route.
2. Whatever the import did write into Symptex's mirror would be **partly overwritten** the
   next time `sync_catalog_services()` runs, which realigns names and categories from medcore.
3. `app/services/catalog.py` — the module the handout cited as proof the app reads the legacy
   chain — is **dead code**. Nothing imports it. Its reads of the v6 chain are irrelevant, and
   its existence is why the handout's diagnosis looked right.
4. The correct target is **medcore**, which is shared with EasyMed. Rebuilding it is no longer
   a Symptex-only change.

### What is known about the blast radius

Of EasyMed's 1371 clinic-local services, `catalog_service_id` is populated **0** times and
`core_service_id` **8** times. So EasyMed's stored dependence on the shared catalog is 8 rows.
That is *not* the whole picture: EasyMed's admin service picker browses the shared catalog
live, so replacing it changes what every EasyMed clinic sees when adding a service.

**Not yet established, because medcore cannot be queried:** its catalog schema, what else
references its `services` table inside medcore, and whether other EasyMed data depends on it.

### Resolved — medcore verified 2026-08-12

The owner confirmed the sharing is intentional and authorised read access.
`C:\Users\user\.claude\easymed-tools\sbq_mc.py` now exists: read-only by construction
(refuses anything that is not a single SELECT/WITH, sends `read_only: true`), pointed at
`yolpfhwtjdltjuwfkegf`. It authenticates with `sx_token.txt` — `sb_token.txt` returns 403
on this project.

Measured in medcore:

| | |
|---|---|
| Tables (public) | 19 |
| services / service_types / service_categories / service_groups | 1229 / 81 / 138 / 5 |
| Hierarchy | **legacy chain only** — `services.service_category_id`, `service_categories.service_type_id`, `service_types.service_group_id`, all 100% populated |
| v6 columns | **do not exist** |
| Foreign keys referencing the catalog | **none at all** |
| Rows referencing the catalog | `clinic_services` 5, `lab_panels` 3 — **8 in total** |
| specialties | 50, with ru + uz + en complete |

Two consequences that simplify the work:

- **The dual-hierarchy trap is a mirror-only artefact.** Medcore has one chain, so the sheet
  mapping is unambiguous: Groups → `service_groups`, sheet *Categories* → `service_types`,
  sheet *Types* → `service_categories`, Services → `services`.
- **The blast radius is 8 rows.** Nothing physically blocks a delete either, since the
  catalog carries no foreign keys — which also means the database will not protect us, so
  the backup in step 0 matters more, not less.

The workbook's 50 specialties are the same 50 slugs medcore already holds, already complete
in all three languages. Importing them into medcore is a no-op; Symptex's mirror is what
lacks them (0 rows), and it should get them by syncing from medcore, not from the workbook.

### Open: the Uzbek and English fields

Measured coverage, workbook against medcore:

| Level | Medcore now | Workbook |
|---|---|---|
| Groups | ru 5/5, uz 5/5 | ru 7/7, uz 7/7 |
| Categories (→ `service_types`) | ru 81/81, uz 81/81 | ru 29/29, uz 29/29 |
| Types (→ `service_categories`) | ru 138/138, uz 138/138 | ru 204/204, **uz 0/204** |
| Services | ru 1229/1229, uz 1229/1229, **en 0** | ru 1797/1797, **uz 0/1797**, **en 0/1797** |
| Specialties | ru/uz/en 50/50 | ru/uz/en 50/50 |

A wipe-and-import therefore replaces complete Uzbek coverage with none, on 204 types and
1797 services, on a site that publishes `/uz/` pages and a `sitemap-uz.xml`.

The Uzbek being lost is machine-translated and demonstrably faulty — `Общий анализ крови
(ОАК)` is stored as `Qonning umumiy tahlili (Eman)`, having translated the abbreviation ОАК
into the Uzbek word for the oak tree; `АЛТ (alanine аминотрансфераза)` carries its broken
Russian straight into `ALT (alanine aminotransferaza)`. It is not content worth preserving
on its own merits, but it is currently the only Uzbek there is.

English is absent for services on both sides — no regression, no gain.

**This needs an owner decision before the import is written.** It does not block the rest of
the design.

## Design (blocked — assumes a target that is not the live one)

The sequence below is sound for the database it names, but that database is the mirror. It is
retained because every step except the target still applies once the target is corrected.

### Order of operations

The sequence is forced by the foreign keys: dependants before dependencies.

0. **Back up.** Dump `services`, `service_categories`, `service_types`, `service_groups`,
   `clinics`, `departments`, `department_services` and `registrator_clinics` to timestamped
   JSON files on the server and copy them off it. This is the only undo for steps 2 and 3.
1. **Fix the importer's hierarchy mapping.** In `run()` in `scripts/sync_catalog_v5.py`,
   point the sheets at the live chain:

   ```python
   g = imp.sync("service_groups",     _rows(wb["Groups"]))
   c = imp.sync("service_types",      _rows(wb["Categories"]),      # sheet L2 -> table L2
                parent_col="service_group_id",  parent_map=g)
   t = imp.sync("service_categories", _rows(wb["Types"]),           # sheet L3 -> table L3
                parent_col="service_type_id",   parent_map=c)
   imp.sync("services",               _rows(wb["Services"]),
            parent_col="service_category_id",  parent_map=t, text_cols=SVC_TEXTS)
   ```

   With a comment recording that the database's `service_types` holds what the workbook calls
   a Category, and vice versa.
2. **Delete the clinic.** One `delete from clinics` by id; the cascade does the rest,
   including the 200 `department_services` rows.
3. **Delete the old catalog**, children first: `services`, then `service_categories`, then
   `service_types`. `service_groups` is left in place — all 5 live slugs also appear in the
   workbook, so the importer updates them by slug and their ids stay stable.
4. **Import the workbook.** Groups, categories, types, services. With the tables emptied this
   is a pure insert; no slug collisions, no deactivation pass, and the >30% guard cannot fire.
5. **Import specialties and filters** into the two currently-empty tables (50 and 23 rows).
6. **Drop the three dead columns** — `services.service_type_id`,
   `service_categories.service_group_id`, `service_types.service_category_id` — so the trap
   cannot be rediscovered. They have no FKs and no data.
7. **Ship.** Merge the branch into master with `git merge --no-edit`, `systemctl reload
   symptex-next`, verify, regenerate the sitemap.

Steps 2–5 run as one sequence. Between the deletes and the end of the import the catalog is
empty or partial; with zero clinics and zero doctors on the platform, the exposure is
cosmetic and brief.

### Why delete rather than deactivate

The importer never hard-deletes by design — a row missing from the sheet becomes
`is_active=false`. That behaviour is right for an update and wrong here: the owner asked for
the old library to be gone, and leaving 1229 deactivated rows behind would keep the dead
English slugs in the table, where they would collide with nothing but confuse everything.
The deletes in steps 2 and 3 are therefore done directly in SQL, outside the importer, and
guarded by the step-0 backup rather than by the importer's safety rails.

### What is deliberately not built

- No slug matching, no bridge, no redirect map — decisions 3 and 4 remove the need.
- No group-scoped deactivation pass — nothing is being preserved, so nothing needs scoping.
- No changes to `app/sitemap.py`, `catalog.py` or `clinic_services.py`; fixing the importer
  to write the chain those files already read means the app needs no migration.

## Consequences

Accepted, and recorded so they are not rediscovered as surprises:

- **1229 URLs return 404.** No redirects, by decision.
- **The marketplace has no supply.** Zero clinics, zero doctors until someone is onboarded.
  The catalog will be 1797 pages with nothing bookable behind them.
- **Surgery is an empty section** until the owner supplies content.
- **`/uz/` pages show Russian service names.** The workbook has no Uzbek for services or
  types, and the old Uzbek names are deleted with the old rows. Groups and categories keep
  Uzbek. This is a content gap to fill later, not a blocker.
- **Medion's 200 prices are unrecoverable** except from the step-0 backup.

Against those: all 1797 services gain a real description and preparation text where the live
catalog had none, categories and types gain full SEO metadata, 568 more services are listed,
and the 50 specialty pages and filter landing pages become possible for the first time.

## Acceptance

- `services` = 1797, `service_types` = 29, `service_categories` = 204, `service_groups` = 7,
  `specialties` = 50, `catalog_filters` = 23.
- Every service resolves through the live chain: `services.service_category_id` 1797/1797,
  and the same for the two levels above it.
- All six populated group pages list services; surgery renders as an empty section without
  erroring.
- A service page renders its Russian name, description and preparation text.
- Specialty pages and indexable filter landing pages return 200 and are linked.
- Every URL in the regenerated sitemap returns 200, and the sitemap contains no reference to
  a deleted slug.
- Search returns services.
- `clinics` is empty and the site's clinic pages render an empty state without erroring.

## Risks

| Risk | Handling |
|---|---|
| Delete is irreversible | Step-0 backup taken and copied off the server before anything else |
| Import fails partway, leaving a partial catalog | Tables are empty at that point; re-run the importer, it is slug-keyed and idempotent |
| Empty `clinics` breaks a page that assumes at least one | Check clinic list, clinic detail and the booking entry point after the delete |
| Sitemap still lists deleted slugs | Regenerate and re-crawl as the final step |
| The importer writes empty strings over content | Verified it does not: `_fields()` omits cells that are `None`, so absent columns are never written |

## Related

- `docs/superpowers/specs/2026-08-12-symptex-catalog-v9-rebuild-handout.md` — the earlier
  handout. Its structural findings are confirmed; its plan is superseded by the decisions above.
- Still open for the owner, untouched by this work: privacy policy and consent
  (`/ru/privacy` and `/ru/terms` 404), admin password rotation, the «Проверено врачом
  Symptex» claim on 2656 articles, and the absence of an SMS provider.
