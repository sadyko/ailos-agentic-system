# `value-chain-launch` — Skill Design Spec

> A reusable Claude Code skill that plans a product launch by breaking down the **customer value chain** (Thales Teixeira, *Unlocking the Customer Value Chain*, 2019), argues with you where the reasoning is weak, and produces a phased marketing / sales / customer-acquisition checklist. Design spec only — no code. Owner is non-technical; every decision below was confirmed with them 2026-08-01.

## Goal

Point the skill at something you are about to launch. It interrogates the customer's value chain until the map is specific and honest, researches the incumbent, hands the finished plan to a cold critic, delivers a plain **GO / GO IF / NO** verdict, and then writes a first-1,000-customers acquisition plan as a tickable checklist — plus one adjacent activity to take next once the wedge lands.

The deliverable is two files: a markdown plan and a self-contained HTML one-pager you can send to a partner or investor.

## Confirmed decisions (2026-08-01)

| Decision | Choice |
|---|---|
| **Job** | Plan a launch — first 1,000 customers. Not an audit tool, not a threat radar. |
| **Scope** | Generic. Works for any business — SaaS, clinic, marketplace, physical product. No baked-in health-tech or CIS examples. |
| **How critical** | Gates at the front, cold red-team at the end, and an honest verdict that can say the launch isn't worth doing. |
| **Output** | Dated markdown file **plus** a shareable self-contained HTML one-pager. |
| **Research** | Every run includes a web research pass. No offline-only mode. |
| **Structure** | Thin `SKILL.md` spine + reference files loaded per stage, and a **separate agent** for the red-team. |
| **Extra stage** | Ch. 8 growth-by-coupling included (stage 12). Ch. 9 reclaiming-lost-customers excluded. |
| **Quick mode** | None. Every run is a full run. |
| **Location** | User-level: `~/.claude/skills/value-chain-launch/` — available in every project. |

## Source handling (important)

The reference files carry the framework **distilled in our own words with chapter citations** (e.g. "Ch. 4, step 2"), never verbatim book text. The epub itself stays at `C:\Users\user\Desktop\vdoc.pub_unlocking-the-customer-value-chain.epub` and is **not** committed to this repo. Anyone extending the skill can re-extract chapters from it locally.

## Framework the skill encodes

Distilled from the book, mapped to the stages that use it:

| Book | Concept | Used in stage |
|---|---|---|
| Ch. 3 | Customers disrupt markets by *specializing* — they split activities across companies when the money/time/effort cost of doing so drops below staying with one | 4, 5 |
| Ch. 4 | The 5-step decoupling recipe: identify segment + CVC → classify activities → find weak links → break them → predict incumbent response | 1–5, 7 |
| Ch. 4 | Three activity types: **value-creating**, **value-charging**, **value-eroding**; take a creating activity *and* a charging one or invent monetization | 3, 5 |
| Ch. 4 (Fig 4.4) | Investors value creating-decouplers highest (~$600M median), charging next (~$350M), eroding lowest (~$100M); eroding is also the easiest to copy | 5 |
| Ch. 5 | Incumbent responses: **recouple** (rebuild the broken link) vs **rebalance** (change what you charge for) | 7 |
| Ch. 6 | Sizing the market at risk to the incumbent — small enough and they ignore you, big enough and they fight | 7 |
| Ch. 7 | The 7 principles for the first 1,000 customers | 10 |
| Ch. 7 (Fig 7.3) | The cost-effectiveness vs. scalability frontier for acquisition channels | 11 |
| Ch. 8 | Growth by coupling **adjacent** CVC activities; integration cost; build / borrow / buy skills gap | 12 |

## The 14 stages

Four **gates**. A gate is a hard stop — the skill states what is missing and will not proceed until it is fixed.

### 1 · The segment
One narrow group, defined by the job they are trying to get done — not by demographics.

> **GATE 1.** Rejects "small businesses", "young professionals", "clinics". Test: can you name 20 real ones, or say where they physically gather? If not, stage 10 is impossible — you cannot acquire in bulk from a group you cannot locate.

### 2 · Map the customer value chain
12 or more concrete, observable steps in the customer's own words, running from *first feels the need* through *uses it* to *needs it again*.

> **GATE 2 — the load-bearing one.** Rejects marketing funnels. A chain reading "awareness → interest → consideration → purchase" is thrown back with a worked example of the difference. Rejects fewer than 12 steps. Teixeira spends ~50% of consulting time on this step and names generic mapping as the #1 reason decouplers fail. Everything downstream inherits an error made here.

### 3 · Classify every step
Each step is marked **value-creating** (the customer wants it), **value-charging** (money changes hands), or **value-eroding** (the customer endures it).

> **GATE 3.** If the chain contains no value-charging step, there is no money in it. Stop and re-map — the chain is incomplete.

### 4 · Find the weak links
For each adjacent pair of steps: would the customer *happily* do these two with different companies? Each link scored on (a) what the step costs the customer in money, time, and effort, and (b) how weakly it is bonded to the next. Ranked, strongest candidate first.

### 5 · Pick the wedge
The single activity you take. Three checks:
- **Is it value-creating?** If you are only removing a value-eroding chore, say so plainly — it is the least defensible and fastest-copied type.
- **Do you also capture a value-charging step?** If not, name the new monetization now. A plan without it is incomplete.
- **How much drops for the customer?** In numbers — money, minutes, steps. Adjectives are rejected.

> **GATE 4.** No named monetization → no plan. The skill states what is missing and stops.

### 6 · Research pass *(always runs)*
Web research on: who the incumbent(s) actually are, what they charge, whether anyone is already decoupling this exact link, and the rough size of the market at risk. Every finding is either cited with a source or explicitly labelled **unverified**.

Requires web access. If the tools are unavailable or every search fails, the skill **says so at the top of the plan and stamps the output `RESEARCH FAILED — INCUMBENT UNVERIFIED`**. It does not silently skip the stage and present the result as a researched plan.

### 7 · Predict the counter-move
Will the incumbent **recouple** (bundle, contract, lock-in — rebuild the broken link) or **rebalance** (change what they charge for)? How fast can they move? Can you survive it? Being too small to bother with is recorded as an advantage, with the revenue threshold at which it stops being true.

### 8 · Cold critic
A **separate agent** — dispatched with the Agent tool, fresh context — receives the finished plan and nothing else. It never sees the conversation that produced the plan, so it has no sunk cost in defending it. It is instructed to kill the plan, and returns:
- the assumptions the plan rests on, ranked by how much weight they carry
- which of those have no evidence behind them
- the fastest realistic path to failure
- whether the wedge is a real cost reduction for the customer or a cosmetic one

Self-review is not acceptable here: a critic that helped write the plan goes easy on it.

### 9 · Verdict
Stated plainly, one of three:
- **GO** — real weak link, named monetization, survivable incumbent response.
- **GO IF** — conditional. Named assumptions must be tested first, and the stage-13 checklist becomes a *test* list, not a spend list.
- **NO** — no weak link in the chain, or the wedge is only value-eroding and trivially copyable, or there is no way to charge. The verdict says which, and states what would change the answer.

### 10 · The first 1,000 plan
Each of the book's seven principles turned into a concrete answer for *this* business:

1. **Buy customers in bulk** — which event, platform, or existing group puts hundreds of your segment in one place?
2. **Don't confront competitors directly** — which demand can the incumbent not, or will not, serve?
3. **Do things that don't scale** — what will *you personally* do for the first 50 customers?
4. **Incubate early customers** — how cohort one gets hand-held; if two-sided, supply side first.
5. **Use low-tech, offline tools** — the physical move: events, on-the-ground presence, paper.
6. **Operations before technology** — what stays manual until it works.
7. **See it through the customer's eyes** — how you personally walk the value chain as a customer.

### 11 · Channels on the frontier
Candidate channels plotted cheap-but-small → expensive-but-big, then sequenced along the efficient frontier. Each channel carries a cost-per-customer ceiling, how it will be measured, and a **kill rule** — the number at which you stop spending on it.

### 12 · Next coupling move
Once you own an activity, exactly two activities are truly adjacent: the one immediately before and the one immediately after. For each candidate:
- Does owning it make the customer's **combined** cost lower than using two separate vendors? (integration cost)
- Do you have the skills — **build**, **borrow** (partner), or **buy** (acquire)?

Output: one named next activity, plus the trigger that says you are ready to take it.

### 13 · The checklist
Phased: **Week 1–2** / **Weeks 3–6** / **To 1,000**. Every item carries the action, who does it, a **done when ___** condition, and the number that proves it worked. Assumptions surfaced by the cold critic sit at the top as test items — on a **GO IF** verdict they are the only items until they pass.

### 14 · Write the files
`docs/gtm/YYYY-MM-DD-<slug>.md` and `docs/gtm/YYYY-MM-DD-<slug>.html` in whatever project is open. If there is no sensible location, the skill asks.

## File layout

```
~/.claude/skills/value-chain-launch/
  SKILL.md                      # spine: flow, the 4 gates, verdict rules. Loads every run.
  references/
    cvc-mapping.md              # stages 1-3: how to map, failure modes, worked examples
    weak-links-and-wedge.md     # stages 4-5: link scoring, 3 activity types, valuation evidence
    incumbent-response.md       # stages 6-7: recouple vs rebalance, sizing market at risk
    critic-brief.md             # stage 8: the cold agent's instructions
    first-1000.md               # stages 10-11: the 7 principles, channel frontier, kill rules
    coupling-growth.md          # stage 12: adjacency test, integration cost, build/borrow/buy
  templates/
    plan.md                     # markdown output
    plan.html                   # shareable one-pager
```

Only `SKILL.md` loads on every run; references load as their stage begins. This is what keeps the rigorous middle stages from being skimmed on a long run.

## The HTML one-pager

Single self-contained file — opens by double-click, works with no internet. Requirements:
- Verdict as a banner at the top (GO / GO IF / NO, visually distinct)
- The customer value chain as a horizontal strip, each step colour-coded by type (creating / charging / eroding), horizontally scrollable on narrow screens
- The checklist as real tickable checkboxes
- Print-friendly; readable on a phone
- Light and dark
- **No emojis** — inline lucide SVG only, per the standing house rule
- No CDN links, no external fonts, no remote images

## How we verify it works

1. **End-to-end run** on one real business of the owner's — confirm it produces both files and that the plan is specific enough to act on.
2. **Gate 2 adversarial test** — feed it a deliberately vague value chain ("awareness → interest → purchase") and confirm it *rejects* rather than politely proceeding. A gate that does not fire is worse than no gate, because it creates false confidence.
3. **Gate 4 test** — describe a wedge with no monetization and confirm it stops.
4. **Verdict test** — describe a launch that only removes a value-eroding chore anyone could copy, and confirm the verdict is **NO** or **GO IF**, not a cheerful **GO**.
5. **HTML check** — open the generated page offline in a browser; confirm no network requests, correct rendering in light and dark, and that it prints cleanly.

## Explicitly out of scope

- Ch. 9 (reclaiming lost customers) — useful once you have customers, not at launch.
- Ch. 10 (spotting the next wave) — market-watching, not launch planning.
- Ch. 5–6 as a full incumbent-defence playbook — only the parts needed to predict the counter-move (stage 7) are included.
- A quick/offline mode — deliberately rejected so nothing half-finished can be mistaken for a verified plan.
- Any tracking of checklist progress over time. The file is a document; you tick boxes in it yourself.
