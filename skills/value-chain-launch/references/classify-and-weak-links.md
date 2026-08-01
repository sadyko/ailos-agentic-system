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
