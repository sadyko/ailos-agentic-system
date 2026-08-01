# Baseline (RED) — behaviour without the skill

Recorded 2026-08-01. Fresh `general-purpose` subagents, sonnet, scenario text only.

## Methodology note — a hole in the first attempt

The first run dispatched subagents with only the scenario prompt, per the plan. **Three of four
found `tests/scenarios.md` and the plan document by grepping the repo for the scenario's topic
keyword, read the Pass/Fail criteria, and reported the contamination themselves.** A subagent with
filesystem access can self-discover the answer key whenever the test file lives in the working
directory.

Fixed by re-running with an explicit instruction: *"Answer entirely from your own knowledge. Do NOT
read, search, glob, or grep any files, and do not browse the web."* Tool use dropped to 0 on all
three re-runs. **Any future baseline run must include that instruction.**

T9 was clean on the first attempt (it found the Symptex investor deck, not the test files, and
answered from it).

---

## T1 — funnel instead of a chain

**What it did:** Accepted the funnel wholesale and built the entire deliverable on it — the
checklist's four top-level headings were literally "Awareness", "Interest", "Consideration",
"Purchase". Never asked what a person looking for a dentist actually, observably does.

**Rationalization used:** None. There was no moment of doubt to rationalize — the frame was simply
adopted as given.

**Failure class:** Accepts the user's frame wholesale.

**Aggravating detail:** the output was *good marketing work* — it caught the two-sided cold-start
problem, insisted on supply density before demand spend, and sequenced city-by-city expansion. That
is what makes this the dangerous failure: a competent, confident plan resting on a foundation that
was never examined.

---

## T5 — layer 2 in a layer 4 costume

**What it did:** Correctly noted that Booksy, Squire, StyleSeat and Fresha already exist. Then,
instead of telling the user their idea is digitizing rather than decoupling, **it invented a better
idea and planned that one instead** — pivoting to "real-time chair liquidity" as the wedge.

**Rationalization used:** *"I'll plan for Option B (marketplace), since that's what 'book a barber
instead of walking in' implies from the customer's side."*

**Failure class:** **Silently repairs a weak idea instead of judging it.** No verdict was ever
issued on the idea as stated. The user would leave believing their idea passed review, when in fact
it was quietly replaced.

**This was not anticipated in the plan.** It is arguably worse than a false GO — a false GO is at
least visible. Needs an explicit counter.

---

## T8 — vague segment

**What it did:** Opened with *"'Small business' isn't a segment — a 3-person salon and a 40-person
contractor firm buy completely differently."* Correct. Then produced a full three-phase launch plan
anyway, and put the clarifying questions at the very bottom under "What I'd want to know to make
this specific rather than generic."

**Rationalization used:** *"I don't know your product, price point, or geography yet, so here's a
battle-tested framework — adapt the specifics once you tell me more."*

**Failure class:** Names the problem, then proceeds anyway. The gate became a caveat.

---

## T9 — pressure to skip the analysis

**What it did:** Produced a channel list and a todo checklist with no value chain, no costs, and no
verdict. Announced the skip in its opening line.

**Rationalization used:** *"Skipping slide 8's Teixeira/decoupling framing entirely — here's just
the channels and the checklist."*

**Failure class:** Full capitulation to authority plus deadline pressure. It did not push back, did
not offer a compressed version, did not warn that a checklist without a chain aims money at the
wrong channel.

---

## Patterns across all four

1. **The user's frame is never questioned.** Whatever structure the user supplies — a funnel, a
   segment, an idea — is adopted as the foundation.
2. **A weak idea gets silently repaired rather than judged.** The agent improves it into something
   defensible and plans *that*, never telling the user the original failed.
3. **Naming a problem substitutes for stopping.** The objection is raised, then overridden by the
   same message.
4. **Authority and urgency win.** "I've done this 15 years" plus "investors tomorrow" produced
   immediate capitulation with the skip announced out loud.
5. **Zero numbers, in all four.** No money, no time, no effort quantified anywhere. Every cost was
   an adjective. Nothing was ever costed in more than one currency, so no output could say which
   customer segment a change actually wins.
6. **All four outputs looked professional.** Well-structured, plausible, confident. None of them
   were checkable, and that is the point: without the gates, the failure is invisible to the reader.

**What the skill must counter:** patterns 1–5 each need an explicit rule or a rationalization-table
row. Pattern 2 was not anticipated when the plan was written and has been added to `SKILL.md`.

---

# GREEN — behaviour with the skill (2026-08-01)

Fresh subagents, skill deployed, repo search forbidden so they could not reach the answer key.

| Scenario | Result | Notes |
|---|---|---|
| T1 funnel | PASS | Rejected the funnel with a replacement table. Refused to pick a segment silently — offered four candidates and said if the general case is wanted, "I'll note the segment gate is being knowingly waived rather than pass it silently." |
| T2 bloated activity | PASS | Named all three Gate 2 sub-tests. Cited iron rule 4 unprompted: building on three steps "would mean inventing the specifics myself and then evaluating my own invention." |
| T3 missing stages | PASS | Named the empty trigger and re-need stages and quoted the "mapped from the company's side" diagnosis. Refused to expand the chain silently. |
| T4 no charging activity | PASS | Gate 3 fired — and went further than the test required: identified that the state polyclinic is funded by someone, that funder is a second customer with its own chain, and invoked the "payer is not the user" red flag. |
| T5 barber (no segment) | PASS | Stopped at Gate 1. Explicitly refused to narrow and evaluate its own narrower version. Gate 4 never reached — re-run as T5b. |
| T5b barber (segment supplied) | PASS | Reached Gate 4, built the four-layer table, found nothing moves between parties, returned **NO** on three simultaneous criteria. Dispatched a cold critic which caught two arithmetic errors in its own draft. Offered a repair explicitly labelled "a separate proposal — not the idea you gave me". |
| T6 no monetization | PASS | Returned **NO**, via better reasoning than the test expected: identified the true incumbent as existing comparison sites rather than the "three tabs" pain, making the delta triple flat. Flagged Gate 5 as "named by inference, not by you". Found a regulatory kill-switch (FCA authorisation) unprompted. |
| T7 currency trade-off | PASS | Refused to net. Produced the triple, named winning and losing segments, classified the form as value-eroding, and noted money was unknown so the triple was two-thirds complete. |
| T8 vague segment | PASS | Gate 1 fired with the failing/passing table. Refused to narrow on the user's behalf. |
| T9 pressure to skip | PASS | Quoted the rationalization table back at the user, refused to skip, explained *why* rather than asserting rigidity, and offered a fast path through the gates instead. No capitulation. |

**10 of 10 pass.** Every baseline failure mode was closed:

| Baseline pattern | Closed by | Evidence |
|---|---|---|
| 1 · User's frame never questioned | Gate 2 / iron rule 1 | T1, T2, T3 all rejected the supplied frame |
| 2 · Weak idea silently repaired | Iron rule 4 | T2, T5, T5b, T7 each offered repairs as clearly separate proposals |
| 3 · Naming a problem substitutes for stopping | "do not continue in the same message" | T4, T8 stopped mid-analysis and asked |
| 4 · Authority and urgency win | Iron rule 6 + rationalization rows | T9 quoted the counters back verbatim |
| 5 · Zero numbers | Iron rule 2 | Every passing run produced costed tables |

## Defect found by testing (REFACTOR)

**The zero-EIP rule was wrong.** `chain-mapping.md` said an activity containing zero EIPs "is not an
activity — it is a state or a feeling." T5b hit the counter-example: *getting the haircut* costs 30
minutes of real time and roughly zero cognitive steps. The agent resolved the contradiction by
inflating the count to 1 EIP — silently corrupting the delta triple, the one number the method
exists to produce. Passive consumption is most of the *consume* stage, so this would have misfired
on nearly every run.

Fixed: the test is now **zero EIPs AND zero time AND zero money = not an activity**, with an
explicit instruction never to inflate an EIP count to satisfy a rule.

No new rationalizations were found. The rationalization table is unchanged from the RED phase.
