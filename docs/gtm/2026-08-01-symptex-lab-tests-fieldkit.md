# Symptex lab aggregator — the week-one test pack

> Run these **before** any design or engineering. Three of them are existential: if any one fails,
> the lab aggregator cannot work as conceived and you will have found out for the price of a few
> phone calls instead of a quarter of build.
>
> Each test has a **stop number**. A test without a threshold can only be argued satisfied, never
> failed — so the thresholds below are the point of the exercise, not decoration.

**Decided:** the product prices a referral basket across labs, then hands the patient off (address,
hours, prep rules, phone/Telegram). No booking. That means "do labs take appointments" drops from
existential to useful-later.

---

## TEST 1 — Will a lab publish prices to a comparison platform?

**Existential.** If labs refuse, there is no product. Not a weak product — none.

**Why this is in doubt:** clinics.uz already built the listing for **407 providers**, and every single
price on it reads *«цена по звонку»*. That is either an empty niche or 407 refusals. Nobody has
established which.

**Who:** the commercial director or marketing head — not reception, not a branch manager. Three
labs minimum, from different tiers: one large network (Gemotest, SWISS LAB), one mid (LABNET, TTD),
one clinic-attached lab.

**Ask, in this order:**

1. «Ваш прайс на анализы публично доступен на сайте? Можем ли мы его показывать у себя?»
2. «Если бы пациент пришёл к вам, потому что увидел вашу цену на нашем сайте — это для вас плюс
   или минус?»
3. «Готовы ли вы отдавать нам прайс-лист файлом или по API, и как часто он меняется?»
4. «Что вас останавливает от публикации цен сегодня?» ← **the most informative question. Listen
   to the whole answer and write it down verbatim.**
5. **Bonus, ask while you have them:** «Сколько бы вы заплатили за одного пациента, который пришёл
   к вам по нашей рекомендации?» — this is your monetization answer, and it costs nothing to ask.

**STOP NUMBER:** if **0 of 3** will commit to a shareable, regularly-updated price list — stop.
If 1 of 3 will, the product is possible but you have a one-lab dependency, which is not a
comparison site.

---

## TEST 2 — Is there a real price spread on *identical* tests?

**Existential.** If every lab charges roughly the same, there is nothing to compare and no reason
for a patient to use you.

**Why this is in doubt:** the only two prices verified so far are **not the same product** —
Gemotest's *ОАК без лейкоцитарной формулы* at 29,000 and lab-net's *ОАК 25 параметров* at 75,000
are different tests. The apparent 87% gap may be entirely an artefact of different panel
definitions. This is the single most load-bearing unverified fact in the whole plan.

**Method:** five labs, same day, these five tests. Four are internationally unambiguous so the
comparison is honest; ОАК is included *because* it is ambiguous, to measure how bad the naming
problem is.

| Test | Why chosen |
|---|---|
| Глюкоза (венозная, натощак) | unambiguous everywhere |
| ТТГ (TSH) | unambiguous, common on referrals |
| Общий холестерин | unambiguous |
| Креатинин | unambiguous |
| ОАК | **deliberately ambiguous** — record the parameter count each lab quotes |

**Fill this in:**

| Lab | Глюкоза | ТТГ | Холестерин | Креатинин | ОАК (n params) | Забор крови (separate?) | Turnaround | Home collection + price |
|---|---|---|---|---|---|---|---|---|
| Gemotest | | | | | | | | |
| SWISS LAB | | | | | | | | |
| LABNET | | | | | | | | |
| TTD | | | | | | | | |
| Intermed | | | | | | | | |

**Record the collection fee separately.** Gemotest charges 11,000 on top; a naive comparison that
ignores it is wrong, and it is exactly the kind of hidden cost your product would exist to surface.

**STOP NUMBER:** compute the spread on the four unambiguous tests as
`(highest − lowest) ÷ lowest`, using **basket totals including collection fees**.

- **Under 15% → stop.** A typical basket runs 50,000–150,000 UZS and travel to a non-nearest lab
  costs roughly 10,000 UZS round trip. Below ~15% the saving is eaten by the trip, so no patient
  will act on it and the comparison has no value.
- **15–30% →** real but thin. The product works only if you also remove effort, not just money.
- **Over 30% →** the wedge is real on money alone.

Also record, from the ОАК row: **how many different names and parameter counts** you got for what a
doctor writes as one word. That number is the size of the problem your product actually solves, and
it may turn out to be the more valuable finding than price.

---

## TEST 3 — Does med24.uz already do this?

**Existential.** It claims 230 clinics, **200+ laboratories**, prices, reviews and online booking.
If that is real, the wedge is occupied by an incumbent with listings and traffic you do not have.

**Why this is unresolved:** it returned HTTP 503 twice from outside Uzbekistan. That is not evidence
of absence — geo-blocking and bot filtering produce exactly that. **It has to be opened from a local
phone.**

**What to check, with screenshots:**

1. Pick one specific test. Does med24 show a **real number** for it, at **more than one lab**?
2. Or does it show *«цена по звонку»* like clinics.uz?
3. Is there a booking button that actually completes, or only a phone number?
4. Can you price a **basket of 5 tests at once**, or only one test at a time?

**STOP NUMBER:** if med24 shows real per-test prices at **3 or more labs** *and* can price a
multi-test basket — stop and rethink. If it shows prices but only one test at a time, the
basket is still open and that is your differentiator. If it shows *«цена по звонку»*, the field
is clear.

---

## TEST 4 — Do labs take appointments? *(useful, not existential)*

Since the product hands off rather than books, this no longer gates anything. Ask it anyway while
you are on the phone, because it tells you whether a booking upsell exists later.

«Пациент может записаться на конкретное время, или это живая очередь?»

---

## What "pass" means

All three existential tests clear their stop numbers → design the aggregator, and re-run the full
value-chain analysis with real figures. The earlier **NO** verdict was issued on a clinic-pays,
booking-based framing; a labs-pay, price-and-hand-off product is a different configuration and
deserves its own honest verdict rather than inheriting that one.

Any one existential test fails → stop, and say which. The most likely useful salvage is the one the
chain analysis already ranked highest: **helping patients understand results**, which sits next to
the only activity in the entire chain that anyone pays for, and which the 423 published analysis
articles already half-build.

## Where to write the answers

Fill the tables in this file and commit it. Do not keep the answers in a chat or a notebook — the
next person to touch this, including future-you, needs to see the numbers and the date they were
taken, because lab prices move.
