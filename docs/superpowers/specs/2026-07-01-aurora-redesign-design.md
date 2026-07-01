# Aurora Redesign — Design Spec

- **Date:** 2026-07-01
- **Status:** Approved for implementation planning
- **Target project:** `C:\Users\user\Desktop\aurora redesign by me` (new, standalone, deployable)
- **Source prototype:** `C:\Users\user\Desktop\aurora las` (read-only reference)
- **Design system:** the shadcn-native library in this repo, `target/ui` (branch `build/shadcn-native`) — 36 components as of commit `77fdfb3`.

---

## 1. Goal & why

Turn the **Aurora+ MIS design prototype** into a **real, buildable, deployable React application** that:
1. **Reuses the prototype's screens + logic** (the "functions"): queue/worklist behaviour, consultation flow, registration, inpatient workflows, cashier calculations, commerce — keeping structure, behaviour, and sample data.
2. **Redesigns the look** by rebuilding every screen's visuals on the project's **shadcn-native design system** (fresh professional direction), replacing the prototype's 580 KB hand-written CSS and bespoke widgets.
3. **Deploys** as static files to any web host, with a data seam so a real backend (Odoo / API) plugs in later.

The prototype today is React-via-Babel-in-browser (needs internet, no build, `window.*` global wiring, hardcoded Russian mock data, no backend). This project makes it a genuine app.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Scope | **All 5 modules** (Doctor, Registration, Inpatient, Cashier, Commerce) |
| Look | **Fresh professional direction**, sourced from the shadcn-native design system, **tuned to a medical palette** (per `40_DESIGN/THEMING.md` guardrails). Not the prototype's original CSS. |
| Reuse | Keep each screen's **structure/behaviour/data**; **re-skin** with design-system components. |
| Stack | **Vite + React + TypeScript + Tailwind v4** (same foundation as the design system) |
| Data | **Mock data now**, behind a thin data-layer seam; real backend (Odoo/API) is future work |
| Language | **Russian** UI (the product's market) — kept as-is |
| Deploy | **Static host** (e.g. Vercel/Netlify/any static server). `npm run build` → deployable `dist/`. Actual go-live is future. |
| Routing | Single app + client router; one route per module + sub-routes |
| Validation of look | **2–3 real sample screens approved by the owner** before rolling the palette across all modules |

## 3. Architecture

### 3.1 One app, one shell
A single SPA replaces the prototype's 5 standalone HTML files and their `window.*` cross-linking.

- **Shell:** app chrome (left nav / top workspace tabs, matching the prototype's `chrome.jsx` intent) rebuilt with design-system components.
- **Router (React Router):** clean URLs, refreshable/shareable, real back/forward:
  - `/doctor` (worklist) · `/doctor/consultation/:patientId`
  - `/registration` (patient base) · `/registration/patient/:id` · `/registration/visit/:id`
  - `/inpatient` (department home) · `/inpatient/ward` · `/inpatient/beds` · `/inpatient/or-board` · `/inpatient/card/:id` (+ vitals/orders/services/obstetrics tabs)
  - `/cashier` (session) · `/cashier/payment` · `/cashier/treasury` · `/cashier/control`
  - `/commerce` (+ referral/partners/sources/sales/marketing/reports sub-views)
  - `/login` (the prototype's auth placeholder, realized)

### 3.2 Built on the design system
Aurora is its **own shadcn-native app** that reuses the **vetted design system** from `target/ui`:
- **Bring the components over by copying the vetted set** — `src/components/ui/*`, `src/lib/utils.ts` (`cn`), and the `index.css` token structure — from `target/ui` into the Aurora project. This is self-contained (deploys independently), guarantees parity, and includes the local improvements already made (e.g. the `Slider` a11y fix).
- Keep the **same shadcn config** (`components.json` + `@/*` alias + `cn` at `@/lib/utils`) so additional components can still be pulled with `shadcn add` later.
- **Apply Aurora's own medical tokens** to the CSS variables (§4). Per `THEMING.md`, shadcn is the source of component *code*; the *look* is the project's tokens — Aurora keeps the components and supplies its own medical palette.

### 3.3 Reuse strategy (per screen)
For each prototype screen (`_handout/src/*.jsx`):
1. **Keep** the component's structure, state logic, event flow, and its sample data.
2. **Port** JSX from Babel-in-browser globals → TypeScript ES modules with real imports.
3. **Re-skin:** replace prototype CSS classes + bespoke widgets with design-system components:

| Prototype widget | Design-system replacement |
|---|---|
| custom `Dropdown` | `Select` / `DropdownMenu` |
| `DayPicker` / `reg-calendar` | `Calendar` + `Popover` |
| `.seg` segmented controls, view switch | `ToggleGroup` / `Tabs` |
| data tables (`.tbl`) | `Table` (+ `Pagination`) |
| modals (`.cn-modal`) | `Dialog` |
| right-zone / slide-overs | `Sheet` |
| expandable sections (`reg-detail`) | `Accordion` / `Collapsible` |
| status pills | `Badge` |
| avatars (`avColor`/`initials`) | `Avatar` |
| toasts/inline notices | `Sonner` / `Alert` |
| NEWS/vitals bars | `Progress` |
| phone input (flag emojis) | rebuilt on `Input`/`InputGroup`, **no emojis** |
| icon set (`icons.jsx`) | `lucide-react` |

Utility functions worth reusing directly (port as typed helpers): `capWords`, `moneyFmt`/`rfmt`, `avColor`, `initials`, Russian pluralization (`plPat`), date formatting.

### 3.4 Data layer (the backend seam)
- `src/data/` — typed modules holding the ported Russian sample data (`patients`, `regPatients`, `services`, `cashRegisters`, `payments`, inpatient data, etc.).
- `src/services/` — a thin async access layer (e.g. `getQueue(day)`, `getPatient(id)`, `listPayments()`), returning the mock data today. Screens consume this layer, **not** the raw data.
- **Swap-to-backend later** = reimplement `src/services/` against Odoo (JSON-RPC) or a REST API. Screens and components are untouched.

## 4. The look (medical tuning)
- Start from the design system's tokens; **tune a calm clinical palette** (soft trustworthy blues/greens, high legibility, generous whitespace) mapped into the shadcn CSS variables (`--primary`, `--background`, `--card`, `--border`, `--radius`, …). No harsh black/white, no default gray, **no dark mode** unless requested.
- **No emojis anywhere**; lucide icons only; crisp, professional density suitable for clinical data.
- **Owner validation gate:** the doctor's queue, a consultation, and a patient card are built first; the owner reviews them in the browser and approves the palette/direction before rollout.

## 5. Build order (all 5 modules in scope)
1. **Foundation** — scaffold Vite+React+TS+Tailwind in the target folder; install/theme the design system with Aurora's medical tokens; build the shell (nav/tabs) + router; establish `src/data` + `src/services` seam; a deployable "hello shell" skeleton.
2. **Doctor's workplace** — worklist, consultation, dashboard, doc/lab print. *(Contains the sample screens for the palette gate.)*
3. **Registration** — patient base, patient card, visit/services, invoice, calendar, coverage.
4. **Inpatient** — home, ward, beds, OR board/checklist, card (vitals/orders/services), obstetrics, discharge act.
5. **Cashier** — session, payment, treasury, control.
6. **Commerce** — referral, partners, sources, sales, marketing, reports.

Each module lands on the same shell + design system; the app is hostable after step 1 and grows module by module.

## 6. Success criteria
1. New project builds (`npm run build`) to static `dist/`; runs with `npm run dev`.
2. All 5 modules reachable via routes on one shell; no `window.*` global wiring or Babel-in-browser; no internet needed to run.
3. Every screen rebuilt on design-system components with Aurora's medical tokens (no prototype CSS, no emojis).
4. Sample data served through `src/services/`; no component reads raw data directly.
5. Owner approved the palette on the 2–3 sample screens before full rollout.
6. TypeScript clean; a basic gate (typecheck + smoke tests on key screens/logic) is green.
7. Deployable to a static host with a documented build/deploy step.

## 7. Deferred (YAGNI)
Real backend / Odoo integration; auth/permissions beyond a login screen; i18n framework (Russian stays inline); real print/PDF pipeline beyond the browser print the prototype uses; the design-system long-tail components not needed by Aurora; dark mode; automated visual-regression testing.

## 8. Assumptions
Russian UI kept; medical-tuned palette (not placeholder blue); mock data now with a service seam; static hosting; the prototype at `aurora las` is the visual/behavioural reference and is not modified.

## 9. Implementation-planning note (decomposition)
All 5 modules is too much for one implementation plan. Decompose:
- **Plan 1 — Foundation + Doctor's workplace** (through the owner palette-approval gate). Delivers the scaffold, copied+themed design system, shell/router, data seam, and the first module + sample screens. This is the plan we write next.
- **Plans 2–5** — one per remaining module (Registration, Inpatient, Cashier, Commerce), each landing on the finished foundation. Written after Plan 1 lands and the palette is approved.

Each plan is spec → plan → build with its own gate; this spec is the shared design of record for all of them.
