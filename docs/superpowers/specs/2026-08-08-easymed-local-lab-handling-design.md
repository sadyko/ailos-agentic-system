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
- Working end-to-end across registration → cashier → queue → results → patient card
- Running on Windows, macOS and Linux
- Usable on the clinic's tablets and phones over the LAN

**Out of scope**

- Importing the production panel catalogue. The server has 78 panels / 300
  analytes, with heavy duplication (three different complete-blood-counts at 28, 21
  and 14 analytes). Clinics build their own catalogue through `lab-settings.js`.
  The handout seeds **one CBC fixture** purely so the workflow has something to
  click through.
- Any change to the server. It is a read-only reference throughout.
- Syncing data between server and local. They are separate products.

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
| 4 | **Wire the workflow** — all six transitions, barcode, verify, document archive | every transition clicks through; document reaches the patient card |
| 5 | **Across the app** — registration → cashier → queue → results → patient card → documents | one test patient completes the full journey |
| 6 | **Devices and OS** — responsive lab screens; verified start on macOS and Linux | lab usable at tablet and phone widths; app starts on all three OSes |

Phases 1–5 are the handling system. Phase 6 covers the other two requirements, and
comes last because there is nothing to make responsive or portable until the lab
exists.

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

**Phase 6, OS portability** — smaller than it sounds. There are no `.bat`, `.cmd`
or `.exe` artifacts, `server/` uses `path.join` throughout with zero hardcoded
Windows paths, and `better-sqlite3` ships prebuilt binaries for darwin-x64,
darwin-arm64, linux-x64, linux-arm64, linuxmusl and win32. This is verification
and documentation, not a rewrite. `SETUP.md` needs updating — it currently assumes
a Windows server PC.

**Phase 6, devices** — a foundation exists: `admin-views.css` has 32 media queries
and `admin.css` has 6. The work is extending that to the lab screens, and checking
touch targets on the queue and results modal.

## Testing

The repo is test-driven — nearly every module has a `.test.js` beside it, and
`npm test` runs `node --test` with no path argument (the directory-argument form
breaks on Windows with Node 24). New work follows the same pattern:

- Migration `040` gets `040.test.js`, matching the existing migration tests
- Registry changes get assertions that the new columns are readable and writable by role `lab`, and rejected for roles that should not have them
- The state machine gets tests for each transition, including the illegal ones
- Phase 5 is a manual end-to-end walkthrough; phases 2–4 are automated

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
