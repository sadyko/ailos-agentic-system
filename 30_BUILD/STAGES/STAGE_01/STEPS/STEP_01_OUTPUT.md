# STEP_01 OUTPUT

## What changed
Created `target/duration.py` implementing the module-level function
`parse_duration(s: str) -> int`, importable as `from duration import parse_duration`.

## Files changed
- `target/duration.py` (new)

## Why
STEP_01 requires a `parse_duration` implementation whose contract is fully
specified by the frozen acceptance tests in `target/test_duration_acceptance.py`.
The file did not exist and had to be created.

## How it works
- `strip()` removes surrounding whitespace.
- Validation uses `re.fullmatch(r"(?:\d+[hms])+", trimmed)`: the trimmed string
  must consist entirely of one or more `<digits><h|m|s>` tokens. Empty input and
  any extra/garbage/unknown-unit characters fail the full match.
- On invalid input a `ValueError` is raised.
- Summation iterates `re.findall(r"(\d+)([hms])", trimmed)` multiplying each value
  by `{h: 3600, m: 60, s: 1}`. `int(value)` keeps the return type an `int`.
- Standard library only (`re`).

## Assumptions
- Units may appear in any order/repetition as long as each is a valid
  `<digits><unit>` token; the contract examples only use descending order, and
  this implementation satisfies all of them.
- A return value of `int` is required; arithmetic on `int` values yields `int`.

## Acceptance criteria coverage
- `parse_duration("1h30m") == 5400` (int) — test_hours_minutes: PASS
- `parse_duration("45s") == 45` — test_seconds_only: PASS
- `parse_duration("2h") == 7200` — test_hours_only: PASS
- `parse_duration("10m") == 600` — test_minutes_only: PASS
- `parse_duration("1h1m1s") == 3661` — test_combined_all_units: PASS
- `parse_duration("  2h  ") == 7200` (whitespace) — test_surrounding_whitespace: PASS
- `parse_duration("")` raises ValueError — test_empty_string_raises: PASS
- `parse_duration("abc")` raises ValueError — test_garbage_raises: PASS
- `parse_duration("5x")` raises ValueError — test_unknown_unit_raises: PASS
- Stdlib only, single code file, no leftover markers (no TODO/FIXME/debug prints),
  full suite imports `parse_duration` from `duration` — STAGE constraints: PASS

## Verification
`python -m unittest test_duration_acceptance -v` from `target/`:
Ran 9 tests — OK (all passing).
