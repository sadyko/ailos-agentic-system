# Easy-Med Local — Lab Handling System

**Date:** 2026-08-08
**Status:** design approved, plan pending
**Deliverable:** a step-by-step handout prompt, executed by a fresh Claude session working in `C:\Users\user\Desktop\easymed.uz`

## Goal

Bring the laboratory **handling system** — the workflow machinery that moves a lab
order from paid to reported — into Easy-Med Local, and make it work across the whole
app, on any operating system, and on the devices a clinic actually uses.

"Handling system" means the state machine and everything attached to it: the work
queue, sample collection, accession barcodes, results entry, verification, and the
document that lands on the patient's card. It does **not** mean the catalogue of
which tests contain which measurements — clinics build that themselves through the
existing panel editor.

## The two systems

| | Role |
|---|---|
| **Server Easy-Med** — `easymed.uz`, Supabase project `jfgxkjolacpbylgxbafl` | **Read-only reference.** We study how its lab behaves. We never modify it. |
| **Easy-Med Local** — `C:\Users\user\Desktop\easymed.uz` | **The target.** Where the lab gets built. |

Easy-Med Local is a standalone product, not a newer build of the server. Its
`public/js/config.js` sets the Supabase keys to empty strings and states it "must
never talk to the deployed easymed.uz backend." Stack: Express 5, better-sqlite3,
bcryptjs, ESM. `npm start` → `node server/index.js` on port 8000; `npm test` →
`node --test`. All data lives in one gitignored file, `data/easymed.db`.

## The key insight

The port is far smaller than the line counts suggest, because the local project
already solved the hard problem.

`public/js/supabase.js` is a **Supabase-shaped shim** over the local Express API:
"Exposes a Supabase-shaped `supabase` object backed entirely by our local Express
API… The ~52 files importing `{ supabase }` keep working." Behind it,
`server/db/query-compiler.js` translates PostgREST-style queries into SQLite, and
`server/db/schema-registry.js` is an allow-list of tables, columns and roles that
replaces Postgres RLS. `TENANCY_NOOP_V1` silently drops `company_id`, `clinic_id`
and `branch_id` filters, since Local is single-clinic.

So the server's `supabase.from('lab_results')…` calls work locally **unchanged**.
This is a copy-plus-close-the-gaps job, not a rewrite.

## Verified findings

Established 2026-08-08 by reading both systems directly. The handout carries these
so the next session does not rediscover them.

### Size of the gap

| | Server | Local |
|---|---|---|
| `views/laboratory.js` | 1,814 lines (108,798 B) | 356 lines (16,836 B) |
| `views/lab-settings.js` | 34,270 B | 34,608 B |
| `views/lab-barcode.js` | 5,662 B | 5,740 B |
| `LAB_*` feature flags | 26 | 0 |

`lab-settings.js` and `lab-barcode.js` are already near-parity; `laboratory.js`
carries essentially the whole gap.

### Dependencies — all satisfied

Every import in the server's `laboratory.js` resolves in the local tree:
`../../supabase.js`, `../ui.js`, `./activity-log.js`, `../permissions.js`,
`../tenant-tables.js`, `./doc-settings.js`, `./lab-barcode.js`.

### Data access — no new RPCs needed

The server's lab module makes **no `rpc()` calls**. It touches seven tables only —
`visit_services`, `lab_results`, `visit_documents`, `lab_panels`,
`lab_panel_analytes`, `invoice_items`, `services` — and **all seven are already
registered** in the local `schema-registry.js`. The local `/api/db` query-compiler
can serve them.

### The state machine

```
awaiting_payment → (cashier accepts payment)
queued           → "Collect sample"    → sets sample_collected_at
collected        → "Start processing"  → status = in_progress
in_progress      → "Enter results…"    → opens result modal
resulted         → "Verify & report"   → marks verified_by/at, status = completed
completed        → static "Reported" tag
```

Queue filters: Open / To collect / In progress / Resulted / All.

Local already uses `queued`, `in_progress` and `completed` elsewhere in the app.
It has never used **`collected`** or **`resulted`** — those two lab-specific values
are new to the local vocabulary. `visit_services.status` is `TEXT NOT NULL DEFAULT
'added'` with no CHECK constraint, so the values need no migration; only code that
switches on status must learn them.

## Scope

**In scope**

- The lab handling workflow and every status transition above
- Accession barcodes and sample labels (`LAB_BARCODE_V1`)
- Results entry, including multi-reference and age-based ranges
- Verification, reporting, and archiving the result to the patient's documents
- The panel settings screen, service↔panel linkage, and the named-range editor
- A seeded panel catalogue — structure only, **no reference ranges**
- Working end-to-end across registration → cashier → queue → results → patient card
- Running on Windows, macOS and Linux
- Usable on the clinic's tablets and phones over the LAN

**Out of scope**

- **Reference range values of any kind.** Ranges depend on the analyser and method
  each lab uses; one clinic's ranges are wrong in another clinic. Every range field
  is stripped from the seed and left for the clinic to fill in.
- Any change to the server. It is a read-only reference throughout.
- Syncing data between server and local. They are separate products.

## Panels, services and the settings screen

### The link

`lab_panels.service_id` connects a panel to the service that is ordered and paid
for. On the server **all 78 panels are linked; there are no orphans** — effectively
one service, one panel. The local schema already has the column, and the local
settings editor already references `service_id` in nine places.

### The settings screen already exists

Local `views/lab-settings.js` (419 lines) is at **capability parity with the
server** — identical reference counts for every relevant feature:

| Capability | Local | Server |
|---|---|---|
| `ref_ranges` (named ranges) | 17 | 17 |
| `age_min` / `age_max` | 6 / 6 | 6 / 6 |
| `service_id` (panel↔service) | 9 | 9 |
| `value_options` (select lists) | 9 | 9 |
| `group_label` | 11 | 11 |
| `ref_low_m` (sex-specific) | 8 | 8 |

It is marginally larger than the server's copy, so it carries local work the server
does not. **This phase verifies the screen against the local API — it does not
rebuild it, and the server's copy must not overwrite it.**

### What the catalogue ships

78 panels, 300 analytes, exported from the server.

**Included:** panel name, code, modality, narrative flag, service link · analyte
name, unit, result type, select options, decimals, group label, sort order.

Result types in use: `numeric` (226), `text` (67), `select` (7). Select options are
comma-separated strings, e.g. `O(I), A(II), B(III), AB(IV)`.

**Excluded:** `ref_low`, `ref_high`, `ref_text`, `ref_ranges`, `ref_low_m`,
`ref_high_m`, `ref_low_f`, `ref_high_f` — every range field, without exception.

Duplication is minor: 78 panels resolve to 76 distinct names, i.e. **2 exact
duplicates**. The differently-named complete-blood-count variants are separate
records, not copies. Analytes repeating across panels (Лейкоциты in four) is
correct clinical modelling — blood and urine both measure leukocytes — and must be
preserved.

### Normalisation

The source data has ragged edges. The seed is normalised, and the session must
**produce a complete list of every change made** for human review before it lands:

- Stray whitespace — `RBC   Эритроциты`, `EOS%    Эозинофилы`
- Typos — `Ср.обьём эр.` → `Ср.объём эр.`
- Inconsistent units — `10*12/L`, `*10*9/L`, `g/l`, `мкмоль/л` mixing Latin and
  Cyrillic and differing conventions
- 125 of 300 analytes carry no unit; these are left empty, not guessed

### Named ranges — the age/sex/phase engine

`LAB_MULTI_REF_V1` holds named ranges as JSON on `lab_panel_analytes.ref_ranges`.
The local column already exists. One entry:

```json
{ "label": "Фолликулярная фаза", "sex": "female",
  "age_min": null, "age_max": null,
  "low": null, "high": null, "text": "" }
```

`sex` is `male`, `female` or null. `age_min`/`age_max` are years. A range with
neither bounds nor text carries no information and is discarded by `normRefRanges`.

For hormone and cycle-dependent analytes the seed ships **labelled slots with empty
numbers** — the phases correctly named and sexed (Фолликулярная фаза, Овуляция,
Лютеиновая фаза, Менопауза; pregnancy trimesters; paediatric age bands where the
analyte warrants one), with `low` and `high` blank. The clinic types its own
numbers into a structure that is already right. No clinical values are shipped.

**Safety rule, carried verbatim from the server implementation:** a matched range
only marks the likely row on the printout. It must **never** auto-flag a result,
because the app cannot know cycle phase or pregnancy status. A hormone flagged
"high" against the wrong phase is a misleading report.

### Why labelled empty slots work — do not "fix" this

Two functions read `ref_ranges`, and they behave differently **on purpose**:

| Function | File | Label-only slot |
|---|---|---|
| `normRanges` | `lab-settings.js:179` | **kept** — parses, does not filter |
| `normRefRanges` | `laboratory.js:1385` | **discarded** — `.filter(x => x.low != null \|\| x.high != null \|\| x.text)` |

The result is exactly the behaviour wanted: an unfilled slot appears in the
settings editor as a named row with blank number boxes for the clinic to complete,
and stays invisible on the patient's report until real numbers exist. The label
input's own placeholder is `Менопауза`, confirming the intent.

This reads like an inconsistency between two copies of the same logic. It is not.
Unifying them breaks the feature in one direction or the other: filter in settings
and the seeded phases vanish before anyone can fill them; stop filtering in the
report and empty phase labels print on patient results.

## Schema changes — migration `040`

Six columns across three tables, all present on the server and absent locally.
Local convention: integer user ids, timestamps as ISO text via
`strftime('%Y-%m-%dT%H:%M:%SZ','now')`.

| Table | Column | Type | Purpose |
|---|---|---|---|
| `visit_services` | `sample_collected_at` | `TEXT` | set by the Collect step |
| `visit_services` | `verified_by` | `INTEGER REFERENCES users(id)` | who signed the result off |
| `visit_services` | `verified_at` | `TEXT` | when it was signed off |
| `services` | `tube_color` | `TEXT` | drives the tube-colour pill |
| `lab_results` | `ref_low`, `ref_high` | `REAL` | numeric ranges; local stores only text `reference_range` |

`visit_services.priority` is **not** included — it does not exist on the server
either. The queue's priority pill is computed in the front end.

`services.tube_color` exists on the server but is populated on zero rows, so the
tube pill is coded and unused in practice. It is added because the ported code
reads it, not because it carries data.

## Registry changes — `server/db/schema-registry.js`

Adding a column to SQLite is not enough; the allow-list gates every read and write.

- `visit_services.read.columns` += `sample_collected_at`, `verified_by`, `verified_at`
- `visit_services.write.update.columns` += the same three (role `lab` is already permitted to update)
- `services` embed on `visit_services` += `tube_color`
- `services.read.columns` and the write lists += `tube_color`
- `lab_results.read.columns` and write lists += `ref_low`, `ref_high`

## Phases

Each phase ends at a gate. No phase begins until the previous gate is green — the
house rule for this build machine.

| # | Phase | Gate |
|---|---|---|
| 1 | **Orient** — install, start, log in; confirm 39 migrations and 82 tables | app serves `/admin`; login succeeds |
| 2 | **Schema** — migration `040` and the registry edits, with tests beside them | `npm test` green |
| 3 | **Port the handling code** — replace `laboratory.js`; diff-and-merge `lab-settings.js` and `lab-barcode.js` | lab screen renders without console errors |
| 4 | **Panels and settings** — verify the settings screen against the local API; confirm service↔panel linkage; seed the catalogue with ranges stripped | a panel can be created, linked to a service, and edited; catalogue loads; change list reviewed |
| 5 | **Wire the workflow** — all six transitions, barcode, verify, document archive | every transition clicks through; document reaches the patient card |
| 6 | **Across the app** — registration → cashier → queue → results → patient card → documents | one test patient completes the full journey |
| 7 | **Devices and OS** — responsive lab screens; verified start on macOS and Linux | lab usable at tablet and phone widths; app starts on all three OSes |

Phases 1–6 are the handling system. Phase 7 covers the other two requirements, and
comes last because there is nothing to make responsive or portable until the lab
exists.

Phase 4 sits before the workflow phase deliberately: results entry renders rows
from a panel, so the workflow cannot be exercised end-to-end until panels exist.

### Notes per phase

**Phase 3** — the server code carries multi-tenant remnants (`currentClinicId`,
`company_id` filters). The shim's `TENANCY_NOOP_V1` already neutralises those, so
they should be left alone unless they actually break; stripping them by hand
invites transcription errors across 1,800 lines.

The three files need **different treatment, and the direction is not uniform**.
`laboratory.js` is a straight replacement — the server's is 5× larger and the local
one has no lab logic worth keeping. But `lab-settings.js` (local 34,608 B vs server
34,270 B) and `lab-barcode.js` (local 5,740 B vs server 5,662 B) are **larger
locally than on the server**, meaning local carries work the server does not.
Copying the server's version over them would be a regression. Diff each and merge
deliberately; do not overwrite.

**Phase 4** — the catalogue is exported from the server with `sbq.py`, which is
already permitted in this repo's `.claude/settings.local.json` and needs no new
access. The export query must select the structural columns explicitly; a
`select *` would carry the range columns straight through the exclusion.

**Phase 7, OS portability** — smaller than it sounds. There are no `.bat`, `.cmd`
or `.exe` artifacts, `server/` uses `path.join` throughout with zero hardcoded
Windows paths, and `better-sqlite3` ships prebuilt binaries for darwin-x64,
darwin-arm64, linux-x64, linux-arm64, linuxmusl and win32. This is verification
and documentation, not a rewrite. `SETUP.md` needs updating — it currently assumes
a Windows server PC.

**Phase 7, devices** — a foundation exists: `admin-views.css` has 32 media queries
and `admin.css` has 6. The work is extending that to the lab screens, and checking
touch targets on the queue and results modal.

## Testing

The repo is test-driven — nearly every module has a `.test.js` beside it, and
`npm test` runs `node --test` with no path argument (the directory-argument form
breaks on Windows with Node 24). New work follows the same pattern:

- Migration `040` gets `040.test.js`, matching the existing migration tests
- Registry changes get assertions that the new columns are readable and writable by role `lab`, and rejected for roles that should not have them
- The state machine gets tests for each transition, including the illegal ones
- The seed gets a test asserting **no range field is populated** on any seeded
  analyte — the one guarantee that must not silently regress
- The two range readers get tests pinning their **deliberately different**
  behaviour on a label-only slot: `normRanges` (settings) preserves it,
  `normRefRanges` (report) discards it. See the note below — this looks like an
  inconsistency and must not be "fixed"
- Phase 6 is a manual end-to-end walkthrough; phases 2–5 are automated

## Risks

| Risk | Mitigation |
|---|---|
| The 1,800-line port hides behaviour that silently depends on Postgres semantics the SQLite compiler does not reproduce | Port whole, then exercise every transition in Phase 4 rather than trusting a clean render |
| `lab_results` shape differs — server has numeric `ref_low`/`ref_high`, local has text `reference_range` | Migration `040` adds both; ported code reads what it expects |
| Uncommitted work on the dev box (29 modified files at time of writing, no git remote) could be lost or could conflict with the port | Commit and push before starting; see below |
| Status vocabulary drift — `collected` and `resulted` are new locally | Explicit tests for the two new values |

## Precondition

Before any of this begins: the local repo is on branch `phase15-employees` with
**29 modified files uncommitted and no git remote configured**. The LAN dev box
serves that working tree live, so the only copy of that work is on one machine.
Commit it and add a remote before the port starts, or a bad merge during Phase 3
destroys work that exists nowhere else.

## Related

- [[easymed-uz-dev-box]] — the three EasyMed trees and how to tell them apart
- [[easymed-live-vs-local]] — the server, its Supabase project, and the read-only tooling
- [[node-test-windows-invocation]] — why `npm test` uses bare `node --test`
