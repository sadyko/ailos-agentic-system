# Symptex — services catalog clean rebuild (design)

Date: 2026-08-12
Status: design settled, all owner decisions recorded. Ready for an implementation plan.
Supersedes `2026-08-12-symptex-catalog-v9-rebuild-handout.md`, whose diagnosis was correct
in shape but aimed at the wrong database.

## Summary

Replace the entire services catalog with the owner's finished Excel workbook. The old
catalog, the surgery section and the platform's only clinic are deleted outright; the Excel
becomes the sole source of truth. This is a destructive, one-way change to a live site,
taken deliberately and with the consequences measured.

Source: `C:\Users\user\Desktop\service complete list (v5 first-row preview).xlsx` — despite
the name, the newest and largest workbook (0.86 MB, modified 2026-08-12 19:05) and the
consolidated final version.

## The architecture, as measured

This is the part the earlier handout got wrong, and the reason the original plan would have
silently done nothing. Three Supabase projects are involved:

| Project | Role |
|---|---|
| `yolpfhwtjdltjuwfkegf` — **medcore** | The **master catalog**: structure, slugs, names. Shared with EasyMed by design (owner confirmed, intentional). 19 tables. |
| `ydcpwtwhbetkbwhgxizv` — **Symptex** | Marketplace data, a mirror of the catalog, **and the editorial content** for every service. |
| `jfgxkjolacpbylgxbafl` — **EasyMed main** | Clinic-local services (1371 rows, unrelated schema). Not involved. |

### How a service page is assembled

`app/blueprints/public/__init__.py` builds each catalog page from **two** sources:

- **Structure and names** — `_svc_group` / `_svc_type` / `_svc_cat` /
  `core_gateway.services(...)` all call `app/services/core_gateway.py`, a read-only HTTP
  consumer of `GATEWAY_API_URL` = `http://127.0.0.1:8001/api/v1`. That is
  `easymed-api.service` (FastAPI/uvicorn, `/opt/easymed-api`), whose only Supabase target is
  `MEDCORE_URL`. **So the tree, the listings and the names come from medcore.**
- **Editorial content** — `_service_editorial(slug, lang)` queries `sb().table("services")`
  by **slug**. `sb()` is Symptex's own client. **So description, preparation, synonyms,
  biomaterial, ready_in, indications and result_means come from Symptex.**

Confirmed empirically: the gateway and Symptex return identical UUIDs for the same rows
(`service_groups.laboratory` = `f41be74f-e02d-47c0-a812-915522e8c98e`;
`e37ccd15-aa68-4da4-a3cf-a6641ad6a47b` = `mri-brain-without-contrast` in both), same total,
1229.

### The mirror runs medcore → Symptex, one way

`clinic_services.sync_catalog_services()` (SX_CATALOG_SYNC_V1) pages the gateway's
`/catalog/services` and upserts into Symptex's `services` **on conflict of `id`** —
"inserts missing ids AND realigns drifted category/name assignments". It writes only
`id, slug, name_ru, name_uz, service_category_id, is_active`, so editorial columns survive
it. It **skips any service whose category is not already mirrored**, and it materialises the
language fallback (`name_uz = name_uz or name_ru or slug`).

**Ids must therefore match across the two projects.** `department_services.service_id` in
Symptex holds medcore ids, and `standalone_clinics_for_service(svc["id"])` is called with the
gateway's id. Symptex's `service_categories.id` must equal medcore's or the sync skips
everything.

### Schemas differ

| | medcore `services` | Symptex `services` |
|---|---|---|
| Names | `name_ru`, `name_uz`, `name_en` | same |
| Description | `description_ru`, `description_uz` | + `description_en` |
| Preparation | **`preparation_notes` only** | `preparation_ru`, `preparation_uz`, `preparation_en` |
| Extras | `avg_duration_min` | `synonyms_*`, `biomaterial_*`, `ready_in_*`, `indications_*`, `result_means_*` |

The workbook's `preparation_ru` has no per-language home in medcore. It does not need one —
preparation is read from Symptex.

Medcore has **only the legacy chain** (`services.service_category_id`,
`service_categories.service_type_id`, `service_types.service_group_id`, all 100% populated)
and **no v6 columns at all**. The dual-hierarchy trap that the handout called Blocker 1 is a
**Symptex-mirror-only artefact**. `app/services/catalog.py`, the file the handout cited as
proof, is **dead code** — nothing imports it.

## Verified starting state

### The workbook

| Sheet | Real rows |
|---|---|
| Groups | 7 |
| Categories | 29 |
| Types | 204 |
| Services | 1797 |
| Specialties | 50 |
| Filters | 23 |

Services per group: laboratory 1002, diagnostics 493, consultations 98, procedures 92,
dentistry 66, aesthetics 46. **Surgery has no content.**

No duplicate slugs, no orphaned parents, no placeholder text. Every service has `name_ru`,
`description_ru`, `preparation_ru`. All four "дополнение" supplements are already folded in —
verified individually: the v2 deletion (кардиальный миоглобин gone), the v2 type rename
(`Гормоны щитовидной и паращитовидных желёз`), the v2 typo fix (ДНК-генеалогия), v3
consultations and procedures, v4 dentistry/cosmetology/trichology, and the ophthalmology
supplement. No supplement covers surgery.

### Medcore (the master)

1229 services, 81 types, 138 categories, 5 groups. Language coverage **100% ru and uz at
every level**; `name_en` 0 on services; **0 descriptions**. Specialties: 50, complete in
ru/uz/en — the same 50 slugs the workbook carries, so importing them there is a no-op.

**No foreign keys reference the catalog at all.** Nothing physically blocks a delete, and
nothing protects against a mistake either — which makes the backup more important, not less.

Rows referencing the catalog anywhere in medcore: `clinic_services` 5, `lab_panels` 3 —
**8 in total.**

### Symptex (mirror + editorial + marketplace)

1229 mirrored services, 138 categories, 81 types, 5 groups. `name_uz` 1229/1229, but
**0 descriptions and 0 preparation** — the editorial columns exist and are empty. That is
why live service pages show a name and nothing else. `specialties` 0, `catalog_filters` 0.

Live slugs are English transliterations; the workbook uses Russian ones. Only **16 of 1229**
overlap, so this is a replacement, not an update.

Constraints in Symptex: `department_services → services` RESTRICT and NOT NULL (200 rows);
`lab_results → services` SET NULL (0 rows); the three catalog levels RESTRICT each other.

### The clinic

`clinics` holds exactly **one** row: Medion Лабзак (`medion-5660ed`, Tashkent, 2026-07-02).
`doctors` is empty. Attached: 1 department, 200 priced laboratory services
(25 000–1 755 000 UZS), 1 registrator link. Zero appointments, slots, reviews, clinic_hours.
`appointments` and `doctors` are RESTRICT but empty, so nothing blocks the delete.

### Staging is not isolated

`sxdev` (:8013) runs with `EnvironmentFile=/var/www/symptex-next/.env` and uses the live
database. It stages code, not data. The backup is the only undo.

## Owner decisions

Each made with the measured consequences in front of them:

1. **Changeover** — wipe and rebuild from the Excel; no bridge from the old catalog.
2. **Surgery** — wipe it too. The surgery group row survives (it is in the workbook) as an
   empty section until content arrives.
3. **Old URLs** — do nothing. All 1229 existing addresses 404. No redirects.
4. **Medion** — delete the clinic, its login and its 200 prices. Reaffirmed after being shown
   it is the platform's only clinic and that deletion leaves zero clinics and zero doctors.
5. **Medcore sharing** — intentional. Rebuild there.
6. **Uzbek** — import Russian only; leave the Uzbek fields present but empty and let the site
   fall back to Russian; the owner will supply Uzbek later.

Decision 4 removes the only RESTRICT blocker, so no slug matching is needed anywhere.

### Decision 6 needs no code

`core_gateway._name()` is `row.get(f"{field}_{lang}") or row.get(f"{field}_ru") or ""`, and
`_service_editorial._L()` is the same shape. Groups, types, categories and services all read
through them, so an empty `name_uz` already renders the Russian name on `/uz/` pages.

Leave `name_uz` **NULL rather than copying Russian into it** — that keeps "not yet
translated" queryable, so the owner can later be told exactly which rows still need Uzbek.
Note that `sync_catalog_services()` materialises the fallback into the *mirror*
(`name_uz = name_uz or name_ru or slug`), so medcore, not Symptex, is where that question
must be asked.

## Design

### Order of operations

0. **Back up.** Dump medcore's four catalog tables, Symptex's four catalog tables, and
   Symptex's `clinics` / `departments` / `department_services` / `registrator_clinics` to
   timestamped JSON, copied off the server. The only undo.
1. **Fix the importer.** `scripts/sync_catalog_v5.py` currently writes the v6 chain into
   Symptex. It needs (a) the sheet→table mapping corrected to the single real chain, and
   (b) the ability to target medcore as well as Symptex:

   ```python
   g = imp.sync("service_groups",     _rows(wb["Groups"]))
   c = imp.sync("service_types",      _rows(wb["Categories"]),   # sheet L2 -> table L2
                parent_col="service_group_id",  parent_map=g)
   t = imp.sync("service_categories", _rows(wb["Types"]),        # sheet L3 -> table L3
                parent_col="service_type_id",   parent_map=c)
   imp.sync("services",               _rows(wb["Services"]),
            parent_col="service_category_id", parent_map=t, text_cols=SVC_TEXTS)
   ```

   With a comment recording that medcore's `service_types` holds what the workbook calls a
   Category, and vice versa. `SVC_TEXTS` must be filtered per target: medcore rejects
   `preparation_ru/uz/en`, `description_en` and the `synonyms_*` family.
2. **Delete Medion** — one delete on `clinics`; the cascade takes the department, the 200
   `department_services` rows and the registrator link. This removes the only RESTRICT
   blocker in Symptex.
3. **Delete the old catalog in medcore**, children first: `services`, `service_categories`,
   `service_types`. `service_groups` stays — all 5 live slugs are in the workbook, so the
   importer updates them by slug and their ids hold.
4. **Import structure and names into medcore** from the workbook. Empty tables, so a pure
   insert: no slug collisions, no deactivation pass, the >30% guard cannot fire.
5. **Rebuild Symptex's mirror from medcore with identical ids** — delete Symptex's
   `services`, `service_categories`, `service_types` and copy medcore's rows verbatim, ids
   included. `sync_catalog_services()` only covers services and only when the category is
   already mirrored, so groups, types and categories must be copied explicitly.
6. **Import editorial into Symptex by slug** — `description_ru`, `preparation_ru`, and any
   other workbook column that has a home there.
7. **Import specialties and filters into Symptex** (0 and 0 today). Medcore's specialties are
   already complete, so it is untouched.
8. **Drop the three dead v6 columns** in Symptex — `services.service_type_id`,
   `service_categories.service_group_id`, `service_types.service_category_id`. No FKs, no data.
9. **Ship** — merge with `git merge --no-edit`, `systemctl reload symptex-next` (which also
   clears the gateway consumer's 30-minute cache), verify, regenerate the sitemap.

Steps 2–7 run as one sequence. Between the deletes and the end of the import the catalog is
empty or partial; with zero clinics and zero doctors, the exposure is cosmetic and brief.

### Why delete rather than deactivate

The importer never hard-deletes by design — a row missing from the sheet becomes
`is_active=false`. Right for an update, wrong here: the owner asked for the old library to be
gone, and 1229 deactivated rows would leave dead English slugs in the table to confuse every
future reader. The deletes in steps 2, 3 and 5 are therefore direct SQL, outside the
importer, guarded by the step-0 backup rather than by the importer's rails.

### Deliberately not built

- No slug matching, bridge or redirect map — decisions 3 and 4 remove the need.
- No group-scoped deactivation — nothing is preserved, so nothing needs scoping.
- No Uzbek generation — decision 6; the existing Russian fallback covers it.
- No change to `app/sitemap.py` or `clinic_services.py`; fixing the importer to write the
  chain they already read means the app needs no migration.

## Consequences

Accepted, recorded so they are not rediscovered as surprises:

- **1229 URLs return 404.** No redirects, by decision.
- **The marketplace has no supply** — zero clinics, zero doctors until someone is onboarded.
  1797 pages with nothing bookable behind them.
- **Surgery is an empty section** until content arrives.
- **`/uz/` shows Russian service and type names** until Uzbek is supplied. Groups and
  categories keep their Uzbek from the workbook.
- **Medion's 200 prices are unrecoverable** except from the step-0 backup.
- **EasyMed clinics see the new catalog** in their service picker. 8 rows there reference
  catalog ids and will dangle; they need checking after the rebuild.

Against those: 1797 services gain a real description and preparation text where there were
none, categories and types gain full SEO metadata, 568 more services are listed, and the 50
specialty pages and the filter landing pages become possible for the first time.

## Acceptance

- Medcore: `services` 1797, `service_types` 29, `service_categories` 204, `service_groups` 7.
- Symptex mirror: identical ids and counts to medcore; `specialties` 50, `catalog_filters` 23.
- Every service resolves through the chain: `services.service_category_id` 1797/1797, and the
  same at the two levels above.
- All six populated group pages list services; surgery renders empty without erroring.
- A service page shows its Russian name, description and preparation text.
- A `/uz/` service page shows the Russian name rather than a blank.
- Specialty pages and indexable filter landing pages return 200 and are linked.
- Every URL in the regenerated sitemap returns 200; no deleted slug appears in it.
- Search returns services.
- `clinics` is empty and clinic pages render an empty state without erroring.
- The 8 medcore rows referencing catalog ids are re-pointed or knowingly cleared.

## Risks

| Risk | Handling |
|---|---|
| Delete is irreversible and medcore has no FKs to stop a mistake | Step-0 backup, taken and copied off the server first |
| Ids drift between medcore and Symptex, breaking the mirror | Step 5 copies rows verbatim including ids; verify counts and a sample id match before shipping |
| Import fails partway | Tables are empty at that point; the importer is slug-keyed and idempotent, so re-run |
| medcore rejects a column the workbook has | `SVC_TEXTS` filtered per target; dry-run against medcore first |
| Empty `clinics` breaks a page assuming at least one | Check clinic list, clinic detail and the booking entry point after the delete |
| Gateway serves stale catalog for up to 30 min | `_TTL = 1800` in the consumer; `systemctl reload symptex-next` clears it |
| Sitemap still lists deleted slugs | Regenerate and re-crawl as the final step |
| Importer writes empty strings over content | Verified it does not — `_fields()` omits `None` cells |

## Tooling added

`C:\Users\user\.claude\easymed-tools\sbq_mc.py` — read-only SQL against medcore. Refuses
anything that is not a single SELECT/WITH and sends `read_only: true`. Authenticates with
`sx_token.txt`; `sb_token.txt` returns 403 on that project.

## Related

- `2026-08-12-symptex-catalog-v9-rebuild-handout.md` — the earlier handout. Its structural
  findings hold for Symptex's mirror; its target and its plan are superseded.
- Untouched by this work: privacy policy and consent (`/ru/privacy`, `/ru/terms` 404), admin
  password rotation, the «Проверено врачом Symptex» claim on 2656 articles, and the absence
  of an SMS provider.
