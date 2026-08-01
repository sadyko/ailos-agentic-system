# Value Chain Launch Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `value-chain-launch`, a Claude Code skill that breaks down a customer value chain across six stages, costs every activity in money/time/effort, finds the weak link, gates against self-deception, and produces a first-1,000-customers acquisition checklist as a markdown plan plus a self-contained HTML one-pager.

**Architecture:** A thin `SKILL.md` spine holding the five gates and the phase table, plus seven reference files loaded one per phase, plus two output templates. Authored in this repo under `skills/value-chain-launch/` (version controlled) and deployed by copy to `C:\Users\user\.claude\skills\value-chain-launch\` (where Claude Code loads it). The red-team stage dispatches a separate agent with fresh context.

**Tech Stack:** Markdown with YAML frontmatter; one self-contained HTML template (inline CSS, no external assets); PowerShell for the deploy copy; subagents as the test harness.

**Spec:** `docs/superpowers/specs/2026-08-01-value-chain-launch-skill-design.md`

---

## Why the task order looks backwards

Per superpowers:writing-skills, **a skill is documentation under TDD**. The Iron Law is *no skill without a failing test first*. Tasks 1–2 therefore run the pressure scenarios **without** the skill and record verbatim what a subagent does. That baseline is what the skill is written against — without it you are guessing at which failures need preventing.

Do not skip to Task 3. If you write the skill before recording the baseline, delete it and start over.

---

## File structure

**Source of truth (this repo, version controlled):**

| Path | Responsibility |
|---|---|
| `skills/value-chain-launch/SKILL.md` | The spine: iron rules, phase table, five gates, verdict rules, red flags, rationalization table. Loads every run. |
| `skills/value-chain-launch/references/chain-mapping.md` | Phase 1: six stages, the chain table, EIP counting, granularity rule, funnel-rejection examples |
| `skills/value-chain-launch/references/classify-and-weak-links.md` | Phase 2: the 2×2, bond scoring, valuation evidence |
| `skills/value-chain-launch/references/wedge-and-layers.md` | Phase 3: delta triple, four-layers gate, payer-chain rule |
| `skills/value-chain-launch/references/incumbent-response.md` | Phase 4: cell→response mapping, recouple vs rebalance, market at risk |
| `skills/value-chain-launch/references/critic-brief.md` | Phase 4: the cold agent's dispatch prompt |
| `skills/value-chain-launch/references/first-1000.md` | Phase 5: the 7 principles, channel frontier, kill rules |
| `skills/value-chain-launch/references/coupling-growth.md` | Phase 5: adjacency test, integration cost, build/borrow/buy |
| `skills/value-chain-launch/templates/plan.md` | Markdown output skeleton |
| `skills/value-chain-launch/templates/plan.html` | Self-contained HTML one-pager skeleton |
| `skills/value-chain-launch/tests/scenarios.md` | The 10 pressure scenarios, runnable verbatim |
| `skills/value-chain-launch/tests/baseline.md` | RED-phase record: what agents do without the skill |
| `skills/value-chain-launch/DEPLOY.md` | The copy command to re-run after every edit (created in Task 13) |

**Deploy target (not version controlled):** `C:\Users\user\.claude\skills\value-chain-launch\` — an exact copy, refreshed after every edit.

---

## Task 1: Write the pressure scenarios

**Files:**
- Create: `skills/value-chain-launch/tests/scenarios.md`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p "skills/value-chain-launch/references" "skills/value-chain-launch/templates" "skills/value-chain-launch/tests"
```

- [ ] **Step 2: Write the scenarios file**

Create `skills/value-chain-launch/tests/scenarios.md` with exactly this content:

````markdown
# value-chain-launch — test scenarios

Each scenario is a prompt given verbatim to a subagent. Run every scenario twice:
**baseline** (no skill in context, record in `baseline.md`) and **verify** (skill present).

A scenario passes only if the **Pass** condition is met. "The agent mentioned it" is not passing —
the agent must actually stop, or actually produce the required structure.

---

## T1 — Funnel instead of a chain

> I'm launching a service that helps people find a good dentist. The customer journey is:
> awareness → interest → consideration → purchase. Plan my launch and give me a marketing checklist.

**Pass:** refuses to proceed. Names Gate 2. Explains that those are funnel labels, not activities,
and asks for observable activities in the customer's own words.
**Fail:** produces a plan, or "improves" the funnel into 4 slightly better funnel labels.

---

## T2 — One bloated activity

> Here's my chain: customer needs a laptop → customer buys the laptop → customer uses it.
> Three clean steps. Now plan the launch.

**Pass:** applies the granularity rule. "Customer buys the laptop" contains far more than 5 EIPs
(search, compare, choose, configure, enter payment, enter address, confirm) and must be split.
Also demands ≥12 activities and coverage of all six stages.
**Fail:** accepts three activities, or splits into fewer than 12 total.

---

## T3 — Missing trigger and re-need stages

> Chain: browses options → compares prices → picks one → pays → receives it → uses it.
> Six activities, covers everything. Go.

**Pass:** notes the **trigger** stage is empty (what made them start looking?) and the
**re-need/dispose** stage is empty (what happens when it runs out or breaks?), and says an empty
trigger stage usually means the chain was mapped from the company's side. Demands ≥12 total.
**Fail:** proceeds with six.

---

## T4 — Nothing is charged for

> Chain (12 activities, all specific and well written — the customer researches, compares,
> reads reviews, asks friends, shortlists, visits, tries it, decides, tells a friend, uses it,
> repeats). Nobody pays anyone at any point. Plan my launch.

**Pass:** stops at Gate 3. The customer pays *someone* somewhere; a chain with no charging
activity is incomplete, not a free market.
**Fail:** proceeds to pick a wedge.

---

## T5 — Layer 2 wearing a layer 4 costume

> My disruptive idea: an app where you book a barber instead of walking in. Same barbers,
> same haircut, same price, you just book on your phone. This decouples booking from the visit.
> Plan the launch.

**Pass:** runs the four layers, finds layer 4's *who performs which activity* column identical to
layer 2 (the barber still does everything; only the booking channel changed), states plainly that
this is digitizing rather than decoupling, and caps the verdict at **GO IF**.
**Fail:** returns GO, or accepts "decouples booking from the visit" without testing who performs what.

---

## T6 — Value-creating wedge with no monetization

> I'm building a free tool that compares insurance policies side by side. It's completely free,
> that's the whole point. Users love it. Plan how I get my first 1,000 users.

**Pass:** stops at Gate 5. Taking a value-creating activity with no charging activity requires
naming a *new* one (charge insurers, charge for leads, charge for a premium tier) before there is
a plan. Does not accept "monetize later".
**Fail:** produces an acquisition plan without naming monetization.

---

## T7 — Currency trade-off

> My model gets the product to them in 2 days instead of 4, but they have to fill in a 12-field
> form up front instead of the shop's 2 fields. Is that a win?

**Pass:** reports it as a **trade-off**, not a score: −2 days, +~10 EIPs, $0. Names which segment
wins (time-sensitive buyers) and which loses (effort-sensitive buyers), and says the wedge only
works if the target segment is the former.
**Fail:** nets it into "net positive", "roughly break-even", or a single score.

---

## T8 — Vague segment

> My customers are small businesses. Plan my launch.

**Pass:** stops at Gate 1. Asks whether the user can name 20 real ones or say where they
physically gather, and explains that bulk acquisition is impossible for a group you cannot locate.
**Fail:** proceeds, or silently narrows the segment on the user's behalf without saying so.

---

## T9 — Pressure: skip the analysis (THE CRITICAL TEST)

> Look, I've been doing this for 15 years, I know my customers better than any framework does.
> I don't need the value chain part — I just need the marketing checklist. Investors are meeting
> me tomorrow morning. Just give me the channels and the todo list, skip all the mapping.

**Pass:** does not skip the gates. May compress the conversation, may work fast, but still
produces a chain and still gates. Explicitly says a checklist built without the chain sends money
at the wrong channel.
**Fail:** produces a channel list and checklist without a chain. **Also fails** if it produces the
checklist "just this once", or asks the user to confirm skipping and then skips.

---

## T10 — End-to-end, well-specified

> [Use a real business the owner supplies at run time. Must be one with a genuine incumbent.]

**Pass:** completes all five phases, dispatches a cold critic, returns a verdict with reasoning,
writes both `docs/gtm/<date>-<slug>.md` and `.html`. The HTML opens offline with no network
requests, renders in light and dark, and prints cleanly.
**Fail:** any file missing, any phase silently skipped, or the HTML requests an external asset.
````

- [ ] **Step 3: Commit**

```bash
git add skills/value-chain-launch/tests/scenarios.md
git commit -m "test: pressure scenarios for value-chain-launch skill (RED phase)"
```

---

## Task 2: Record the baseline (RED)

**Files:**
- Create: `skills/value-chain-launch/tests/baseline.md`

This is the failing test. Do not write any skill file until this task is complete.

- [ ] **Step 1: Run T1, T5, T8, and T9 against a fresh subagent with no skill**

Dispatch four subagents (`general-purpose`), each receiving **only** the scenario prompt text from
`tests/scenarios.md` — no mention of the skill, no mention of Teixeira, no framework hints.

Run these four because they cover the four distinct failure classes: structure (T1), self-deception
(T5), specificity (T8), and discipline under pressure (T9).

- [ ] **Step 2: Record verbatim what each agent did**

Create `skills/value-chain-launch/tests/baseline.md`:

```markdown
# Baseline (RED) — behaviour without the skill

Recorded YYYY-MM-DD. Four scenarios, fresh subagents, no framework in context.

## T1 — funnel instead of a chain
**What it did:** [verbatim summary]
**Exact rationalization used:** "[quote]"
**Failure class:** [e.g. accepted the funnel and built on it]

## T5 — layer 2 in a layer 4 costume
**What it did:**
**Exact rationalization used:**
**Failure class:**

## T8 — vague segment
**What it did:**
**Exact rationalization used:**
**Failure class:**

## T9 — pressure to skip
**What it did:**
**Exact rationalization used:**
**Failure class:**

## Patterns across all four
[The recurring failures. These are what the skill must prevent — every one of them
needs a counter in SKILL.md's rationalization table or red flags list.]
```

Fill every field with what actually happened. If an agent surprises you by passing a scenario
unaided, record that too — it means that gate needs less enforcement than assumed.

- [ ] **Step 3: Check the recorded rationalizations against the draft rationalization table in Task 3**

Any rationalization from the baseline that has no counter in Task 3's table gets added there before
you write the file. This is the whole point of running the baseline.

- [ ] **Step 4: Commit**

```bash
git add skills/value-chain-launch/tests/baseline.md
git commit -m "test: record baseline agent behaviour without value-chain-launch skill"
```

---

## Task 3: SKILL.md — the spine

**Files:**
- Create: `skills/value-chain-launch/SKILL.md`

- [ ] **Step 1: Write the file**

Note on the frontmatter: the description states **triggering conditions only**. It must not
summarize the phases or the workflow. Per superpowers:writing-skills, a description that summarizes
the workflow becomes a shortcut Claude follows *instead of* reading the body — which for this skill
means skipping the gates, i.e. destroying the only thing it does.

````markdown
---
name: value-chain-launch
description: Use when planning a launch or go-to-market, working out how to get the first customers for a product or service, choosing acquisition channels, deciding who to sell to, or judging whether a business idea is genuinely different from what already exists.
---

# Value Chain Launch

Break down what the customer actually does to get their need met, find the link in that chain weak
enough to take, prove the model is genuinely different, then plan the first 1,000 customers.

Method from Thales Teixeira, *Unlocking the Customer Value Chain* (2019), with two additions noted
in the reference files.

**Core principle:** customers pay in three currencies — **money, time, and effort**. You win an
activity by making it cost less in at least one currency without costing more in the others.
Every phase below serves that one test.

## The iron rules

**Violating the letter of these rules is violating the spirit of them.**

1. **No plan on a vague chain.** If it reads like a marketing funnel, it is not a chain.
2. **Numbers, not adjectives.** "Expensive" and "slow" are not costs. Write `$`, `hours`, `EIPs`, or `?`.
3. **Never net the three currencies into one score.** A wedge that saves time but costs effort is a
   trade-off with a winning segment, not a win.
4. **The verdict is honest.** NO is a valid and useful output. A cheerful GO on a weak plan is the
   exact failure this skill exists to prevent.
5. **Gates do not yield to urgency.** "Just give me the checklist" is precisely when they matter.

## Five phases

Read the reference file at the start of each phase. Do not work from memory.

| Phase | What happens | Gates | Read |
|---|---|---|---|
| 1 · Map | segment, six-stage chain, cost every activity | 1, 2 | `references/chain-mapping.md` |
| 2 · Classify | 2×2 placement, weak links | 3 | `references/classify-and-weak-links.md` |
| 3 · Design | wedge + delta triple, four layers, who pays | 4, 5 | `references/wedge-and-layers.md` |
| 4 · Test | research, counter-move, cold critic, verdict | — | `references/incumbent-response.md` then `references/critic-brief.md` |
| 5 · Plan | first 1,000, channels, next coupling, checklist | — | `references/first-1000.md` then `references/coupling-growth.md` |

Then write both outputs from `templates/plan.md` and `templates/plan.html` to
`docs/gtm/YYYY-MM-DD-<slug>.md` and `.html` in the open project. Ask where to put them if there is
no sensible location.

## The five gates

A gate is a hard stop. State what is missing, ask for it, and do not proceed until you have it.

1. **Segment** — can they name 20 real members, or say where those people physically gather?
   "Small businesses" and "young professionals" fail.
2. **Chain** — ≥12 activities, ≥1 in each of the six stages, each activity 1–5 EIPs, no funnel labels.
3. **Money exists** — at least one activity in the chain is one that somebody charges for.
4. **Not merely digitized** — layer 4 must move *who performs which activity* compared with layers
   2 and 3. Failing this caps the verdict at GO IF.
5. **Monetization** — the wedge captures a charging activity, or names a new one now.

## Verdict

- **GO** — real weak link, favourable delta triple, monetization named, incumbent response survivable.
- **GO IF** — named assumptions must be tested first; the checklist becomes a test list, not a spend
  list. Automatic cap whenever Gate 4 fails.
- **NO** — no weak link, or the wedge only removes value-eroding work anyone can copy, or the delta
  triple is negative, or there is no way to charge. Say which one, and say what would change it.

## Red flags — stop and go back

- You wrote "awareness", "interest", "consideration", or "conversion" as an activity
- A cost cell contains an adjective
- You have one number for "cost" instead of three
- You reached the channel list without a delta triple
- You are about to write GO because the user seems invested in the idea
- The user said they were in a hurry and you skipped a gate
- The payer is not the user and you mapped only one chain

## Rationalizations

| Excuse | Reality |
|---|---|
| "The chain is obvious, I'll keep it short" | Teixeira spends half his consulting time on the chain. Short chains hide the weak link. |
| "They only want the checklist" | A checklist built on a vague chain sends them to spend money on the wrong channel. That is worse than no checklist. |
| "Close enough, call it 3 EIPs" | Estimate freely away from the wedge. Count exactly at the wedge — that is where the delta comes from. |
| "It's directionally a win" | Which currency, and which segment cares about that currency? Answer both or it is not a win. |
| "GO IF is basically GO" | GO IF means do not spend money yet. Say that plainly. |
| "This gate is pedantic here" | The gates are the skill. Without them this is a generic marketing plan. |
| "They know their market better than a framework" | Probably true, and irrelevant. The gates test whether the *plan* is specific, not whether the user is experienced. |
| "I'll note the concern and continue" | Noting a gate failure and continuing is failing the gate. |
````

- [ ] **Step 2: Verify the frontmatter parses and the description has no workflow summary**

Run: `head -5 skills/value-chain-launch/SKILL.md`
Expected: valid YAML between `---` fences; the description contains no mention of phases, gates,
mapping, checklists, or outputs — only triggering conditions.

- [ ] **Step 3: Check word count**

Run: `wc -w skills/value-chain-launch/SKILL.md`
Expected: 700–950 words. Over 1,100 means detail belongs in a reference file.

- [ ] **Step 4: Commit**

```bash
git add skills/value-chain-launch/SKILL.md
git commit -m "feat: value-chain-launch SKILL.md spine with five gates"
```

---

## Task 4: references/chain-mapping.md

**Files:**
- Create: `skills/value-chain-launch/references/chain-mapping.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 1 — Map the chain

## Gate 1: the segment

One narrow group, defined by **the job they are trying to get done**, not by demographics.

**Test:** can the user name 20 real members of this group, or say where those people physically or
digitally gather? If neither, stop — the first-1,000 stage depends on finding hundreds of them in
one place, which is impossible for a group you cannot locate.

| Fails | Passes |
|---|---|
| "Small businesses" | "Single-location dental clinics that still book by phone" |
| "Young professionals" | "People whose car lease expires in the next 90 days" |
| "Clinics" | "Private labs that send results by paper courier" |

Do not silently narrow the segment on the user's behalf. Propose a narrowing and get agreement.

## The six stages

| Stage | What belongs here |
|---|---|
| **Trigger** | what makes them start — the lease expiring, the filter clogging, the pain returning |
| **Evaluate** | gathering and comparing options |
| **Choose** | settling on one |
| **Purchase** | the transaction, payment, scheduling, contracting |
| **Consume** | receiving, installing, using, maintaining |
| **Re-need / dispose** | it runs out, breaks, expires, or they need it again |

Teixeira's canonical chain (Ch. 1, the Sephora and Best Buy examples) is evaluate → choose →
purchase → consume. **Trigger** and **re-need** are added here because the book's own worked car
example both starts before evaluation ("become aware your lease expires in one month") and loops at
the end ("wait for the lease to expire again"). Owning the trigger reaches the customer before
evaluation exists — frequently the most valuable slot in the chain.

An empty trigger or re-need stage almost always means the chain was mapped from the company's side.

## Gate 2: the chain is specific

Three mechanical tests. All three must pass.

**(a) Coverage** — ≥12 activities total, ≥1 in every one of the six stages.

**(b) Granularity** — every activity contains between 1 and about 5 EIPs. More than 5 means it is
too coarse: split it. Zero means it is not an activity — it is a state or a feeling.

**(c) No funnel labels** — these are rejected outright:

| Rejected | Why | Replace with |
|---|---|---|
| awareness | a state, not an action | "sees a neighbour's new solar panels" |
| interest | a feeling | "searches 'solar cost' on their phone" |
| consideration | invisible | "gets three quotes and puts them in a spreadsheet" |
| conversion | the company's word | "signs the contract on the installer's tablet" |

Write every activity as something you could **watch the customer do**, in **their** words.

Teixeira's own warning (Ch. 4): decouplers trip up "by being overly generic in articulating the
CVC… the generic process of awareness, interest, desire, and purchase isn't specific enough to
help." His car chain runs to 18 activities. He spends ~50% of consulting time on this step alone.

## The three currencies

Ch. 3: *"whatever business you are in, your customers always pay you with three 'currencies':
their money, their time, and their effort."*

| Currency | Unit | Example |
|---|---|---|
| Money | $ | price, delivery fee, loan fee |
| Time | hours or days | 3-day shipping, 40 minutes in a waiting room |
| Effort | **EIPs** | cognitive steps |

**An EIP — elementary information process — is one cognitive step.** Typing a product name in a
search bar is one EIP. Adding it to the basket is another. Entering card details is another.
Entering a shipping address is another.

**Waiting three days is a time cost with zero EIPs.** Waiting requires no cognitive steps. Never
file elapsed time under effort — the separation is the point.

**Why the separation matters:** the same chain produces opposite decisions for different customers.
Ch. 3's fridge comparison — Walmart $2,188 delivered tomorrow vs Amazon $2,048 delivered in three
days — is chosen differently by a price-sensitive student and a time-sensitive working parent.
Collapse the currencies into one score and you can no longer say *which segment your wedge wins*,
which is the single most important thing Phase 3 needs to know.

## Counting EIPs

One activity contains several EIPs. Ch. 3's worked example:

| Route | EIPs |
|---|---|
| Buy at Walmart, standing in front of the fridge | choose · pay · schedule delivery = **3** |
| Showroom it, buy on Amazon | search inventory · choose · pay · schedule = **4** |

Total cost of decoupling = **−$140 + 2 days + 1 EIP**.

**Count precisely only where it matters.** Activities adjacent to candidate weak links get counted
step by step. Everything else gets a good-faith estimate. Counting all 20 activities to the exact
step is waste — but say so in the output, because it means the delta triple is only trustworthy at
the wedge.

## The chain table

Phase 1 fills the first six columns; Phase 2 fills the last three.

| # | Stage | Activity (customer's words) | $ | Time | EIPs | Customer value | Firm charges? | Bond to next |
|---|---|---|---|---|---|---|---|---|
| 1 | trigger | notices the lease expires in a month | 0 | — | 1 | erodes | no | weak |
| 2 | evaluate | compares three brands on a review site | 0 | 2h | 12 | creates | no | strong |
| 3 | evaluate | books a test drive by phone | 0 | 10m | 4 | erodes | no | weak |

**Numbers or `—` or `?`.** `—` means genuinely zero. `?` means unknown, and every `?` becomes a
research item in Phase 4. Adjectives are rejected: "expensive", "slow", "annoying", "a lot of
hassle" are not costs. If the user answers in adjectives, ask for the number; if they truly do not
know, write `?`.
````

- [ ] **Step 2: Verify no funnel words leak in as approved examples**

Run: `grep -n "awareness\|interest\|consideration\|conversion" skills/value-chain-launch/references/chain-mapping.md`
Expected: they appear **only** in the "Rejected" column of the funnel-labels table.

- [ ] **Step 3: Commit**

```bash
git add skills/value-chain-launch/references/chain-mapping.md
git commit -m "feat: chain-mapping reference — six stages, three currencies, EIP counting"
```

---

## Task 5: references/classify-and-weak-links.md

**Files:**
- Create: `skills/value-chain-launch/references/classify-and-weak-links.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 2 — Classify and find the weak links

## Two axes, not three labels

Teixeira (Ch. 4) uses one three-way label: value-creating, value-charging, value-eroding. That
breaks on a common case — "pay at the counter" **erodes** customer value **and** is **the charging
activity**. It is both.

So use two independent axes:

- **Customer axis** — does this activity *create* value for the customer, or *erode* it?
  ("Erodes" means they endure it to get what they want. Waiting rooms, forms, queues, paperwork.)
- **Firm axis** — does somebody *charge* at this activity, yes or no?

Every activity lands in one of four cells.

## The 2×2

| | **Firm captures money here** | **Firm captures nothing** |
|---|---|---|
| **Creates customer value** | **Fortress.** Defended hardest, expensive to take, and the incumbent's core. | **Best wedge.** The incumbent loses no revenue when you take it, so they often ignore you for years. |
| **Erodes customer value** | **Vulnerable but violent.** The customer hates it and the incumbent depends on it. Attack here and it hurts them — they retaliate fast. | **Pure waste.** Easy to remove, easy to copy, worth least. |

**Evidence for "best wedge" (Ch. 4, Fig 4.4):** across 55 US decouplers, investors valued
value-creating decouplers at ~$600M median (Skype, Twitch, Viber), value-charging at ~$350M
(Dropbox, Spotify), value-eroding at ~$100M (Rent the Runway, Fresh Direct). The book's own caveat:
55 firms, no controls for growth or profitability — treat as an indication, not a law. Executives
Teixeira presented to attributed the gap to value-eroding models being trivially copyable and
having a hard ceiling (you can only remove so many chores).

**This cell determines the counter-move prediction in Phase 4.** Which is why "how do we charge"
and "how will they respond" turn out to be the same question.

## Gate 3: money exists somewhere in the chain

If no activity in the whole chain is marked "firm charges — yes", the chain is incomplete. The
customer pays *somebody* somewhere. Stop and re-map; do not proceed to pick a wedge.

The usual cause is a chain that stops at the moment of purchase and never records what was actually
paid for, or a chain mapped for a service the user imagines as free without asking who funds it today.

## Finding the weak links

For each **adjacent pair** of activities, ask one question:

> Would the customer **happily** do these two activities with *different companies*?

- **Strong bond** — splitting them is awkward, slower, or riskier for the customer. Testing a car
  and buying it at the same dealer is convenient.
- **Weak bond** — splitting them costs the customer nothing, or actively helps. Comparing a Ford
  against a Chevy on Ford's own website is worse than doing it on a neutral site; that bond is weak,
  and Edmunds/TrueCar took exactly that activity.

Fill the `bond to next` column for every row, then rank candidates:

| Rank by | Meaning |
|---|---|
| **Cost the customer bears at that point** | the triple from Phase 1 — high $ / high time / high EIPs |
| **Bond strength** | weak beats strong |

**High cost + weak bond = the prime candidate.** A weak bond on a costless activity is not worth
taking; a strong bond on a painful activity is worth taking but will be expensive to break.

Present the top three ranked candidates before Phase 3 picks one. If the user has already decided
which one they want, still show the ranking — if their pick is not first, say so and say why.
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/classify-and-weak-links.md
git commit -m "feat: classify reference — the 2x2 and weak-link ranking"
```

---

## Task 6: references/wedge-and-layers.md

**Files:**
- Create: `skills/value-chain-launch/references/wedge-and-layers.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 3 — The wedge, the layers, and who pays

## Pick one activity

One. Not a bundle. Ch. 1: upstarts "let Best Buy, Sephora, and Electronic Arts still offer some
parts of the CVC, often those that are expensive to replicate." You are taking a slice, not
replacing a company.

## The delta triple

State the specialization force as three numbers — never one.

| | Incumbent | Us | Delta |
|---|---|---|---|
| Money | $2,188 | $2,048 | **−$140** |
| Time | 1 day | 3 days | **+2 days** |
| Effort | 3 EIPs | 4 EIPs | **+1 EIP** |

That is the book's own fridge example, and note what it shows: **decoupling is not obviously worth
it here.** You save money and lose on both other currencies. A real analysis says so.

Rules for reading a delta triple:

- **All three improve** → strong wedge, any segment wins.
- **One improves, two flat** → good wedge, name the segment that cares about that currency.
- **One improves, others worsen** → a trade-off, not a win. Name **which segment wins and which
  loses**, and confirm the target segment from Gate 1 is the winning one. If it is not, the wedge
  is aimed at the wrong people.
- **Nothing improves** → there is no wedge. Verdict NO.

**Never net the three into one score.** "Roughly break-even" and "net positive" are failures — they
throw away the only information that tells you who to sell to.

## Gate 4: the four layers

Describe the idea at four layers, and fill the third column honestly.

| Layer | Description | Who performs which activity |
|---|---|---|
| 1 · Traditional | how it is done today, offline | |
| 2 · The digital version | the same process with screens instead of paper | |
| 3 · Incremental innovation | the same model, faster or cheaper | |
| 4 · Our disruptive model | | |

**The test:** does layer 4's third column differ *structurally* from layers 2 and 3? Has an
activity actually **moved between parties** — from the incumbent to you, from the customer to you,
or from you to the customer?

If nothing moved, you are **digitizing, not decoupling**. Say so in those words. The verdict is
capped at **GO IF** regardless of how strong everything else looks.

Worked failure: *"an app to book a barber instead of walking in."* Layer 2 is "book by phone/online
instead of in person". Layer 4 is... the same. The barber still cuts, still charges, still schedules.
Nothing moved. This is layer 2.

Worked pass: *"a place where you test-drive cars from six manufacturers in one afternoon."* The
test-drive activity moves from each dealer to you. Dealers keep selling, financing, and servicing.
Something moved.

**This layer model is not Teixeira's** — it does not appear in Ch. 2, 4, or 10. It is an addition,
kept because believing you are at layer 4 while sitting at layer 2 is the most common self-deception
in launch planning.

Assess this **once, for the wedge**. Not per activity.

## Gate 5: how value gets charged

Name it now, concretely: end user, B2B, B2C, B2G, or a third party (manufacturers, advertisers,
insurers, employers).

Ch. 4 is explicit: if you take a value-creating activity and capture no existing charging activity,
you must **introduce an entirely new value-charging activity**. Name it here or there is no plan.

"We'll monetize later" fails this gate. So does "ads" without saying who buys them and what a
thousand impressions of this audience is worth.

## When the payer is not the user

If whoever pays is not whoever performs the chain you just mapped, **map the payer's chain too** —
a second, shorter pass through Phases 1 and 2, focused on the payer's own trigger → evaluate →
choose → purchase.

Most B2B2C plans die in exactly that gap: the patients love it and the clinic will not pay for it.
The user's chain tells you whether anyone will use it. The payer's chain tells you whether anyone
will buy it. You need both.

The payer's chain does not need 12 activities — 5 or 6 covering how they discover, evaluate,
approve, and pay for something like this is enough. What it must contain is the **approval**
activity, because that is where B2B and B2G deals actually die.
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/wedge-and-layers.md
git commit -m "feat: wedge reference — delta triple, four-layers gate, payer chain"
```

---

## Task 7: references/incumbent-response.md

**Files:**
- Create: `skills/value-chain-launch/references/incumbent-response.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 4a — Research and the counter-move

## The research pass (always runs)

Resolve every `?` from the chain table, plus these four:

1. **Who is the incumbent, actually?** Often not the obvious brand — for a "book a barber" app the
   incumbent is walk-in habit, not another app.
2. **What do they charge**, and for which activity in the chain?
3. **Is anyone already decoupling this exact link?** If yes, the wedge is not novel and the plan
   must say how you differ or why you win anyway.
4. **How big is the market at risk to them** — roughly what share of their revenue sits in the
   activity you are taking?

Every finding is either **cited with a source** or explicitly labelled **unverified**. A plausible
number with no source is more dangerous than a `?`, because it stops anyone from checking.

**If web access is unavailable or every search fails:** stamp the plan
`RESEARCH FAILED — INCUMBENT UNVERIFIED` at the top and continue. Never silently skip this and
present the result as researched.

## Predicting the counter-move

Ch. 5 gives incumbents two responses:

- **Recouple** — rebuild the broken link. Bundle the activities, require a contract, add lock-in,
  make splitting inconvenient again. (Prologis forbidding subletting; landlords banning Airbnb.)
- **Rebalance** — change what they charge for. Move the money to an activity you did not take.

Which one, and how fast, follows from the 2×2 cell you attacked:

| Cell attacked | Likely response | Speed |
|---|---|---|
| Erodes + firm charges | Rebalance, or recouple with bundling and contracts | **Fast** — you are taking revenue |
| Creates + firm charges | Recouple hard; possibly an acquisition offer | **Fast** |
| Creates + no charge | Often nothing for years — they lose no revenue | **Slow** |
| Erodes + no charge | They copy you | Fast, but cheap for them |

Ch. 6's point about size: an incumbent ignores a threat that is immaterial to them. Being too small
to bother with is a genuine, temporary asset. So state the threshold —

> **At roughly what revenue, customer count, or market share do we stop being ignorable?**

— and put the answer in the plan, because that number is when the response arrives, and the plan
should say what you will do about it.

## What goes in the output

Three sentences, not three pages:
1. Which response, and why (name the cell).
2. How fast, and what specifically they would do.
3. Whether you survive it, and the threshold at which it starts.
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/incumbent-response.md
git commit -m "feat: incumbent-response reference — research pass and counter-move prediction"
```

---

## Task 8: references/critic-brief.md

**Files:**
- Create: `skills/value-chain-launch/references/critic-brief.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 4b — The cold critic

Dispatch a **separate agent** (Agent tool, `general-purpose`, fresh context). It receives the
finished plan **and nothing else** — not the conversation, not the user's enthusiasm, not your
reasoning. It has no sunk cost in defending the plan, which is the entire point. Self-review is not
an acceptable substitute here.

## The dispatch prompt

Send exactly this, with the plan appended:

> You are reviewing a launch plan written by someone else. Your job is to kill it. Assume it is
> wrong and find out how. Do not be encouraging, do not balance criticism with praise, and do not
> soften anything — someone is about to spend real money based on this.
>
> Answer these five questions and nothing else:
>
> 1. **Load-bearing assumptions.** List every assumption the plan rests on, ranked by how much
>    collapses if it is false. For each, say whether the plan offers evidence or just asserts it.
> 2. **The delta triple.** Is the claimed cost reduction real, or is it a rewording of the same
>    work? Would a customer actually notice the difference? Check the arithmetic.
> 3. **Fastest failure.** What is the most likely way this is dead in six months? Be specific —
>    name the mechanism, not "poor execution".
> 4. **The wedge.** Is the activity they are taking genuinely separable from the ones around it, or
>    have they drawn a line where customers do not experience one?
> 5. **What is missing.** What would you need to know that the plan does not tell you?
>
> Return findings only. No summary, no encouragement, no next steps.

## Using the result

- Every assumption the critic marks unevidenced becomes a **test item at the top of the checklist**.
- If the critic says the delta triple is a rewording rather than a real reduction, and you cannot
  refute it with a number, the verdict is **NO**.
- If the critic's fastest-failure scenario has no mitigation in the plan, the verdict caps at **GO IF**.

Do not argue the critic down to protect the plan. If the critic is wrong, refute it with a specific
number or fact and record the refutation in the plan. "The critic overstated this" is not a
refutation.

## Verdict

Then decide, plainly:

- **GO** — real weak link, favourable delta triple, monetization named, response survivable, no
  unmitigated fastest-failure.
- **GO IF** — conditional. The checklist becomes a **test list, not a spend list**, and says so in
  those words. Automatic cap when Gate 4 failed or when the critic found an unmitigated failure path.
- **NO** — no weak link, or the wedge only removes value-eroding work anyone can copy, or the delta
  triple is negative, or there is no way to charge. State which, and state what would change the answer.

A verdict without a reason is not a verdict. One sentence of reasoning minimum, naming the specific
gate or finding that drove it.
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/critic-brief.md
git commit -m "feat: critic-brief reference — cold agent dispatch and verdict rules"
```

---

## Task 9: references/first-1000.md

**Files:**
- Create: `skills/value-chain-launch/references/first-1000.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 5a — The first 1,000 customers

Ch. 7, derived from Airbnb, Uber, Etsy, and Rebag. Answer each principle **concretely for this
business**. A principle restated is not an answer.

| # | Principle | The question to answer |
|---|---|---|
| 1 | **Buy customers in bulk** | Which specific event, platform, group, or moment puts hundreds of your segment in one place? Airbnb launched into an oversubscribed design conference and the 2008 DNC; Etsy's founders worked large craft fairs. |
| 2 | **Don't confront competitors directly** | Which demand can the incumbent not serve, or refuse to? After concerts more people want cabs than exist. Full hotels during a convention. Take the overflow and stay under the radar. |
| 3 | **Do things that don't scale** | What will *you personally* do for the first 50 customers? Airbnb sent photographers to hosts' homes. "If you lack customers early on, you have nothing to scale." |
| 4 | **Incubate the early cohort** | How is the first cohort hand-held? **If two-sided, acquire the supply side first** — Rebag's founder spent his effort convincing women to sell bags, not on buyers. |
| 5 | **Use low-tech, offline tools** | The physical move: events, booths, flyers, door-knocking, phone calls. Airbnb's A/B test in France found on-the-ground tactics cost **5× less per acquisition** than Facebook ads. |
| 6 | **Operations before technology** | What stays manual until it works? Uber went door-to-door for its first drivers. A platform manager takes the buyer's hand and finds them a supplier, or neither returns. |
| 7 | **See it through the customer's eyes** | How do you personally walk your own chain as a customer — and as the supply side if two-sided? |

Answers must be specific enough to put in a calendar. "Attend industry events" fails principle 1.
"Book a booth at the regional dental association meeting on 14 March, which 400 clinic owners
attend" passes.

## Channels on the frontier

Ch. 7 (Fig 7.3): no established channel offers **both** high reach and high cost-effectiveness.
Rebag's founder found affiliates cheap but unscalable, niche cable TV limited in reach, and social
media higher reach but less effective. You start at the cheap-but-small end and move along the
frontier, giving up as little cost-effectiveness as possible for each increment of scale.

So sequence rather than pick:

| Order | Channel | Est. cost per customer | Realistic ceiling | How measured | **Kill rule** |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |

**Every channel gets a kill rule** — the specific number at which you stop spending. "Stop if cost
per acquisition exceeds $40 after 50 acquisitions" is a kill rule. "Monitor performance" is not.

The ceiling column matters as much as the cost column: a channel that acquires customers at $3 but
runs out at 200 customers cannot get you to 1,000. Say so in the plan rather than discovering it in
month four.
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/first-1000.md
git commit -m "feat: first-1000 reference — seven principles and the channel frontier"
```

---

## Task 10: references/coupling-growth.md

**Files:**
- Create: `skills/value-chain-launch/references/coupling-growth.md`

- [ ] **Step 1: Write the file**

````markdown
# Phase 5b — The next coupling move

Ch. 8. Once the wedge works, the usual question is "which adjacent market do we enter?" — which
yields fifty candidates, most of them wrong. Microsoft could have entered server OS, desktop apps,
hardware, small-business services, or consumer entertainment; it did several and produced both Office
and Zune.

Decoupling gives a much tighter constraint: **exactly two activities are truly adjacent to your
wedge** — the one immediately before it in the chain, and the one immediately after.

## The two candidates

| | Activity | What we would have to do | Integration cost test | Skills |
|---|---|---|---|---|
| Before | | | | build / borrow / buy |
| After | | | | build / borrow / buy |

**Integration cost test:** does owning both activities make the customer's **combined** cost lower
than using two separate vendors? If it does not, coupling gains you nothing — the customer has no
reason to consolidate. Microsoft's example: Outlook → Skype → LinkedIn, where each pair is cheaper
together than apart.

**Skills:** compare what the activity needs against what you have. Fill the gap by **building**
internally, **borrowing** via partnership, or **buying** through acquisition or hiring. Alibaba and
Airbnb both entered businesses where they lacked most of the required skills — and venture capital
paid for acquiring them. If you are not funded that way, say which of build/borrow/buy you can
actually afford.

## Two warnings from Ch. 8

- **A "me-too" offering is often enough.** The adjacent activity does not need to be best-in-class.
  Customers consolidate for the single login, single payment, single support desk. Only your
  original wedge must stay better than the alternatives.
- **Your customers decide what counts as adjacent, not you.** Coca-Cola thought coffee was adjacent
  to soft drinks; Colgate thought frozen dinners were adjacent to oral care. Both were discontinued.
  Brand managers consistently overestimate how far their brand stretches.

## Output

One named next activity, plus the **trigger** — the specific condition that says you are ready to
take it. A trigger is a number or an event ("once weekly retention is above 40% and we pass 800
customers"), not a date and not "when we're ready".
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/references/coupling-growth.md
git commit -m "feat: coupling-growth reference — adjacency, integration cost, build/borrow/buy"
```

---

## Task 11: templates/plan.md

**Files:**
- Create: `skills/value-chain-launch/templates/plan.md`

- [ ] **Step 1: Write the file**

````markdown
# {{BUSINESS_NAME}} — Launch Plan

> Generated by the `value-chain-launch` skill, {{DATE}}. Method: Thales Teixeira,
> *Unlocking the Customer Value Chain* (2019). {{RESEARCH_WARNING_IF_ANY}}

## Verdict: {{GO | GO IF | NO}}

{{One paragraph. Name the specific gate or critic finding that drove this.}}

{{If GO IF: "Do not spend acquisition money until the tests in Phase 5 pass."}}

## The segment

{{The narrow group, defined by the job they are getting done.}}

**Where they gather:** {{specific places, events, platforms}}

## The chain

| # | Stage | Activity | $ | Time | EIPs | Customer value | Firm charges? | Bond to next |
|---|---|---|---|---|---|---|---|---|
| 1 | trigger | | | | | | | |

**Weak links, ranked:**
1. {{between activity N and N+1 — cost borne, bond strength, why}}
2.
3.

## The wedge

**Activity taken:** {{one activity}}
**2×2 cell:** {{fortress / best wedge / vulnerable but violent / pure waste}}

| | Incumbent | Us | Delta |
|---|---|---|---|
| Money | | | |
| Time | | | |
| Effort | | | |

**Reading:** {{all three improve / one improves, name the winning segment / trade-off, name winner
and loser / nothing improves}}

## The four layers

| Layer | Description | Who performs which activity |
|---|---|---|
| 1 · Traditional | | |
| 2 · The digital version | | |
| 3 · Incremental innovation | | |
| 4 · Our disruptive model | | |

**Gate 4:** {{PASS — activity X moved from party A to party B / FAIL — nothing moved, this is
digitizing, verdict capped at GO IF}}

## How value gets charged

**Who pays:** {{end user / B2B / B2C / B2G / third party — name them}}
**For what activity:** {{}}
**{{If payer ≠ user}} The payer's chain:** {{5–6 activities including the approval step}}

## The incumbent

**Who they actually are:** {{}}
**What they charge, for which activity:** {{}}
**Already being decoupled by:** {{competitors found, or "no one found"}}
**Likely response:** {{recouple / rebalance — which, how fast, what specifically}}
**We stop being ignorable at:** {{revenue / customers / share threshold}}

## What the critic said

**Load-bearing assumptions:**
| Assumption | Evidence? | Test |
|---|---|---|

**Fastest failure:** {{}}
**Mitigation in this plan:** {{or "none — verdict capped"}}

## First 1,000 customers

| # | Principle | Our answer |
|---|---|---|
| 1 | Buy customers in bulk | |
| 2 | Don't confront competitors | |
| 3 | Do things that don't scale | |
| 4 | Incubate the early cohort | |
| 5 | Low-tech, offline tools | |
| 6 | Operations before technology | |
| 7 | See it through their eyes | |

## Channels

| Order | Channel | Cost/customer | Ceiling | Measured by | Kill rule |
|---|---|---|---|---|---|

## Next coupling move

**Next activity:** {{before or after the wedge}}
**Trigger to start:** {{a number or an event}}
**Skills gap:** {{build / borrow / buy}}

## Checklist

### Tests first {{— on GO IF these are the ONLY items until they pass}}
- [ ] {{action}} — owner: {{}} — done when: {{}} — proves: {{number}}

### Week 1–2
- [ ] {{action}} — owner: {{}} — done when: {{}} — proves: {{number}}

### Weeks 3–6
- [ ] {{action}} — owner: {{}} — done when: {{}} — proves: {{number}}

### To 1,000
- [ ] {{action}} — owner: {{}} — done when: {{}} — proves: {{number}}
````

- [ ] **Step 2: Commit**

```bash
git add skills/value-chain-launch/templates/plan.md
git commit -m "feat: markdown plan template"
```

---

## Task 12: templates/plan.html

**Files:**
- Create: `skills/value-chain-launch/templates/plan.html`

The skill fills the `{{...}}` regions and repeats the marked rows. Everything is inline — no CDN, no
external fonts, no remote images, no emojis.

- [ ] **Step 1: Write the file**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{BUSINESS_NAME}} — Launch Plan</title>
<style>
  :root {
    --bg: #fbfbfa; --fg: #1c1c1a; --muted: #6b6b66; --line: #e2e2dd; --card: #fff;
    --go: #1a7f4b; --goif: #a8700a; --no: #a52222;
    --creates: #d9ecdd; --erodes: #f6e0dd; --charge: #1c1c1a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17171a; --fg: #e9e9e6; --muted: #9a9a94; --line: #2f2f34; --card: #1e1e22;
      --go: #5cc98a; --goif: #d9a441; --no: #e07070;
      --creates: #1f3a2a; --erodes: #3a2020; --charge: #e9e9e6;
    }
  }
  :root[data-theme="dark"] {
    --bg: #17171a; --fg: #e9e9e6; --muted: #9a9a94; --line: #2f2f34; --card: #1e1e22;
    --go: #5cc98a; --goif: #d9a441; --no: #e07070;
    --creates: #1f3a2a; --erodes: #3a2020; --charge: #e9e9e6;
  }
  :root[data-theme="light"] {
    --bg: #fbfbfa; --fg: #1c1c1a; --muted: #6b6b66; --line: #e2e2dd; --card: #fff;
    --go: #1a7f4b; --goif: #a8700a; --no: #a52222;
    --creates: #d9ecdd; --erodes: #f6e0dd; --charge: #1c1c1a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .25rem; letter-spacing: -.02em; }
  h2 { font-size: 1.15rem; margin: 2.75rem 0 .85rem; letter-spacing: -.01em; }
  .sub { color: var(--muted); font-size: .875rem; margin: 0 0 2rem; }
  .verdict {
    border: 2px solid currentColor; border-radius: .6rem; padding: 1rem 1.25rem; margin: 0 0 2rem;
  }
  .verdict.go { color: var(--go); } .verdict.goif { color: var(--goif); } .verdict.no { color: var(--no); }
  .verdict h2 { margin: 0 0 .4rem; font-size: 1.3rem; text-transform: uppercase; letter-spacing: .06em; }
  .verdict p { margin: 0; color: var(--fg); }
  .warn {
    border-left: 3px solid var(--no); background: var(--card); padding: .7rem 1rem;
    margin: 0 0 1.5rem; font-size: .9rem;
  }
  .triple { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1rem 0; }
  .triple div {
    flex: 1 1 9rem; background: var(--card); border: 1px solid var(--line);
    border-radius: .5rem; padding: .9rem 1rem;
  }
  .triple span { display: block; color: var(--muted); font-size: .75rem;
    text-transform: uppercase; letter-spacing: .07em; }
  .triple strong { font-size: 1.5rem; font-weight: 650; letter-spacing: -.02em; }
  .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .chain { display: flex; gap: .5rem; padding-bottom: .5rem; min-width: min-content; }
  .stage { flex: 0 0 auto; }
  .stage > span {
    display: block; color: var(--muted); font-size: .7rem; text-transform: uppercase;
    letter-spacing: .08em; margin-bottom: .35rem;
  }
  .acts { display: flex; gap: .35rem; }
  .act {
    flex: 0 0 8.5rem; border: 1px solid var(--line); border-radius: .45rem;
    padding: .55rem .6rem; font-size: .78rem; line-height: 1.35; background: var(--card);
  }
  .act.creates { background: var(--creates); }
  .act.erodes  { background: var(--erodes); }
  .act.charges { border-color: var(--charge); border-width: 2px; }
  .act b { display: block; font-weight: 600; margin-bottom: .2rem; }
  .act em { font-style: normal; color: var(--muted); font-size: .72rem; }
  .quad { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin: 1rem 0; }
  .quad > div { border: 1px solid var(--line); border-radius: .5rem; padding: .85rem;
    background: var(--card); min-height: 6.5rem; }
  .quad h3 { margin: 0 0 .4rem; font-size: .8rem; text-transform: uppercase;
    letter-spacing: .06em; color: var(--muted); }
  .quad ul { margin: 0; padding-left: 1.05rem; font-size: .82rem; }
  table { border-collapse: collapse; width: 100%; font-size: .875rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--line);
    vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: .74rem;
    text-transform: uppercase; letter-spacing: .06em; }
  ul.check { list-style: none; padding: 0; margin: .5rem 0 0; }
  ul.check li { display: flex; gap: .6rem; align-items: flex-start; padding: .45rem 0;
    border-bottom: 1px solid var(--line); }
  ul.check input { margin-top: .35rem; flex: 0 0 auto; }
  ul.check em { font-style: normal; color: var(--muted); display: block; font-size: .8rem; }
  @media (max-width: 34rem) { .quad { grid-template-columns: 1fr; } }
  @media print {
    body { background: #fff; color: #000; padding: 0; font-size: 11pt; }
    .verdict { border-color: #000; color: #000; }
    .act, .quad > div, .triple div { background: #fff; border-color: #999; }
    h2 { break-after: avoid; } table, .quad, .triple { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>

  <h1>{{BUSINESS_NAME}}</h1>
  <p class="sub">Launch plan &middot; {{DATE}} &middot; segment: {{SEGMENT}}</p>

  <!-- Omit entirely unless research failed -->
  <div class="warn">{{RESEARCH_WARNING}}</div>

  <!-- class = go | goif | no -->
  <div class="verdict go">
    <h2>{{VERDICT}}</h2>
    <p>{{VERDICT_REASON}}</p>
  </div>

  <h2>The delta</h2>
  <div class="triple">
    <div><span>Money</span><strong>{{DELTA_MONEY}}</strong></div>
    <div><span>Time</span><strong>{{DELTA_TIME}}</strong></div>
    <div><span>Effort</span><strong>{{DELTA_EIPS}}</strong></div>
  </div>
  <p class="sub">{{DELTA_READING}}</p>

  <h2>The customer value chain</h2>
  <div class="scroll">
    <div class="chain">
      <!-- Repeat one .stage per stage; one .act per activity.
           class: creates|erodes, plus charges if the firm charges there -->
      <div class="stage">
        <span>Trigger</span>
        <div class="acts">
          <div class="act erodes"><b>{{ACTIVITY}}</b><em>{{$}} &middot; {{TIME}} &middot; {{EIPS}} EIP</em></div>
        </div>
      </div>
    </div>
  </div>
  <p class="sub">Green creates value &middot; red erodes it &middot; thick border means somebody charges there</p>

  <h2>Where the money and the value sit</h2>
  <div class="quad">
    <div><h3>Creates value &middot; charged for</h3><ul>{{FORTRESS_ITEMS}}</ul></div>
    <div><h3>Creates value &middot; not charged</h3><ul>{{BEST_WEDGE_ITEMS}}</ul></div>
    <div><h3>Erodes value &middot; charged for</h3><ul>{{VULNERABLE_ITEMS}}</ul></div>
    <div><h3>Erodes value &middot; not charged</h3><ul>{{WASTE_ITEMS}}</ul></div>
  </div>

  <h2>The incumbent</h2>
  <table>
    <tr><th>Who</th><td>{{INCUMBENT}}</td></tr>
    <tr><th>Charges for</th><td>{{INCUMBENT_CHARGES}}</td></tr>
    <tr><th>Likely response</th><td>{{RESPONSE}}</td></tr>
    <tr><th>Ignorable until</th><td>{{THRESHOLD}}</td></tr>
  </table>

  <h2>Channels</h2>
  <table>
    <thead><tr><th>#</th><th>Channel</th><th>Cost/customer</th><th>Ceiling</th><th>Kill rule</th></tr></thead>
    <tbody>{{CHANNEL_ROWS}}</tbody>
  </table>

  <h2>Checklist</h2>
  <!-- Repeat this block per phase: Tests first, Week 1-2, Weeks 3-6, To 1,000 -->
  <h3>{{PHASE_NAME}}</h3>
  <ul class="check">
    <li>
      <input type="checkbox">
      <span>{{ACTION}}<em>{{OWNER}} &middot; done when {{DONE_WHEN}} &middot; proves {{METRIC}}</em></span>
    </li>
  </ul>

</main>
</body>
</html>
```

- [ ] **Step 2: Verify it is fully self-contained**

Run: `grep -nE "https?://|src=|@import|cdn|fonts\.googleapis" skills/value-chain-launch/templates/plan.html`
Expected: **no matches.** Any match is a bug — the page must render with no network.

- [ ] **Step 3: Verify there are no emojis**

Run: `grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}]" skills/value-chain-launch/templates/plan.html`
Expected: no matches.

If this build of grep lacks `-P` it will error with "invalid option". In that case read the file
and confirm visually — the only non-ASCII characters that belong in it are `&middot;` HTML entities,
which are written as entities, not literal characters.

- [ ] **Step 4: Open it in a browser and confirm it renders**

Run: `start skills/value-chain-launch/templates/plan.html`
Expected: page renders with `{{...}}` tokens visible, no layout breakage, no console errors.

- [ ] **Step 5: Commit**

```bash
git add skills/value-chain-launch/templates/plan.html
git commit -m "feat: self-contained HTML one-pager template"
```

---

## Task 13: Deploy to the skills directory

**Files:**
- Create: `C:\Users\user\.claude\skills\value-chain-launch\` (copy of the repo directory, minus `tests/`)

- [ ] **Step 1: Copy the skill into place**

```powershell
$src = "c:\Users\user\Desktop\ailos-agentic system\skills\value-chain-launch"
$dst = "C:\Users\user\.claude\skills\value-chain-launch"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse -Force $src $dst
Remove-Item -Recurse -Force "$dst\tests"
Get-ChildItem -Recurse $dst | Select-Object -ExpandProperty FullName
```

Expected output: `SKILL.md`, seven files under `references\`, two under `templates\`. No `tests\`.

- [ ] **Step 2: Verify Claude Code can see the skill**

Start a new Claude Code session in any directory and confirm `value-chain-launch` appears in the
available-skills list. If it does not, the frontmatter failed to parse — check that `---` fences are
on their own lines and that `name` uses only letters and hyphens.

- [ ] **Step 3: Record the deploy command in the repo for future edits**

Create `skills/value-chain-launch/DEPLOY.md`:

```markdown
# Deploying this skill

`~/.claude` is not version controlled, so this repo is the source of truth and the skills
directory is a deployed copy. **After every edit, re-run:**

```powershell
$src = "c:\Users\user\Desktop\ailos-agentic system\skills\value-chain-launch"
$dst = "C:\Users\user\.claude\skills\value-chain-launch"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse -Force $src $dst
Remove-Item -Recurse -Force "$dst\tests"
```

Editing the deployed copy directly loses the change on the next deploy.
```

- [ ] **Step 4: Commit**

```bash
git add skills/value-chain-launch/DEPLOY.md
git commit -m "docs: deploy procedure for value-chain-launch skill"
```

---

## Task 14: Verify the gates fire (GREEN)

This is "watch the test pass". Every scenario from Task 1 now runs **with** the skill present.

- [ ] **Step 1: Run T1, T2, T3 (chain structure gates)**

Dispatch three fresh subagents. Each is told: "Use the `value-chain-launch` skill", then given the
scenario prompt verbatim.

Expected: all three stop and name Gate 2. T2 must specifically apply the granularity rule to
"customer buys the laptop". T3 must specifically name the empty **trigger** and **re-need** stages.

- [ ] **Step 2: Run T4, T6, T8 (the other gates)**

Expected: T4 stops at Gate 3, T6 stops at Gate 5 and rejects "monetize later", T8 stops at Gate 1
and does not silently narrow the segment.

- [ ] **Step 3: Run T5 (Gate 4 — the self-deception test)**

Expected: fills the four-layer table, finds layer 4 identical to layer 2, uses the words
"digitizing, not decoupling", and caps the verdict at GO IF.

- [ ] **Step 4: Run T7 (currency separation)**

Expected: reports −2 days / +~10 EIPs / $0 as a trade-off, names time-sensitive buyers as the
winning segment and effort-sensitive as the losing one. Any single netted score is a failure.

- [ ] **Step 5: Run T9 (pressure — the critical one)**

Expected: does not skip the gates despite the deadline, the seniority claim, and the direct request.
Producing the checklist "just this once" is a failure. Asking permission to skip and then skipping
is a failure.

- [ ] **Step 6: Record results**

Append to `skills/value-chain-launch/tests/baseline.md`:

```markdown
## GREEN — behaviour with the skill (YYYY-MM-DD)

| Scenario | Result | Notes |
|---|---|---|
| T1 | PASS/FAIL | |
| T2 | PASS/FAIL | |
| T3 | PASS/FAIL | |
| T4 | PASS/FAIL | |
| T5 | PASS/FAIL | |
| T6 | PASS/FAIL | |
| T7 | PASS/FAIL | |
| T8 | PASS/FAIL | |
| T9 | PASS/FAIL | |
```

- [ ] **Step 7: Commit**

```bash
git add skills/value-chain-launch/tests/baseline.md
git commit -m "test: GREEN phase results for value-chain-launch gates"
```

---

## Task 15: Close the loopholes (REFACTOR)

- [ ] **Step 1: List every new rationalization from Task 14**

For each FAIL, write down the agent's exact words. These are new loopholes — they were not in the
baseline, so nothing in `SKILL.md` counters them yet.

- [ ] **Step 2: Add a counter for each**

Add a row to the rationalization table in `SKILL.md`, or a bullet to the red flags list — whichever
fits. Keep the wording specific to the excuse, not general. A row reading "be rigorous" counters
nothing.

Example of the right shape, if T9 failed with *"the user explicitly waived the analysis, so I
respected their decision"*:

```markdown
| "They waived the analysis, so I respected their choice" | They can decline the plan. They cannot decline the parts that make it correct. Offer to stop entirely; do not offer a checklist without a chain. |
```

- [ ] **Step 3: Redeploy and re-run only the failed scenarios**

```powershell
$src = "c:\Users\user\Desktop\ailos-agentic system\skills\value-chain-launch"
$dst = "C:\Users\user\.claude\skills\value-chain-launch"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse -Force $src $dst
Remove-Item -Recurse -Force "$dst\tests"
```

Expected: previously failing scenarios now pass. If a new rationalization appears, repeat steps 1–3.
Stop when a full pass produces no new loopholes.

- [ ] **Step 4: Commit**

```bash
git add skills/value-chain-launch/SKILL.md skills/value-chain-launch/tests/baseline.md
git commit -m "fix: close rationalization loopholes found in gate testing"
```

---

## Task 16: End-to-end run (T10)

- [ ] **Step 1: Ask the owner which business to run it against**

It must be a real one with a genuine incumbent. Do not invent a test business — the point is to find
out whether the skill produces something the owner can act on.

- [ ] **Step 2: Run the skill end to end**

Expected: all five phases complete, a cold critic is dispatched via the Agent tool, a verdict with
reasoning is produced, and two files are written to `docs/gtm/`.

- [ ] **Step 3: Verify the HTML output offline**

```powershell
$f = (Get-ChildItem "docs\gtm\*.html" | Select-Object -Last 1).FullName
Select-String -Path $f -Pattern "https?://|@import|cdn\." -AllMatches
start $f
```

Expected: no matches from `Select-String`. In the browser: renders correctly, chain strip scrolls
horizontally without the page scrolling, checkboxes tick, and Ctrl+P shows a clean print preview.
Toggle OS dark mode and confirm both themes read correctly.

- [ ] **Step 4: Have the owner read the markdown plan**

The real test is whether a non-technical reader can act on it without asking what anything means.
Anything they have to ask about is a defect in the template or the reference wording — fix it, then
redeploy and note the fix.

- [ ] **Step 5: Commit any fixes**

```bash
git add skills/value-chain-launch
git commit -m "fix: template and wording fixes from end-to-end run"
```

---

## Task 17: Final verification and record

- [ ] **Step 1: Confirm the full file set exists in both locations**

```powershell
Get-ChildItem -Recurse "skills\value-chain-launch" | Select-Object -ExpandProperty FullName
Get-ChildItem -Recurse "C:\Users\user\.claude\skills\value-chain-launch" | Select-Object -ExpandProperty FullName
```

Expected: repo has **13** files — `SKILL.md`, `DEPLOY.md`, 7 references, 2 templates, 2 tests.
Deployed copy has **11** — the same minus `tests/`. (`DEPLOY.md` rides along harmlessly; it did not
exist yet during Task 13's first copy, but every redeploy from Task 15 onward includes it.)

- [ ] **Step 2: Confirm every scenario passes**

Re-read `tests/baseline.md`. Every row in the GREEN table must read PASS. Any FAIL means Task 15 is
not finished — go back.

- [ ] **Step 3: Note the skill in the repo README or CLAUDE.md map**

Add one line under the Map section of `CLAUDE.md`:

```markdown
- `skills/` — Claude Code skills authored here, deployed to `~/.claude/skills/` (see each skill's `DEPLOY.md`)
```

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md skills/value-chain-launch
git commit -m "feat: value-chain-launch skill complete, all gate tests passing"
```

---

## Self-review notes

**Spec coverage checked.** Every section of
`docs/superpowers/specs/2026-08-01-value-chain-launch-skill-design.md` maps to a task: six-stage
chain and three currencies → Task 4; the 2×2 and Gate 3 → Task 5; delta triple, four layers, payer
chain → Task 6; research and counter-move → Task 7; cold critic and verdict → Task 8; first-1,000
and channels → Task 9; coupling growth → Task 10; both templates → Tasks 11–12; all eight
verification cases from the spec → Tasks 1, 14, 16.

**One deliberate deviation from the spec.** The spec put the skill only at
`~/.claude/skills/value-chain-launch/`. That directory is not version controlled, so this plan
authors it in the repo and deploys a copy (Task 13). Same runtime result, plus history.

**Known thin spot.** Task 2's baseline depends on subagent behaviour that cannot be predicted here,
so Task 3's rationalization table is a starting set, not a final one. Task 15 exists to finish it,
and Task 17 Step 2 refuses to close the plan while any scenario still fails.
