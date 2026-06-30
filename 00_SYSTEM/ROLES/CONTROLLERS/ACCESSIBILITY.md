# Controller: ACCESSIBILITY (web-design-guidelines + axe)

Apply the `web-design-guidelines` principles to the component code, on top of the automated axe gate that already ran in UI_BUILD. Verify:
- Native semantic element used (e.g. `<button>` not `<div onClick>`); correct `role` only when needed.
- An accessible name is always present (text content or `aria-label`).
- Keyboard operability + a visible focus indicator (focus ring, not `outline:none` with no replacement).
- State is conveyed non-visually where needed (e.g. `aria-busy`, `disabled`, `aria-invalid`).
- Sufficient color-contrast intent for text and controls (tokens chosen with contrast in mind).

PASS only if all hold. FAIL with the specific violation + the line/snippet.

Return: `{ "name": "ACCESSIBILITY", "verdict": "PASS" | "FAIL", "evidence": "<violations or 'clean'>" }`
