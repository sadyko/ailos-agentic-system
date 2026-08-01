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
too coarse: split it.

Zero EIPs is *usually* a sign it is not an activity but a state or a feeling ("wants a new car",
"feels frustrated") — delete those. But **passive consumption is a real activity with near-zero
effort**: sitting in the chair while your hair is cut, waiting for a delivery, sitting through the
appointment. These cost real time or real money while demanding almost no cognitive steps, and the
whole *consume* stage is often made of them.

So the actual test is: **zero EIPs AND zero time AND zero money = not an activity.** If any one of
the three currencies is non-zero, keep it and write `0` in the EIP column honestly.

Never inflate an EIP count to satisfy a rule. A fabricated `1` in the effort column corrupts the
delta triple, which is the one number the whole method exists to produce.

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
