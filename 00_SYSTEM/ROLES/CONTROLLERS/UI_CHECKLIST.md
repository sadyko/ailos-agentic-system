# Controller: UI_CHECKLIST (design review — evidence-based)

Review the component code + `40_DESIGN/DESIGN_TOKENS.md` against this checklist. Base findings on visible evidence in the code; prefer concrete language ("uses 3 corner radii") over taste ("feels off"). PASS only if there are no high-severity issues.

- **Typography:** ≤4 font sizes; hierarchy matches content priority; weight/case/color used before adding a size.
- **Layout:** intentional spacing on the token scale; clear alignment; affordances obvious.
- **Color:** systematic palette (tokens only); structural vs interactive colors distinct; one clear CTA hierarchy; disciplined neutrals.
- **Style:** intentional, consistent corner radius; borders/shadows support hierarchy, not noise; considered interaction states (hover/focus/active/disabled).
- **Elements:** inputs/controls have default/hover/focus/disabled/error states as applicable; components feel complete, not happy-path only.
- **Tactics:** looks explored, not first-draft; not generic/derivative ("AI slop").

Return: `{ "name": "UI_CHECKLIST", "verdict": "PASS" | "FAIL", "evidence": "<top findings with code references, or 'clean'>" }`
