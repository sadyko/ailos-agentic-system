# Controller: TEST_COVERAGE

Run: `python -m unittest discover -s target -p "test_*.py"`.
PASS only if the run reports OK with zero failures and zero errors. Quote the unittest summary line as evidence.

Return: `{ "name": "TEST_COVERAGE", "verdict": "PASS" | "FAIL", "evidence": "<unittest summary>" }`
