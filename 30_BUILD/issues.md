# Issues / Drift Log

The engine appends unresolved gate failures here at runtime. Below are known limitations carried forward from code review — to address before pointing the machine at a real (multi-step, production) codebase.

## Known limitations / future hardening
- **Validators are a smoke layer, not behavioral.** `tests/validate_*.test.mjs` assert presence/syntax (substring + AST-compile), not engine behavior. The real behavioral proof is the live engine run + the falsify run, which are manual, not in CI. For a real target, add an automated end-to-end harness (run engine on a fixture, assert green; run falsify, assert no-commit).
- **`commit_hash` is trusted, not re-derived.** The recorder agent returns `{committed:true, commit_hash}`; the engine does not independently `git rev-parse` to confirm the commit landed. Low risk (deterministic recorder), but add an independent confirmation when stakes are higher.
- **MARKER_GUARD now reads file contents (hardened).** Previously diff-only, which would see an empty diff for files committed by an earlier STEP in a multi-step run. Fixed to read current file contents; keep an eye on this when STEPs commit incrementally.
- **Human gates not yet wired.** The slice runs fully autonomous. For medical/production-data steps, reintroduce human sign-off at STAGE-plan approval and before any prod-affecting commit (see spec §10).
