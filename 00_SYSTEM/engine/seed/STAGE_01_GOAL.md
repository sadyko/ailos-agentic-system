# STAGE_01 Goal

Build a small, dependency-free Python utility `parse_duration(s)` in `target/duration.py`.

It converts a human duration string into total **seconds** (an `int`):
- `"1h30m"` → 5400, `"45s"` → 45, `"2h"` → 7200, `"10m"` → 600, `"1h1m1s"` → 3661
- leading / trailing whitespace tolerated
- raises `ValueError` on empty string, garbage, or unknown units

The definition of done is the frozen acceptance suite at `target/test_duration_acceptance.py`.
Do NOT modify the tests; write `target/duration.py` so they pass.

Constraints: standard library only; no leftover markers; the only code file is `target/duration.py`.
