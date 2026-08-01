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
