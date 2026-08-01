# value-chain-launch — test scenarios

Each scenario is a prompt given verbatim to a subagent. Run every scenario twice:
**baseline** (no skill in context, record in `baseline.md`) and **verify** (skill present).

A scenario passes only if the **Pass** condition is met. "The agent mentioned it" is not passing —
the agent must actually stop, or actually produce the required structure.

## Isolation — required, learned the hard way

A subagent with filesystem access **will find this file** by grepping the repo for the scenario's
topic keyword, read the Pass/Fail criteria, and answer to the rubric. On the first baseline run
three of four did exactly that and reported the contamination themselves.

- **Baseline runs** must be prefixed with: *"Answer entirely from your own knowledge. Do NOT read,
  search, glob, or grep any files, and do not browse the web."*
- **Verify runs** must be prefixed with: *"Use the value-chain-launch skill for this. Do not read
  any files in the current repository other than the skill's own files under
  `~/.claude/skills/value-chain-launch/`. Do not create or modify any files."*

The deployed copy of the skill excludes `tests/`, so a verify run reading its own reference files
cannot reach this rubric. Repo access is what leaks it.

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

---

## T5b — Layer 2 costume, segment supplied (added after the first GREEN run)

T5 as written stops at Gate 1, so it never reaches Gate 4 — the gate it was designed to test.
T5b supplies a passing segment and a passing chain so Gate 4 actually fires. **Run both.**

> Segment: men aged 25-40 working in the Chilanzar business district of Tashkent who get a fade
> every 2-3 weeks and currently lose a lunch break to the walk-in wait. I can name 20 of them —
> they're my coworkers and their friends, and they all use the four barbershops within 500m of the
> Chilanzar metro.
>
> Their chain:
> 1. (trigger) catches sight of their hairline in a mirror and decides it's getting scruffy — 0 UZS, instant, 1 EIP
> 2. (trigger) checks their calendar for a free lunch slot this week — 0, 2 min, 2 EIPs
> 3. (evaluate) mentally lists the four shops near the metro — 0, 1 min, 1 EIP
> 4. (evaluate) tries to remember which was least busy last time — 0, 1 min, 2 EIPs
> 5. (evaluate) sometimes phones one shop to ask if there's a queue — 0, 3 min, 3 EIPs
> 6. (choose) picks a shop, usually the closest — 0, instant, 1 EIP
> 7. (choose) decides whether to go now or after lunch — 0, 1 min, 2 EIPs
> 8. (purchase) walks over — 0, 8 min, 1 EIP
> 9. (purchase) waits in the shop for a chair — 0, 25 min average, 1 EIP
> 10. (purchase) tells the barber what they want — 0, 2 min, 3 EIPs
> 11. (purchase) pays cash at the chair — 60,000 UZS, 2 min, 2 EIPs
> 12. (consume) gets the cut — 0, 30 min, 0 EIPs
> 13. (consume) checks the result in the mirror, sometimes asks for a tidy-up — 0, 3 min, 2 EIPs
> 14. (re-need) notices it growing out about 2 weeks later — 0, instant, 1 EIP
>
> My disruptive idea: an app where you book a barber instead of walking in. Same barbers, same
> haircut, same price, you just book on your phone. This decouples booking from the visit. Plan the launch.

**Pass:** builds the four-layer table, finds layer 4's *who performs which activity* column
unchanged from layer 2, states the digitizing-not-decoupling diagnosis, and returns **NO** or
**GO IF** — never GO. Any repair it proposes must be explicitly labelled as a separate proposal,
not folded into the verdict on the idea as stated.
**Fail:** returns GO; or silently plans a better idea; or accepts "decouples booking from the visit"
without testing who performs what.

**Note activity 12 — `0 EIPs` is deliberate.** Getting a haircut costs 30 minutes and almost no
cognitive steps. This row exists to catch any future rule that treats zero effort as proof
something is not an activity. An agent that inflates it to 1 EIP to satisfy a rule has failed,
because a fabricated effort number corrupts the delta triple.
