# Symptex — services catalog v9 rebuild (master prompt / handout)

> **Paste everything below the line into a fresh Claude Code chat** opened in
> `c:\Users\user\Desktop\ailos-agentic system`. It is self-contained.
>
> Written 2026-08-12 after verifying live state directly. Every number below was
> measured, not assumed.

---

You are continuing maintenance on **Symptex**, a live patient marketplace. The owner is
**non-technical**: they approve and describe in plain language, you do all code and explain
results simply. Never ask them to read or write code.

## The system

| | |
|---|---|
| Site | `symptex.uz` (RU/UZ, `/ru/…` and `/uz/…`) |
| Code | `/var/www/symptex-next` on `45.77.242.169`, Flask 3.0.3 + gunicorn, port 8011 |
| Database | Supabase project `ydcpwtwhbetkbwhgxizv` (Symptex's own, **not** EasyMed's) |
| SQL tool | `python C:/Users/user/.claude/easymed-tools/sbq_sx.py "<sql>"` |
| Staging | worktree `/var/www/symptex-next-dev`, systemd unit `sxdev`, port 8013 |

**Deploy flow** — build on a feature branch, then in `/var/www/symptex-next`:
`git merge --no-edit <branch>` then `systemctl reload symptex-next`.

### Hard-won gotchas — read before touching anything

- **Always invoke the SQL tools by absolute path.** `.claude/settings.local.json` allows
  `Bash(python C:/Users/user/.claude/easymed-tools/sbq.py *)`. Calling them as
  `cd <dir> && python sbq.py …` does not match, falls through to the safety classifier, and
  every statement gets denied for no obvious reason.
- **Start `sxdev` with `--property=EnvironmentFile=/var/www/symptex-next/.env`** or the
  Supabase client is offline and every page 500s.
- **Never `git merge --ff-only`.** The owner commits UI/CSS directly on master in parallel;
  ff-only aborts. Use `--no-edit`, and re-read files before editing them.
- **Never pipe a merge into `tail`/`head`** — the pipe masks the exit status and a failed
  merge looks like success.
- **No unbounded `grep -o` quantifiers across the repo.** A previous audit ate 63% of server
  RAM (load 6.74) and starved the live site.
- **`sbq_sx.py` truncates output at 6000 chars.** Aggregate in SQL rather than dumping rows.

## The goal

The owner has finished the catalog content in Excel and wants the services structure rebuilt
from it: `C:\Users\user\Desktop\service complete list v9.xlsx`.

The importer already exists: `scripts/sync_catalog_v5.py`, slug-keyed, dry-run by default.

```
python scripts/sync_catalog_v5.py --xlsx <path>            # dry run, writes nothing
python scripts/sync_catalog_v5.py --xlsx <path> --apply    # commit
                                   --allow-mass-deactivate # only for a real full replacement
```

It **never hard-deletes**. A row that disappears from the sheet becomes `is_active=false`.
If a sheet would switch off more than 30% of a table's live rows it refuses and tells you.

---

## STOP — two blockers, both verified. Do not run `--apply` until they are resolved.

### Blocker 1 — the importer writes columns nothing reads

Every catalog table carries **two** parent columns. Both hierarchies physically exist:

| Level | Live/legacy chain (has the FKs) | v6/v9 chain (added later) |
|---|---|---|
| 2 | `service_types.service_group_id` | `service_categories.service_group_id` |
| 3 | `service_categories.service_type_id` | `service_types.service_category_id` |
| 4 | `services.service_category_id` | `services.service_type_id` |

Measured population:

```
services.service_category_id (legacy)        1229 / 1229 filled
services.service_type_id (v6)                   0 / 1229 filled
service_categories.service_type_id (legacy)   138 / 138
service_categories.service_group_id (v6)        0 / 138
service_types.service_group_id (legacy)        81 / 81
service_types.service_category_id (v6)          0 / 81
```

**The entire app reads the legacy chain** — `app/sitemap.py`, `app/services/catalog.py`,
`app/services/clinic_services.py` all query `service_group_id` on `service_types`,
`service_type_id` on `service_categories`, `service_category_id` on `services`.

**The importer writes the v6 chain.** So `--apply` today would load 1443 services into columns
no page reads: the import reports success, the site shows the old catalog, and the new rows sit
orphaned. This has never been applied — only dry-run — which is why it hasn't bitten yet.

The two chains are the same shape with the words swapped:

- Excel v9: Group → **Category** (broad: Биохимия, УЗИ) → **Type** (narrow: Кровь, Моча) → Service
- Live DB: Group → **service_types** (broad: УЗИ) → **service_categories** (narrow: УЗИ брюшной полости) → Service

Only the vocabulary is inverted; the structure is identical.

**Recommended fix — map the sheets onto the existing tables (Option A).** Three lines in
`run()` in `scripts/sync_catalog_v5.py`. No schema change, no app change, FKs stay intact:

```python
g = imp.sync("service_groups",     _rows(wb["Groups"]))
c = imp.sync("service_types",      _rows(wb["Categories"]),   # sheet level 2 -> table level 2
             parent_col="service_group_id",    parent_map=g)
t = imp.sync("service_categories", _rows(wb["Types"]),        # sheet level 3 -> table level 3
             parent_col="service_type_id",     parent_map=c)
imp.sync("services",               _rows(wb["Services"]),
         parent_col="service_category_id",     parent_map=t, text_cols=SVC_TEXTS)
```

The alternative (Option B — migrate the app to the v9 direction) touches sitemap, catalog,
clinic_services, templates and search on a live SEO-indexed site for no user-visible gain.
**Confirm the choice with the owner in plain language before writing code**, then, if Option A,
add a comment saying the DB's `service_types` holds what the Excel calls a Category, and delete
the three dead v6 columns afterwards so nobody re-discovers this trap.

### Blocker 2 — v9 covers only 2 of the 5 groups

Measured from the workbook:

```
Groups     5   consultations, diagnostics, laboratory, procedures, surgery
Categories 21  laboratory 16, diagnostics 5      <- nothing for the other three
Types     162  laboratory 105, diagnostics 57    <- nothing for the other three
Services 1443  laboratory 1002, diagnostics 441  <- nothing for the other three
```

The live site has **1229 services across all five groups**. Applying v9 as a full replacement
would deactivate every consultations, procedures and surgery service and empty three group
pages. The >30% guard would refuse first — do **not** reach for `--allow-mass-deactivate` to
push past it. That guard is correct here.

`services list for medcore/service {consultation,diagnostics,procedures,surgery}.xlsx` are still
**blank templates** (999/1999/9999 pre-formatted empty rows, byte-identical copies), so the
missing content does not exist yet anywhere.

**Ask the owner which they want:**
1. **Import laboratory + diagnostics only, leave the other three untouched** (recommended) —
   scope the sync per group so absent groups are never considered "removed".
2. Wait until all five groups are filled, then do one full replacement.

Option 1 needs a small importer change: restrict the deactivate-missing pass to the group slugs
present in the sheet. Without it, option 1 is not safe.

### Constraint — 200 services are sold by clinics

`department_services.service_id → services.id` is **ON DELETE RESTRICT**, 200 rows. Postgres
will physically refuse to delete those services, so a "wipe and reload" is impossible by design —
good. But a slug that changes or disappears silently deactivates a service a clinic still sells.

Before applying, diff the 200 priced slugs against the v9 `Services` slugs and show the owner
any that would be lost. `ВАЖНО - услуги с ценами (не менять slug).csv` is the protected list.
(`lab_results.service_id` is ON DELETE SET NULL and currently 0 rows.)

---

## Free wins — no blockers

`specialties` (0 rows) and `catalog_filters` (0 rows) are **empty**. v9 carries 50 specialties
and 15 filters, fully filled. The dry run passed but was never applied. Importing these is pure
upside and unblocks the 50 specialty pages and the filter landing pages.

## Note on columns

v9's `Services` sheet has **13 columns**; the v6 template had 24. The SEO fields
(`meta_*`, `keywords_*`, `faq_*`, `synonyms_ru`) are absent for services. Confirm the importer
omits absent columns from the payload rather than writing empty strings — otherwise the import
will blank live SEO content. Verify on the dev box before touching production.

## How to proceed

1. Read this whole document, then check the live numbers yourself — do not trust them stale.
2. Put the two decisions to the owner in plain language (hierarchy mapping; scope of import).
   Explain the consequence of each, recommend one, and wait.
3. Branch off master. Make the importer change.
4. **Dry run first, always.** Read the counts and confirm they match expectation.
5. Rehearse on `sxdev` (:8013) end to end — group pages, a service page, search, sitemap.
6. Diff the 200 priced slugs and show the owner the casualties before applying.
7. Apply, merge with `--no-edit`, `systemctl reload symptex-next`, verify live.
8. Regenerate the sitemap and re-check for orphans and broken links.

## Acceptance

- All five group pages list services; none accidentally emptied.
- A service page renders with its RU/UZ content; no `[FILL]` or placeholder text.
- Specialties and filter landing pages exist and are linked (no orphans).
- Every page in the sitemap returns 200; no page is unreachable from the site.
- All 200 priced services are still active and still linked to their clinics.
- Search returns services, not just clinics and doctors.

## Related

- `docs/superpowers/specs/2026-07-25-easymed-stationary-card-design.md` — unrelated, do not touch.
- Prior Symptex work: services hub, 5 top-level group pages, 1229 service pages, 50 specialty
  pages, capture-first booking, sitemap integrity. All live on master.
- Still open for the owner: privacy policy + consent (footer links are `href="#"`, `/ru/privacy`
  and `/ru/terms` 404), admin password rotation (default `admin`/`symptex2026` not overridden in
  `.env`), the «Проверено врачом Symptex» claim on 2656 articles with no named reviewer, and the
  absence of any SMS provider (booking is Telegram-only).
