# STEP_01 CHECK

## Verdict: PASS

## Method
Ran the frozen acceptance suite myself from the vault root:

```
python -m unittest discover -s target -p "test_*.py"
```

Result:

```
.........
----------------------------------------------------------------------
Ran 9 tests in 0.000s

OK
```

Verbose run (`-v`) confirms each individual test:

```
test_combined_all_units ... ok
test_empty_string_raises ... ok
test_garbage_raises ... ok
test_hours_minutes ... ok
test_hours_only ... ok
test_minutes_only ... ok
test_seconds_only ... ok
test_surrounding_whitespace ... ok
test_unknown_unit_raises ... ok
----------------------------------------------------------------------
Ran 9 tests in 0.001s
OK
```

## Per-criterion result (reality-checked)

| Acceptance criterion | Mapped test | Result |
|---|---|---|
| `parse_duration("1h30m")` returns 5400 as an int | test_hours_minutes | PASS |
| `parse_duration("45s")` returns 45 | test_seconds_only | PASS |
| `parse_duration("2h")` returns 7200 | test_hours_only | PASS |
| `parse_duration("10m")` returns 600 | test_minutes_only | PASS |
| `parse_duration("1h1m1s")` returns 3661 (all three units) | test_combined_all_units | PASS |
| `parse_duration("  2h  ")` returns 7200 (whitespace tolerated) | test_surrounding_whitespace | PASS |
| `parse_duration("")` raises ValueError | test_empty_string_raises | PASS |
| `parse_duration("abc")` raises ValueError | test_garbage_raises | PASS |
| `parse_duration("5x")` raises ValueError | test_unknown_unit_raises | PASS |
| Stdlib only; `duration.py` is the only code file; no leftover markers; suite imports `parse_duration` from `duration` | STAGE constraints | PASS |

## STAGE-constraint evidence
- Imports inspected via AST: only `re` (standard library); no third-party / no `from` imports.
- Code files in `target/`: `duration.py` (implementation) and `test_duration_acceptance.py` (frozen test). The only implementation/code file is `duration.py`.
- Leftover-marker scan (TODO/FIXME/XXX/HACK/print/pdb/conflict markers) over `duration.py`: no matches.
- The test module does `from duration import parse_duration`; the suite collected and ran 9 tests successfully, proving the import resolves.

## Notes
- Return type is `int`: `_UNIT_SECONDS` values are ints and `int(value)` is used, so all arithmetic stays int. The int-ness of the 5400 result is implicitly enforced by `assertEqual` against int `5400` plus int-only arithmetic.
- Implementation validates with `re.fullmatch(r"(?:\d+[hms])+", trimmed)` after `strip()`, correctly rejecting empty, garbage, and unknown-unit inputs while accepting surrounding whitespace.

## Conclusion
Every acceptance test passes against the real code, and every acceptance criterion (including STAGE constraints) is genuinely satisfied. Verdict: PASS.
