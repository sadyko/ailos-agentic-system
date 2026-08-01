# `value-chain-launch` — Skill Design Spec

> A reusable Claude Code skill that breaks down the **customer value chain** (Thales Teixeira, *Unlocking the Customer Value Chain*, 2019), costs every activity in the three currencies customers actually pay with, finds the weak link, designs the business model, argues with you where the reasoning is weak, and produces a phased marketing / sales / customer-acquisition checklist.
>
> Design spec only — no code. Owner is non-technical; all decisions confirmed with them 2026-08-01. **Revised same day** after the owner supplied a sharper method (six-stage chain, EIP costing, the 2×2, the four layers).

## Goal

Point the skill at something you are about to launch. It maps the customer's value chain across six stages, costs each activity in **money / time / effort**, classifies it on a **2×2 of customer value vs firm revenue**, finds the weak links, forces you to prove your model isn't merely digitized, researches the incumbent, hands the plan to a cold critic, delivers a plain **GO / GO IF / NO** verdict, and then writes a first-1,000-customers acquisition plan as a tickable checklist.

Deliverables: a dated markdown plan and a self-contained HTML one-pager.

## Confirmed decisions

| Decision | Choice |
|---|---|
| **Job** | Plan a launch — first 1,000 customers. Not an audit tool, not a threat radar. |
| **Scope** | Generic. Any business — SaaS, clinic, marketplace, physical product. No baked-in domain examples. |
| **How critical** | Gates during analysis, cold red-team at the end, honest verdict that can say no. |
| **Output** | Dated markdown file **plus** shareable self-contained HTML one-pager. |
| **Research** | Every run includes a web research pass. No offline-only mode. |
| **Structure** | Thin `SKILL.md` spine + reference files per phase; **separate agent** for the red-team. |
| **CVC shape** | **Six stages**: trigger → evaluate → choose → purchase → consume → re-need/dispose. |
| **Cost model** | **Three currencies** per activity: money, time, effort-in-EIPs. |
| **Classification** | **2×2**: creates/erodes customer value × firm captures money/doesn't. |
| **Four layers** | Traditional / digital / incremental / disruptive — as a **gate**, assessed once for the wedge. |
| **Counter-move** | Kept, derived from which 2×2 cell is attacked. |
| **Growth** | Ch. 8 coupling included. Ch. 9 (reclaiming) and Ch. 10 (next wave) excluded. |
| **Quick mode** | None. Every run is a full run. |
| **Location** | User-level: `~/.claude/skills/value-chain-launch/`. |

## Source handling

Reference files carry the framework **distilled in our own words with chapter citations**, never verbatim book text. The epub stays at `C:\Users\user\Desktop\vdoc.pub_unlocking-the-customer-value-chain.epub` and is **not** committed.

## Corrections applied to the owner's draft method

Recorded because they are the reason the method works, and a future editor will otherwise re-introduce them.

**1. EIP is the unit of *effort only*, not a general unit of cost.** Ch. 3: *"your customers always pay you with three 'currencies': their money, their time, and their effort."* An EIP is a cognitive step — typing a name in a search bar, adding to basket, entering card details. **"Waiting 3 days" is a time cost with zero EIPs.** Merging time into EIP destroys the model's central use: the book's own comparison shows a price-sensitive student and a time-sensitive parent making *opposite* decisions on the same chain. If the three currencies are collapsed into one score, you cannot tell which segment your wedge wins.

**2. One activity contains several EIPs — not one.** The Ch. 3 fridge comparison: buying at Walmart while standing in front of it is *choose · pay · schedule delivery* = 3 EIPs; showrooming to Amazon is *search · choose · pay · schedule* = 4. Full cost of decoupling = **−$140 + 2 days + 1 EIP**. A strict 1:1 activity:EIP mapping makes the EIP count identical to the activity count and measures nothing.

**3. The 1:1 instinct is preserved as the granularity rule** (see Gate 2). If an activity contains more than ~5 EIPs it is too coarse and must be split; if it contains zero it is not an activity. This gives Gate 2 a mechanical test instead of a judgment call.

**4. The four layers are not Teixeira's.** Verified absent from Ch. 2, 4, and 10. They are the owner's addition, kept because they detect the most common self-deception in launch planning — believing you are at layer 4 when you are at layer 2.

**5. Creating/charging/eroding is not a valid 3-way exclusive label.** "Pay at the counter" erodes customer value *and* is the charging activity. Splitting into two independent axes (customer's view, firm's view) resolves this and produces the 2×2.

## Framework the skill encodes

| Book | Concept | Used in |
|---|---|---|
| Ch. 1 | Canonical CVC: evaluate → choose → purchase → consume (Sephora, Best Buy) | Phase 1 |
| Ch. 3 | Three currencies: money, time, effort; EIP as the unit of effort | Phase 1 |
| Ch. 3 | Specialization forces — customers split activities when the cost of doing so drops | Phase 2–3 |
| Ch. 4 | The 5-step recipe: segment + CVC → classify → weak links → break them → predict response | Phases 1–4 |
| Ch. 4 (Fig 4.4) | Value-creating decouplers ~$600M median, charging ~$350M, eroding ~$100M; eroding is copied fastest | Phase 2–3 |
| Ch. 4 | Take a value-creating activity *and* a charging one, or invent monetization | Phase 3 |
| Ch. 5 | Incumbent response: **recouple** (rebuild the link) vs **rebalance** (change what you charge for) | Phase 4 |
| Ch. 6 | Market at risk — small enough and they ignore you, big enough and they fight | Phase 4 |
| Ch. 7 | The 7 principles for the first 1,000 customers | Phase 5 |
| Ch. 7 (Fig 7.3) | Cost-effectiveness vs scalability frontier for channels | Phase 5 |
| Ch. 8 | Growth by coupling adjacent activities; integration cost; build / borrow / buy | Phase 5 |

## The core artifact: the chain table

Phases 1 and 2 produce one table. Everything downstream reads from it.

| # | Stage | Activity (customer's words) | $ | Time | EIPs | Customer value | Firm charges? | Bond to next |
|---|---|---|---|---|---|---|---|---|
| 1 | trigger | notices the lease expires in a month | 0 | — | 1 | erodes | no | weak |
| 2 | evaluate | compares three brands on a review site | 0 | 2h | 12 | creates | no | strong |
| … | | | | | | | | |

- **Stage** — one of the six.
- **Activity** — observable, in the customer's own words. Not a marketing-funnel label.
- **$ / Time / EIPs** — the three currencies. `—` where genuinely zero.
- **Customer value** — creates or erodes (the customer's axis).
- **Firm charges?** — yes/no (the firm's axis). Together these place the activity in the 2×2.
- **Bond to next** — strong or weak: would the customer *happily* do this activity and the next one with different companies? This column is the weak-link detector.

**EIP counting is precise only where it matters.** Activities adjacent to candidate weak links get counted step by step; the rest get a good-faith estimate. Counting 20 activities to the exact step is waste.

## The 2×2

| | **Firm captures money here** | **Firm captures nothing** |
|---|---|---|
| **Creates customer value** | **Fortress.** Defended hardest. Expensive to take. | **Best wedge.** Highest market value (Ch. 4). Incumbent often ignores it for years — they lose no revenue. |
| **Erodes customer value** | **Vulnerable but violent.** The customer hates it and the incumbent depends on it. Attacking here hurts them, so they retaliate fast. | **Pure waste.** Easy to remove, easy to copy, worth least. |

The cell you attack **determines the counter-move prediction** in Phase 4 — which is why the owner's step 5 (monetization) and the book's step 5 (predict the response) turn out to be the same question.

## The 17 stages, in 5 phases

Five **gates**. A gate is a hard stop: the skill names what is missing and will not proceed.

### Phase 1 — Map

**1 · The segment.** One narrow group, defined by the job they are trying to get done, not demographics.
> **GATE 1.** Rejects "small businesses", "young professionals", "clinics". Test: can you name 20 real ones, or say where they physically gather? If not, the bulk-acquisition stage is impossible.

**2 · Map the chain across six stages.** Trigger → evaluate → choose → purchase → consume → re-need/dispose. Activities listed under each stage in the customer's words.
> **GATE 2.** Three mechanical tests: (a) **≥12 activities total** and **≥1 in every one of the six stages** — an empty trigger or re-need stage usually means the chain was mapped from the company's side, not the customer's; (b) **granularity** — every activity must contain between 1 and ~5 EIPs; more means split it, zero means it isn't an activity; (c) **no funnel labels** — "awareness / interest / consideration / conversion" are rejected outright with a worked example of the difference. Teixeira spends ~50% of consulting time here and names generic mapping as the top reason decouplers fail.

**3 · Cost the chain.** Fill `$ / time / EIPs` for every activity.
> Numbers or `—`. Adjectives ("expensive", "slow", "annoying") are rejected. If a number genuinely isn't known, it is written as `?` and becomes a research item in Phase 4 — not a guess dressed as a fact.

### Phase 2 — Classify

**4 · Place every activity on the 2×2.** Customer axis (creates/erodes) and firm axis (charges/doesn't).
> **GATE 3.** If no activity in the whole chain is marked "firm charges", the chain is incomplete — the customer pays *someone*, somewhere. Re-map before proceeding.

**5 · Find the weak links.** Read the `bond to next` column. Rank candidate links by the cost the customer bears at that point (the triple) against how weakly the two activities are bonded. High cost + weak bond = the prime candidate.

### Phase 3 — Design

**6 · Pick the wedge and compute the delta.** One activity you take. The specialization force is stated as a triple:

| | Incumbent | Us | Delta |
|---|---|---|---|
| Money | $2,188 | $2,048 | **−$140** |
| Time | 1 day | 3 days | **+2 days** |
| Effort | 3 EIPs | 4 EIPs | **+1 EIP** |

> A wedge that improves nothing, or improves one currency while worsening two, is flagged immediately — that is the honest reading of the fridge example, where decoupling is *not* obviously worth it.

**7 · The four layers.** Describe the idea at each layer, with an explicit column for **who performs which activity**:

| Layer | Description | Who performs which activity |
|---|---|---|
| 1 · Traditional | how it's done today, offline | |
| 2 · The digital version | same process, screens instead of paper | |
| 3 · Incremental innovation | same model, faster or cheaper | |
| 4 · Our disruptive model | | |

> **GATE 4.** If layer 4's *who performs which activity* column is not structurally different from layers 2 and 3 — if no activity has moved between parties — you are not decoupling, you are digitizing. The skill says so and the verdict is capped at **GO IF** at best. Assessed once, for the wedge, not per activity.

**8 · The business model — who pays.** How value is charged: end user, B2B, B2C, B2G, or a third party (manufacturers, advertisers, insurers).
> **GATE 5.** If the wedge takes only a value-creating activity and captures no existing charging activity, a *new* charging activity must be named here. Ch. 4 is explicit: you must introduce one or the business isn't viable.
>
> **If the payer is not the user, the skill maps the payer's chain too** — a second, shorter pass through phases 1–2. Most B2B2C plans die in that gap: the patients love it, the clinic won't pay for it.

### Phase 4 — Test

**9 · Research pass** *(always runs).* Who the incumbent actually is, what they charge, whether anyone already decouples this exact link, rough market at risk. Resolves the `?` cells from stage 3. Every finding cited or explicitly labelled **unverified**.
> Requires web access. If the tools are unavailable or every search fails, the plan is stamped **`RESEARCH FAILED — INCUMBENT UNVERIFIED`** at the top. It never silently skips and presents itself as researched.

**10 · Predict the counter-move.** Derived from the 2×2 cell attacked:

| Cell attacked | Likely response | Speed |
|---|---|---|
| Erodes + firm charges | **Rebalance** — move the charge elsewhere; or **recouple** with bundling/contracts | Fast — you're taking revenue |
| Creates + firm charges | Recouple hard; possible acquisition offer | Fast |
| Creates + no charge | Often none for years — no revenue lost | Slow |
| Erodes + no charge | Copy you | Fast, but cheap to them |

Plus the threshold: at what revenue do you stop being too small to bother with?

**11 · Cold critic.** A **separate agent** — dispatched with the Agent tool, fresh context — receives the finished plan and nothing else. It never sees the conversation that produced it, so it has no sunk cost in defending it. Instructed to kill the plan. Returns: the assumptions ranked by load bearing, which have no evidence, the fastest realistic path to failure, and whether the delta triple is a real cost reduction or cosmetic.

**12 · Verdict.**
- **GO** — real weak link, delta triple favourable, monetization named, response survivable.
- **GO IF** — conditional. Named assumptions must be tested first, and the Phase 5 checklist becomes a *test* list, not a spend list. **Automatic cap for anything failing Gate 4.**
- **NO** — no weak link, or the wedge only removes value-eroding work anyone can copy, or the delta triple is negative, or there is no monetization. States which, and what would change the answer.

### Phase 5 — Plan

**13 · The first 1,000.** Each of the seven principles answered concretely: the **bulk moment** (which event/platform/group puts hundreds of the segment in one place); the **blind spot** (demand the incumbent can't or won't serve); the **non-scalable act** (what you personally do for the first 50); **incubation** (supply side first if two-sided); the **offline tool**; **operations before technology**; and **walking your own chain as a customer**.

**14 · Channels on the frontier.** Candidates plotted cheap-but-small → expensive-but-big, sequenced along the efficient frontier. Each carries a cost-per-customer ceiling, a measurement, and a **kill rule** — the number at which you stop spending.

**15 · Next coupling move.** Exactly two activities are truly adjacent to your wedge — the one before and the one after. For each: does owning it make the customer's *combined* cost lower than using two vendors (integration cost)? And do you **build / borrow / buy** the skills? Output: one named next activity plus the trigger that says you're ready.

**16 · The checklist.** Phased — Week 1–2 / Weeks 3–6 / To 1,000. Every item: the action, who does it, **done when ___**, and the number that proves it. Critic assumptions sit at the top as test items; on **GO IF** they are the *only* items until they pass.

**17 · Write the files.** `docs/gtm/YYYY-MM-DD-<slug>.md` and `.html` in the open project. Asks if there's no sensible location.

## File layout

```
~/.claude/skills/value-chain-launch/
  SKILL.md                      # spine: the 5 phases, the 5 gates, verdict rules. Loads every run.
  references/
    chain-mapping.md            # phase 1: six stages, the chain table, EIP counting, granularity rule
    classify-and-weak-links.md  # phase 2: the 2x2, bond scoring, valuation evidence
    wedge-and-layers.md         # phase 3: delta triple, the four layers gate, payer-chain rule
    incumbent-response.md       # phase 4: cell-to-response mapping, recouple vs rebalance, market at risk
    critic-brief.md             # phase 4: the cold agent's instructions
    first-1000.md               # phase 5: the 7 principles, channel frontier, kill rules
    coupling-growth.md          # phase 5: adjacency test, integration cost, build/borrow/buy
  templates/
    plan.md
    plan.html
```

Only `SKILL.md` loads every run; references load as their phase begins.

## The HTML one-pager

Single self-contained file — opens by double-click, no internet. Requirements:
- Verdict banner at the top (GO / GO IF / NO, visually distinct)
- The chain as a horizontal strip, six stage groups, each activity coloured by its 2×2 cell; horizontally scrollable on narrow screens
- The delta triple as three large figures
- The 2×2 rendered as an actual quadrant with activities placed in it
- The checklist as real tickable checkboxes
- Print-friendly; readable on a phone; light and dark
- **No emojis** — inline lucide SVG only, per the standing house rule
- No CDN links, no external fonts, no remote images

## How we verify it works

1. **End-to-end run** on one real business of the owner's — both files produced, plan specific enough to act on.
2. **Gate 2 adversarial test** — feed it "awareness → interest → purchase" and confirm it *rejects* rather than politely proceeding. Feed it a 6-activity chain and confirm it demands more. Feed it one bloated activity ("customer buys the product") and confirm the granularity rule splits it.
3. **Gate 3 test** — a chain with no charging activity anywhere must stop.
4. **Gate 4 test** — describe a plain mobile app for an offline service (a layer-2 idea dressed as layer 4) and confirm the verdict caps at **GO IF** with the digitizing diagnosis stated.
5. **Gate 5 test** — a wedge that takes a value-creating activity with no monetization must stop.
6. **Verdict test** — a launch that only removes a value-eroding chore anyone could copy must not return a cheerful **GO**.
7. **Currency-separation test** — confirm a wedge that saves 2 days but costs 5 extra EIPs is reported as a *trade-off with a named winning segment*, not netted into a single score.
8. **HTML check** — open offline; confirm no network requests, correct light/dark rendering, clean print.

## Explicitly out of scope

- Ch. 9 (reclaiming lost customers) — matters once you have customers, not at launch.
- Ch. 10 (spotting the next wave) — market-watching, not launch planning.
- Full Ch. 5–6 incumbent-defence playbook — only what stage 10 needs.
- A quick/offline mode — deliberately rejected so nothing half-finished passes as verified.
- Progress tracking over time. The file is a document; you tick the boxes yourself.
