# Controller: MARKER_GUARD

Inspect the STEP's files by reading their CURRENT contents on disk. Use `git diff` only as supplementary context — never rely on the diff alone, since a file committed by an earlier STEP shows an empty diff.
FAIL if any leftover marker is present: TODO, FIXME, XXX, HACK, "placeholder", debug prints, or any stray all-caps junk token (e.g. a random marker like `QZXPBDZ`).
PASS only if the files are clean of such markers.

Return: `{ "name": "MARKER_GUARD", "verdict": "PASS" | "FAIL", "evidence": "<offending lines, or 'clean'>" }`
