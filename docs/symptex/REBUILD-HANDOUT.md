# Symptex — Rebuild Handout

> **Purpose.** Brief a fresh chat completely. Read this and you need nothing from the conversation
> that produced it. Written 2026-08-01. Owner is non-technical — explain results in plain English,
> never require them to read or write code.
>
> **Everything below marked VERIFIED was checked directly on that date. Everything marked UNVERIFIED
> is a claim nobody has tested. Do not promote the second kind into the first.**

---

## 1. What we are building

Symptex (symptex.uz) is a live consumer healthcare platform in Uzbekistan, built on Next.js at
`/var/www/symptex-next` (port 8011) on server 45.77.242.169. Sister product **EasyMed** is clinic
practice-management software already deployed in clinics.

**Phase 1 — capture lab analyses.** A patient searching a specific analysis («ТТГ», «глюкоза»,
«общий анализ крови») lands on a page for that test and is routed to where they can get it, what it
costs, and how to prepare. **We are here now.**

**Phase 2 — doctors and clinics**, as contact listings only. Name, specialty, address, phone, hours.
No booking.

**The long-term vision** is a customer-centric aggregator where symptom, disease, drug and analysis
entry points all route a patient toward care. Phase 1 deliberately builds **only the analysis entry
point** — the narrowest slice that can be proven.

---

## 2. Where things actually stand

### Supply is nearly empty — VERIFIED

| | Symptex | clinics.uz | med24.uz |
|---|---|---|---|
| Clinics | **1** (INCARE LAB) | 407 | 230 claimed |
| Doctors | **12** | — | 1,000 claimed |
| Labs | 0 signed | — | 200+ claimed |

Confirmed three ways: the `/clinics` header reads «1 проверенных клиник», `/doctors` reads
«12 проверенных специалистов», and Google's index of symptex.uz contains exactly one clinic page.

**Consequence: driving paid traffic now would burn money.** A patient arriving to an empty catalog
does not return. Supply is the constraint, not awareness.

### The content library is built and switched off — VERIFIED

`symptex-analyses-plan/analyses_plan.csv` in the ailos repo holds **3,613 analyses across 57
categories** — allergen panels (270), specific IgE (323), other infections (170), urine (107),
bacteriology (79), sputum (78), and 51 more categories. Every row is `status=unpublished`.

This is the single largest unused asset in the project.

*(Note for anyone with older context: earlier notes said "423 analyses". That is stale. The number
is 3,613.)*

### The service tree exists and renders — but is invisible to Google — VERIFIED

```
/services                        5 categories, counters only
/services/laboratory             «Лаборатория 15 типов»                    SSR ✓
/services/laboratory/hormones    6 subcategories, «9 услуг» each           SSR ✓
/services/laboratory/hormones/…  individual tests
```

Category counters: Консультации 50 типов · Диагностика 5 типов / 314 услуг · **Лаборатория 15 типов
/ 374 услуг** · Процедуры 9 типов / 137 услуг · Хирургия 19 типов / 404 услуг. About 1,279 services.

**Google has indexed none of `/services/*`.** What it has indexed is the blog namespace: drug pages
(`/blog/amlodipine`, `/blog/tramadol`, `/blog/pentoxyfylline`…), one specialty page
(`/blog/travmatolog`), and one clinic page.

**The pattern:** pages with real prose rank. Pages that are link directories with counters, buried
four clicks deep with nothing linking into them, do not.

**So "add category pages so we don't miss SEO traffic" would not work.** The pages exist. Adding
more thin pages adds more thin pages. The gap is content and internal linking, not routes.

### The competitive picture — VERIFIED except where noted

- **clinics.uz** — 407 clinics listed for blood tests. **Every price reads «цена по звонку».** No
  booking, phone numbers only. Ratings and review counts present. *This may be 407 refusals to
  publish prices rather than an empty niche — nobody has established which.*
- **gemotest.uz** — ОАК без лейкоцитарной формулы **29,000 UZS + 11,000 collection**, 1-day
  turnaround, working cart, home collection, fasting instructions.
- **lab-net.uz** — ОАК 25 параметров **75,000 UZS**, cart, home call.
- **These two prices are NOT comparable** — different panels. The apparent 87% gap may be entirely
  an artefact of naming. This matters enormously; see the gate in §5.
- **med24.uz** — claims 230 clinics, 200+ labs, prices, reviews, online booking. **UNVERIFIED —
  HTTP 503 twice from outside Uzbekistan.** If real, it occupies our exact wedge.
- Tashkent lab networks: SWISS LAB, TTD, LABNET, HAEMALAB, MEDIK-AS, VITROS, Intermed, Genex,
  AKFA Medline, Gemotest.

---

## 3. The customer value chain — and where we insert

Method: Thales Teixeira, *Unlocking the Customer Value Chain*. Customers pay in three currencies —
**money, time, effort**. Effort is measured in **EIPs** (elementary information processes — cognitive
steps). Waiting three days is a *time* cost with zero EIPs; never merge the two.

Segment: **a person in Tashkent who needs a specific lab analysis** — either holding a printed
referral slip, or self-directed after searching a test name.

| # | Stage | Activity | UZS | Time | EIPs | Value | Charged | Bond |
|---|---|---|---|---|---|---|---|---|
| 1 | trigger | doctor hands over a slip listing 4–6 analyses | 0 | 1m | 1 | creates | no | strong |
| 2 | trigger | reads it, does not recognise the abbreviations | 0 | 2m | 3 | erodes | no | weak |
| 3 | evaluate | asks the doctor/reception where to go | 0 | 2m | 2 | creates | no | **weak** |
| 4 | evaluate | photographs the slip, sends it to a relative | 0 | 3m | 3 | erodes | no | weak |
| 5 | evaluate | **searches one test name on their phone** | 0 | 3m | 3 | creates | no | **weak** |
| 6 | evaluate | opens 2–3 lab sites | 0 | 5m | 4 | erodes | no | weak |
| 7 | evaluate | matches slip names to each lab's catalogue names | 0 | 10m | 5 | erodes | no | **weak** |
| 8 | evaluate | adds up the basket price at each lab | 0 | 8m | 5 | erodes | no | **weak** |
| 9 | evaluate | checks fasting/prep rules | 0 | 5m | 4 | creates | no | weak |
| 10 | evaluate | checks locations and hours | 0 | 5m | 4 | erodes | no | weak |
| 11 | choose | picks a lab — usually the clinic's own | 0 | 2m | 2 | creates | no | strong |
| 12 | choose | picks a morning (fasting forces it) | 0 | 2m | 2 | erodes | no | strong |
| 13 | purchase | travels to the lab | ~10,000 | 25m | 1 | erodes | no | strong |
| 14 | purchase | queues at reception | 0 | 20m | 0 | erodes | no | strong |
| 15 | purchase | hands over the slip; receptionist re-keys it | 0 | 5m | 3 | erodes | no | strong |
| 16 | purchase | pays at the counter | 29–75,000 | 3m | 2 | erodes | **YES** | strong |
| 17 | purchase | gives blood | 11,000 | 5m | 0 | erodes | **YES** | strong |
| 18 | consume | waits for results | 0 | 1–3 days | 0 | erodes | no | **weak** |
| 19 | consume | collects results | 0 | 2–20m | 2 | creates | no | weak |
| 20 | consume | reads them, does not understand the ranges | 0 | 10m | 5 | erodes | no | **weak** |
| 21 | consume | takes them back to the doctor to interpret | fee `?` | 40m+ | 2 | creates | **YES** | strong |
| 22 | consume | learns what is wrong and what to do | 0 | 10m | 3 | **creates** | **YES** | strong |
| 23 | re-need | doctor orders a control repeat | 0 | 1m | 1 | creates | no | loops |
| 24 | re-need | needs the same panel next year | 0 | — | 1 | erodes | no | loops |

### Where the money and the value sit

| | **Charged for** | **Not charged** |
|---|---|---|
| **Creates value** | 21, 22 — interpreting the result. **The only paid value in the chain.** | 3, 5, 9, 11, 19, 23 |
| **Erodes value** | 16, 17 | 2, 4, 6, 7, 8, 10, 12, 13, 14, 15, 18, 20, 24 |

### The insertion point — this is the whole architectural argument

**Activity 5 is "searches one test name on their phone."** That search *is* the analysis page.

Publishing analysis pages puts Symptex physically inside activity 5 — the first activity in the
weak-link cluster 5→8, which is the largest effort concentration in the chain (23 minutes, 14 EIPs,
all weakly bonded, nobody charging for it).

That is why phase 1 is analysis pages and not something else. We are not choosing a marketing
channel; we are occupying a specific activity the patient already performs.

### Ranked weak links

1. **5→8** — search, open lab sites, match names, sum baskets. Where phase 1 inserts.
2. **3→5** — where the clinic's captive-lab default breaks.
3. **20→21/22** — not understanding results. **Highest value in the chain** — adjacent to the only
   paid activities. Recorded as the strongest fallback if phase 1's gate fails. Needs a
   medical-liability answer before anyone touches it.

---

## 4. Decisions already made — do not re-litigate these

| Decision | Choice | Why |
|---|---|---|
| Phase order | Lab analyses first; doctors/clinics second | Supply for labs is ~6 networks (a week of meetings). Supply for a clinic marketplace is ~400 (a year of field sales). |
| What the product does | **Price the basket, then hand off** — address, hours, prep, phone/Telegram | Works even if labs turn out to be walk-in only. Does not bet on bookable capacity. |
| Who pays | **Labs**, not clinics | Charging clinics to route patients to a competitor's lab asks them to fund their own revenue loss. Labs paying for volume aligns incentives. |
| The content bridge | **Analysis pages only** in phase 1 | Highest intent, one hop, and the 3,613 unpublished analyses already serve it. Drug/disease/symptom pages stay untouched until this works. |
| Phase 2 doctors/clinics | Contact listings only, no booking | Honest at 12 doctors. Makes the pages real SEO surfaces without promising availability. |
| Partners page pricing | Price stays off the page | Owner's call. Consequence: proof has to carry the decision instead, and there is currently no proof to show. |
| Traffic spend | **Not yet** | 1 clinic, 0 labs. Paid traffic into an empty catalog is money burned. |

---

## 5. THE GATE — do not build price comparison until these clear

Three tests, unrun. Full field kit with scripts and thresholds:
`docs/gtm/2026-08-01-symptex-lab-tests-fieldkit.md`

| # | Test | Stop number |
|---|---|---|
| 1 | Will a lab publish prices to a comparison platform? Ask 3 commercial directors. | **0 of 3 agree → stop.** No feed, no product. |
| 2 | Is there a real spread on *identical* tests? Price глюкоза, ТТГ, холестерин, креатинин at 5 labs, same day, collection fees recorded separately. | **Spread under 15% → stop.** A basket is 50–150k; travel is ~10k. Below 15% the saving is eaten by the trip. |
| 3 | Does med24.uz already price baskets across labs? Open on a **local phone**. | **Real prices at 3+ labs AND basket pricing → stop and rethink.** |

**What is NOT gated:** publishing analysis content, fixing internal linking, and building the
analysis page template. Those are worth doing whatever the tests say, because they occupy activity 5
regardless of whether we can show comparative prices.

**What IS gated:** the price-comparison feature itself, lab onboarding, and any spend.

A prior full value-chain run returned **NO** on an earlier framing (clinic pays, booking-based) —
see `docs/gtm/2026-08-01-symptex-lab-referral.md`. The current framing is different enough to
deserve its own verdict, but it has not earned a GO either. **Treat it as untested, not as approved.**

---

## 6. Architecture

### What exists and works
- Next.js app, SSR functioning on the service tree
- Patient catalog (~1,279 services, RU/UZ), clinic/doctor/registrator panels, real-time scheduling
  calendar, verified reviews tied to real bookings, clinic API
- Blog namespace that ranks — drug pages, specialty pages
- Telegram bot with OTP, used for identity

### What is broken or missing
1. **Analysis content unpublished** — 3,613 rows sitting in CSV
2. **No bridge** — a patient on a blog page has no path to a service or provider
3. **Service tree unindexed** — thin pages, four clicks deep, no inbound internal links
4. **`/clinics` and `/doctors` render empty grids** even though headers report 1 and 12
5. **No lab entity at all** — labs are not modelled as a supply type distinct from clinics

### URL scheme for phase 1

Keep the existing tree. Add nothing that duplicates it.

```
/analyses/<slug>            individual analysis page  ← the phase 1 workhorse
/analyses/<category>        category hub, real prose, links down
/services/laboratory/...    existing tree — link INTO /analyses/*, do not duplicate
/labs/<slug>                new: lab profile (address, hours, prep, contact)
```

Decide deliberately whether analysis pages live under `/blog/` (which currently ranks) or a new
`/analyses/` namespace (cleaner, unproven). **Evidence favours the namespace that already ranks —
but this is an open question, see §8.**

### Requirements for the analysis page template
- Server-rendered. Client-only rendering is why the service tree is invisible.
- Real prose: what the test measures, why it is ordered, preparation, what the ranges mean in
  general terms. Not a stub with a price table.
- Synonyms and abbreviations in the body — patients search «ТТГ», «TSH», «тиреотропный гормон».
  This is also the naming problem the product exists to solve.
- Internal links: up to its category, sideways to related tests, down to where to get it.
- RU and UZ.
- **Never** phrase content as advice. "Tests commonly ordered alongside X", never "you should get X".

---

## 7. Build sequence for phase 1

Do these in order. Steps 1–4 are ungated.

1. **Publish a slice of analyses, not all 3,613.** Start with the 50–100 most-searched tests (ОАК,
   ТТГ, глюкоза, биохимия, витамин D, ферритин, гормоны щитовидной железы). Publishing 3,613 thin
   pages at once looks like spam to Google and wastes the asset.
2. **Build the analysis page template** to the requirements above. Prove one page ranks before
   scaling.
3. **Fix internal linking** — every published analysis page links up to its category and into the
   existing `/services/laboratory` tree; the tree links back down.
4. **Fix the empty grids** on `/clinics` and `/doctors` — never render an empty result. Show the
   catalog, show what is nearby, show something.
5. **GATE — run the three tests in §5.**
6. Only if they pass: model labs as a supply type, onboard 5–6 networks, build basket pricing.

Measure at step 2, not step 6: does a single published analysis page get indexed and earn
impressions? If one page cannot rank, one hundred cannot.

---

## 8. Open questions — decide deliberately, do not default

1. **Namespace:** `/analyses/*` or under `/blog/*`? The blog ranks today; a new namespace starts
   from zero authority.
2. **What does a lab pay for** in a hand-off model with no booking? Listing fee, per-referral
   (trackable via unique phone or Telegram deep link), or free initially. Ask lab commercial
   directors during test 1 — the field kit includes the question.
3. **How is a referral basket entered?** Photograph the slip, search by name, or pick from a
   catalog. Affects the whole front end and has not been decided.
4. **The naming problem.** If five labs return five different names and parameter counts for one
   word on a slip, that reconciliation may be more valuable and more defensible than price
   comparison. Test 2 measures this as a side effect — do not ignore that number.
5. **Live operating figures** — bookings/month, monthly visitors, MRR, paying clinics. Requires SSH
   to 45.77.242.169, which was blocked in the originating session. Get these; several decisions
   above are provisional without them.

---

## 9. How to work on this

- **Use the `value-chain-launch` skill** for any launch, wedge, or channel decision. It carries the
  method above and five hard gates. Source lives at `skills/value-chain-launch/` in the ailos repo;
  the copy at `~/.claude/skills/` is deployed, so edit the repo and re-run `DEPLOY.md`.
- **Numbers, not adjectives.** "Expensive" and "slow" are not costs. Write UZS, minutes, EIPs, or `?`.
- **Never net the three currencies into one score.** A change that saves time but costs effort is a
  trade-off with a winning segment, not a win.
- **Judge the idea in front of you.** If a proposal fails, say so and give the verdict before
  offering a repair. Do not quietly improve an idea and plan the improved version.
- **A gate is a hard stop.** Naming a problem and continuing in the same message is failing the gate.
- Owner is non-technical: approve and describe in plain English, never require reading code.

### Source documents
| File | What it holds |
|---|---|
| `docs/gtm/2026-08-01-symptex-lab-referral.md` | Full value-chain analysis, the NO verdict on the earlier framing, cold-critic findings |
| `docs/gtm/2026-08-01-symptex-lab-tests-fieldkit.md` | The three gate tests — scripts in Russian, comparison sheet, stop numbers |
| `symptex-analyses-plan/analyses_plan.csv` | 3,613 analyses, 57 categories, unpublished |
| `Desktop/Symptex - Investor Presentation.md` | 15-slide deck. **Slide 8's "value-creating decoupler" claim is not supported by the chain above** — the lab wedge spans two cells and is mostly value-eroding. Fix before presenting. |
