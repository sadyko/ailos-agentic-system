# STEP_01 OUTPUT

## What changed
Tightened the digit matching in `parse_duration` so only ASCII digits `0-9` are
accepted. The two module-level compiled regexes were changed from the bare `\d`
class to the explicit ASCII class `[0-9]`:

- `_TOKEN_RE`: `r"(\d+)([hms])"` -> `r"([0-9]+)([hms])"`
- `_FULL_RE`:  `r"(?:\d+[hms])+"` -> `r"(?:[0-9]+[hms])+"`

No other logic was touched. Validation (full-string `fullmatch`, `ValueError` on
empty/no-match), summation over `_UNIT_SECONDS` (`h=3600, m=60, s=1`), and the
int-in/int-out contract are unchanged.

## Files changed
- `target/duration.py` (only code file modified)

## Why
In Python the `re` default (no `re.ASCII` flag) treats `\d` as matching all
Unicode decimal digits, so `"١h"` (Arabic-Indic digit U+0661, which has decimal
value 1) would `fullmatch` and `int("١")` would succeed, returning `3600` instead
of raising. Switching to the literal `[0-9]` character class restricts matching to
ASCII digits, so non-ASCII digit input fails the regex and raises `ValueError` as
the contract requires.

## Assumptions
- Only `target/duration.py` is in scope; the frozen acceptance test file was read
  but not modified.
- Standard-library-only constraint preserved (uses `re` only; no new imports).
- Existing module conventions kept: compiled regexes prefixed with `_`,
  `ValueError` on invalid input, ints in and out.

## How each acceptance criterion is satisfied
- `parse_duration("1h30m") == 5400` (test_hours_minutes): `1*3600 + 30*60`.
- `parse_duration("45s") == 45` (test_seconds_only): `45*1`.
- `parse_duration("2h") == 7200` (test_hours_only): `2*3600`.
- `parse_duration("10m") == 600` (test_minutes_only): `10*60`.
- `parse_duration("1h1m1s") == 3661` (test_combined_all_units): `3600+60+1`.
- `parse_duration("  2h  ") == 7200` (test_surrounding_whitespace): `s.strip()`
  removes surrounding whitespace before matching.
- `parse_duration("")` raises `ValueError` (test_empty_string_raises): trimmed
  string is empty -> guard raises.
- `parse_duration("abc")` raises `ValueError` (test_garbage_raises): no
  `[0-9]+[hms]` token -> `_FULL_RE.fullmatch` is `None` -> raises.
- `parse_duration("5x")` raises `ValueError` (test_unknown_unit_raises): `x` is
  not in `[hms]` -> `fullmatch` is `None` -> raises.
- `parse_duration("١h")` raises `ValueError` (test_unicode_digits_raise): the
  Arabic-Indic digit U+0661 is not in `[0-9]`, so `_FULL_RE.fullmatch` is `None`
  -> raises. This is the criterion the change directly addresses.
- Importable as `from duration import parse_duration`, stdlib only,
  `target/duration.py` is the only code file, and no leftover build markers
  remain (grep for TODO/FIXME/XXX/HACK/placeholder/print found none). Verified by
  the full acceptance suite running green (10/10) with cwd = `target/`.

## Verification
Ran `python -m unittest test_duration_acceptance -v` from `target/`:
all 10 tests pass (`Ran 10 tests ... OK`).
