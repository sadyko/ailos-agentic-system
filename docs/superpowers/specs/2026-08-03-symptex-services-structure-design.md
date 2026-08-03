# Symptex — «Услуги» section structure (design spec)

**Status:** APPROVED (owner, 2026-08-03) — proceeding to implementation plan (`writing-plans`).
**Scope:** Symptex public site only (`/var/www/symptex-next`, Flask). No EasyMed code changes in this spec.
**Owner is non-technical** — this document is the agreed design; the implementation plan follows separately.

---

## 1. Goal

Rebuild Symptex's service-discovery so a patient can **find a specific medical service, compare clinic
prices, and book — in as few steps as possible**, and so **every catalog page ranks in Google on its own
keywords**. Content comes from the new **v5 catalog** (owner fills the Excel and loads it; medcore's current
service content is being replaced).

One-line success test: a patient who Googles "ТТГ анализ Ташкент цена" lands on a Symptex page that already
answers "where, how much, book" — replacing ~50 min + ~40 cognitive steps of phoning clinics (see §11).

---

## 2. Context & hard constraints

- **Symptex is a read-only consumer of the EasyMed CORE gateway** (`app/services/core_gateway.py`). It never
  writes to medcore. Catalog structure/names come from gateway `/catalog/*`; live data (prices, clinics,
  availability) comes from other gateway endpoints.
- **The v5 catalog changes the hierarchy.** Current medcore is Group → **Type → Category** → Service; v5 is
  Group → **Category → Type** → Service (the middle two levels swap). All new pages/URLs use the v5 order.
- **The catalog is shared with live EasyMed clinics.** Populating/replacing it is the **owner's task** (fill
  Excel → load), explicitly **out of scope** for this build. This spec assumes the v5 taxonomy is available.
- **Existing editorial layer to build on:** Symptex already keeps a local `service_categories` table (its own
  Supabase, `sb()`) with what/when/how/preparation content (≈138 rows). The v5 extends this pattern.
- **Bilingual RU/UZ** throughout; RU is primary. Existing i18n via `lang_url()` / `_lang()`.
- **Reuse, don't reinvent:** the header already has a hover-dropdown (`.nav-more`) and a mobile drawer; the
  services routes already exist in `app/blueprints/public/__init__.py` and render `public/services.html` via a
  `level` param. This is a restructure of what exists, not a greenfield.

## 3. The v5 taxonomy (data we design against)

Excel sheets: **Groups, Categories, Types, Services, Specialties, Filters.** Every level carries
`slug, name_ru/uz/en, meta_title_*, meta_description_*, keywords_*, faq_*` (Categories/Types also `is_popular`).

- **Groups (5):** consultations, diagnostics, laboratory, procedures, surgery.
- **Categories** → belong to a group. **Types** → belong to a category. **Services** → belong to a type
  (with `description_*`, `preparation_*`).
- **Specialties (≈50):** used by the consultations group (a specialty resolves to real doctors, not catalog
  types) — same source as the `/doctors` filter.
- **Filters sheet** defines each group's filters + `indexable` flag + landing copy.

## 4. Two distinct surfaces (do not merge)

1. **`/услуги` — the interactive hub.** One page, 5 tabs (the groups). Per tab: title, description, search,
   filters, results list. Filters refine in place via query params. This is the browse/search tool. **Canonical.**
2. **Dedicated SEO pages** — group, category, type, service (and specialty landings for consultations). Server-
   rendered, keyword-rich from v5 meta/keywords/FAQ. These are what Google indexes and what patients land on.

The hub's tab header links **"смотреть все →"** to the group's SEO page. No duplicated indexable content: the
hub is `canonical`/refinement; the dedicated pages own the keywords.

## 5. URL architecture

New order (Group → Category → Type → Service). Slugs are **short Latin** (decision 1); all RU/UZ keywords live
in title/H1/meta/body/keywords, which is what ranks.

| URL | Page | Indexable |
|---|---|---|
| `/services` | Hub (5 tabs) | yes (canonical hub) |
| `/services/<group>` | Group landing | **yes (SEO)** |
| `/services/<group>/<category>` | Category landing | **yes (SEO)** |
| `/services/<group>/<category>/<type>` | Type landing | **yes (SEO)** |
| `/services/<group>/<category>/<type>/<service>` | Service detail | **yes (SEO)** |
| `/services/consultations/<specialty>` | Specialty landing → doctors | **yes (SEO)** |
| `/services/<group>?city=…&district=…&patient=…&date=…&page=N` | Refined hub view | **noindex** (canonical → clean URL) |

- **Indexable** (from Filters sheet): specialty (consultations); category + type (diagnostics/lab/procedures);
  direction=category (surgery). These become URL segments.
- **Non-indexable refinements:** city, district, patient (adult/children), date, page → **query params, noindex**,
  `rel=canonical` back to the clean page, so Google isn't flooded with thin duplicates.
- Surgery is 2 levels for now: direction (category) → services (decision 4); structure allows adding types later.
- **Redirects:** old `/services/<group>/<type>/<category>` URLs 301 → new order where a mapping exists.

## 6. Page contents

**Hub `/services` (per active tab):** H1 (group title), description, search box (name/synonym/abbr), filter row,
paginated results (service cards). Consultations tab filters = **specialty (idx), patient (adult/children), city,
district, date**; diagnostics/lab/procedures = **category (idx), type (idx), city, district, date**; surgery =
**direction (idx), city, district, date**.

**Group / Category / Type landing:** breadcrumb, H1 with keyword, description (from v5), chips of child
categories/types (for drill-down), **paginated** service list, FAQ block (from v5 `faq_*` → FAQPage schema),
sibling links. Each service row shows **price-from + "N clinics"**.

**Service detail:** H1 (service name + synonyms), description + preparation (from v5), **"Где сдать" — clinics
offering it, cheapest/nearest first, with price and one-tap Book**, `Service`/`AggregateOffer` schema, related
services. This page is the value-chain conversion moment (§11).

**Specialty landing (consultations):** H1, description, list of matching doctors (via existing `/doctors?spec=`),
book flow. Reuses the existing doctors pipeline.

## 7. Header mega-menu

- **Desktop:** hover on "Услуги" opens a mega-menu — 5 group columns, each with a colored dot, a few popular
  categories (`is_popular`), and "Все … →" to the group page. Reuses the `.nav-more`/`.nav-drop` mechanism +
  hover intent already in the header; add keyboard focus + `aria-expanded` for accessibility.
- **Mobile:** in the existing drawer, "Услуги" becomes an expandable accordion revealing the 5 groups (each →
  its group page). Bottom-nav unchanged.

## 8. Filters, pagination, performance

- **Filters** driven by the Filters sheet (`source`: attribute | specialty | category | type | city | district).
  Indexable ones can be a URL segment *or* an in-hub selector; non-indexable ones are query params only.
- **Pagination (required, owner):** every service/results list is paginated server-side (e.g. 24/page) with
  `?page=N`, real `<a>` prev/next links (crawlable, not infinite scroll), and `rel=canonical` to page 1 stays on
  the clean page; paged URLs are `noindex,follow` (or self-canonical) to avoid thin duplicates. Keeps first paint
  fast even for categories with hundreds of services.
- **Caching:** catalog reads cached (existing gateway cache is 30 min); SEO pages render from the local v5 mirror
  (§9) so page structure never waits on a cold gateway. Live price/clinic data cached briefly.

## 9. Where the v5 SEO content lives (decision 5 — CONFIRMED)

**Medcore is the single source of truth.** The owner rewrites medcore's service content to v5 so **EasyMed
renders it too**. **Symptex holds its own copy synced from medcore** — a local mirror of the v5 taxonomy in
Symptex's Supabase (extending today's local `service_categories` pattern to groups/categories/types/services +
their meta/keywords/faq). Rationale: SEO pages must render fast, server-side, without waiting on the gateway's
cold-start; the gateway remains the source for **live** data (prices via `pricing`, clinics via
`clinics_for_service`, availability, doctors) keyed by v5 service IDs.

**Sync path:** medcore (v5) → Symptex local mirror. Preferred source is the gateway `/catalog/*` once it serves
the v5 shape (§13); a direct import of the same v5 export is the fallback so Symptex is not blocked on gateway
timing. The mirror-refresh mechanism is specified in the implementation plan, not here.

## 10. Resolved decisions

1. **Slugs:** short Latin in the path; all RU/UZ keywords in title/H1/meta/body/keywords.
2. **Hub ↔ group pages:** hub is the interactive canonical browser; dedicated group/category/type/service pages
   own the SEO keywords; tab "смотреть все" links to them.
3. **Service click:** opens the **service detail** page (description + preparation + "где сдать" price
   comparison + book), not a direct booking form.
4. **Surgery depth:** 2 levels (direction → services) for now; extensible to types.
5. **SEO content storage (CONFIRMED):** medcore is source of truth (owner rewrites it to v5, serving EasyMed
   too); Symptex holds its own copy synced from medcore for fast SSR; live data (prices/clinics) from the gateway.
6. **Pagination:** server-side, crawlable prev/next, on every list.

## 11. Value-chain requirements (must-haves, from the inspection)

The patient's weak link is Evaluate → Choose → Purchase (~50 min + ~40 EIPs of phoning clinics). The build must
collapse it:

1. **Price-from + "N clinics" is the hero element** on every service — in lists and on the service page.
2. **"Где сдать" clinic comparison** (cheapest/nearest first, one-tap book) is prominent — it's the conversion.
3. **Search resolves synonyms/abbreviations** (ТТГ = тиреотропный = TSH) via v5 `keywords`.
4. **SEO landings are the win**: arriving from Google onto the answer page deletes the evaluate steps.
5. **Low-EIP booking** from a service (phone + confirm; mind the known OTP friction).
6. **City/district = "near me"** — easy to set, noindex.

Future couplings (not now): results delivery (chain step 12), re-need reminders (step 13).

## 12. Out of scope (this build — owner-owned)

- Rewriting/replacing the medcore catalog content to v5 (owner's task via Excel v5), including making it
  **render to EasyMed** too.
- EasyMed gateway/SPA changes so `/catalog/*` serves the new v5 hierarchy (owner's medcore rewrite covers the
  EasyMed side; Symptex's sync consumes the result — see §13).
- Results delivery / re-need reminders.

## 13. Open questions / risks (to resolve before/with the plan)

- **Gateway serves v5 or Symptex imports directly:** the EasyMed gateway currently returns the *old* hierarchy.
  The owner's medcore rewrite should make `/catalog/*` return the v5 order; Symptex syncs its mirror from that.
  **Fallback:** if the gateway isn't updated in time, Symptex seeds its mirror from the same v5 export so it is
  not blocked. The plan must handle both and not couple Symptex's launch to the gateway update timing.
- **Service→clinic price mapping** (`pricing.catalog_min_prices`, `clinics_for_service`) must key off the v5
  service IDs once the catalog is reloaded — verify the join survives the ID change.
- **Old-URL redirects:** need the old→new slug map to write 301s.

## 14. Verification (how we'll know it works)

- Every SEO page renders server-side with correct H1/title/meta/keywords/FAQ from v5, in RU and UZ.
- Hub tabs + filters produce correct paginated results; refinements are noindex + canonical.
- A service page lists offering clinics with price-from, cheapest-first, and books in ≤ a few taps.
- Mega-menu works on hover + keyboard (desktop) and as an accordion (mobile); no layout break on small screens.
- Lighthouse/PSI: fast first paint on a large category (pagination working); valid FAQ/Service schema.
- No EasyMed regression (Symptex-only change; gateway contract unchanged unless §13 says otherwise).
