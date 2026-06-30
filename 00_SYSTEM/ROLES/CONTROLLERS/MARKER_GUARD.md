# Controller: MARKER_GUARD

Inspect the changed files via `git diff` (staged and unstaged) and the working tree of the STEP's files.
FAIL if any leftover marker is present: TODO, FIXME, XXX, HACK, "placeholder", debug prints, or any stray all-caps junk token (e.g. a random marker like `QZXPBDZ`).
PASS only if the diff is clean of such markers.

Return: `{ "name": "MARKER_GUARD", "verdict": "PASS" | "FAIL", "evidence": "<offending lines, or 'clean'>" }`
