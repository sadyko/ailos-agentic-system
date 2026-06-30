# Controller: UI_BUILD (hard gate)

Run the project's verify command (given in your task): `npm --prefix target/ui run verify`.
This runs `tsc --noEmit` (types) then `vitest run` (render + state assertions + **jest-axe** accessibility checks in jsdom).

PASS only if the command exits 0 with zero type errors and zero failing tests (including zero axe violations). Quote the vitest summary line as evidence. On failure, quote the first failing assertion / type error.

Return: `{ "name": "UI_BUILD", "verdict": "PASS" | "FAIL", "evidence": "<summary or first failure>" }`
