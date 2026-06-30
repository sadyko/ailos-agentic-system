# Gates

A STEP or STAGE advances only by passing a gate. **Every verdict cites the artifact it judges. No verdict without evidence on disk.**

## PASS
All acceptance criteria met with on-disk evidence; tests green; every controller green.
Action: write the artifact, commit, and advance `last_verified_commit`.

## REWORK
Defects found. The verdict must cite the artifact and the specific failing criterion.
Action: return to the producing role with the cited failures. Increment the try counter.
Bound: **2 retries (3 total tries).** On exhaustion: halt the STEP, append to `30_BUILD/issues.md`, and do NOT commit.

## PIVOT
The STEP or plan is mis-posed — its criteria are unsatisfiable or wrong.
Action: halt, append to `30_BUILD/issues.md`, surface to a human. (Reserved; not expected to fire in the slice.)
