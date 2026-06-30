# STAGE_01 Review

## Verdict

PASS

## Reasons

1. The single STEP is atomic. STEP_01 ("Implement parse_duration in target/duration.py", plan lines 9-23) is one self-contained unit of work — implement one function in one file — with no hidden sub-tasks or ordering dependencies, satisfying the atomicity requirement.

2. Files to touch are explicit. STEP_01 names exactly `target/duration.py` ("Files: `target/duration.py`", plan line 10), and the Goal (line 5) confirms it is the only code file. There is no ambiguity about what is created or edited.

3. Every functional acceptance criterion is testable and explicitly mapped to a named frozen test. Each of the ten functional criteria (plan lines 14-22) states a concrete input/output and names the test it maps to: `"1h30m"`->5400 = `test_hours_minutes` (line 14); `"45s"`->45 = `test_seconds_only` (line 15); `"2h"`->7200 = `test_hours_only` (line 16); `"10m"`->600 = `test_minutes_only` (line 17); `"1h1m1s"`->3661 = `test_combined_all_units` (line 18); `"  2h  "`->7200 = `test_surrounding_whitespace` (line 19); `""`->ValueError = `test_empty_string_raises` (line 20); `"abc"`->ValueError = `test_garbage_raises` (line 21, first); `"5x"`->ValueError = `test_unknown_unit_raises` (line 21, second); `"١h"`->ValueError = `test_unicode_digits_raise` (line 22). Each criterion is objectively checkable from its stated input and expected result.

4. The non-ASCII-digit error case is covered, not dropped. Plan line 22 explicitly maps the Arabic-Indic digit case (`"١h"`, U+0661) to `test_unicode_digits_raise` and restates the rule that only ASCII `0-9` are accepted. This matches the Goal's requirement (line 5) that non-ASCII/Unicode digits raise `ValueError`, so the error-handling surface of the goal is fully represented.

5. The STAGE constraints are captured as a verifiable criterion. The final criterion (plan line 23) requires importability as `from duration import parse_duration`, standard-library-only, `target/duration.py` as the only code file, and no leftover build markers — mapped to the import line of `target/test_duration_acceptance.py` and the STAGE constraints, verified by the full frozen suite running green. This matches the Goal's definition of done (line 5).

6. The STEPs fully cover the goal. The Goal (line 5) asks for a dependency-free `parse_duration(s)` returning total seconds as `int`, tolerating surrounding whitespace, raising `ValueError` on empty / garbage / unknown-unit / non-ASCII-digit input, using only the standard library, with `target/duration.py` as the sole code file and no leftover markers. Every one of those behaviors maps to an acceptance criterion in STEP_01 (lines 14-23), so the single step discharges the entire goal with no gap.
