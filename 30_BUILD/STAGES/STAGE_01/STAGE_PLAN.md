# STAGE_01 Plan

## Goal

Build a small, dependency-free Python utility `parse_duration(s)` in `target/duration.py` that converts a human duration string (e.g. `"1h30m"`, `"45s"`, `"2h"`, `"10m"`, `"1h1m1s"`) into total seconds as an `int`. Leading/trailing whitespace is tolerated. It raises `ValueError` on empty string, garbage, unknown units, and non-ASCII (e.g. Unicode) digits. Standard library only; no leftover markers; the only code file is `target/duration.py`. The definition of done is the frozen acceptance suite at `target/test_duration_acceptance.py`, which must not be modified.

## STEPs

### STEP_01 — Implement parse_duration in target/duration.py

- Files: `target/duration.py`
- Acceptance criteria:
  - `parse_duration("1h30m")` returns `5400` as an `int` (maps to `test_hours_minutes`)
  - `parse_duration("45s")` returns `45` (maps to `test_seconds_only`)
  - `parse_duration("2h")` returns `7200` (maps to `test_hours_only`)
  - `parse_duration("10m")` returns `600` (maps to `test_minutes_only`)
  - `parse_duration("1h1m1s")` returns `3661`, combining all three units (maps to `test_combined_all_units`)
  - `parse_duration("  2h  ")` returns `7200`, tolerating surrounding whitespace (maps to `test_surrounding_whitespace`)
  - `parse_duration("")` raises `ValueError` on empty string (maps to `test_empty_string_raises`)
  - `parse_duration("abc")` raises `ValueError` on garbage input (maps to `test_garbage_raises`)
  - `parse_duration("5x")` raises `ValueError` on unknown unit (maps to `test_unknown_unit_raises`)
  - `parse_duration("١h")` raises `ValueError`; only ASCII digits `0-9` are accepted, so non-ASCII/Unicode digits (e.g. Arabic-Indic U+0661) are rejected (maps to `test_unicode_digits_raise`)
  - Module is importable as `from duration import parse_duration`, uses the standard library only, `target/duration.py` is the only code file, and it contains no leftover build markers (maps to the import line of `target/test_duration_acceptance.py` and the STAGE constraints; verified by the full suite running green)
