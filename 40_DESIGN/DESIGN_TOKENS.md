# Design Tokens

The single, disciplined system every component must use. No off-token colors, sizes, or spacing.
Machine-readable mirror: `target/ui/src/tokens.ts` (injected into the gallery's Tailwind config).

## Color
- **brand** (primary actions / focus): brand-500 `#3b6cff`, brand-600 `#2b54e6` (hover), brand-700 (active).
- **neutral** (text, borders, surfaces): neutral-50 → neutral-900. Use ≤4 neutrals per screen.
- **danger** (destructive): danger-500 / danger-600.
- Keep structural colors (neutral) distinct from interactive colors (brand). One CTA hierarchy.

## Type scale (cap at 4 sizes)
- body `16px`, small `14px`, heading `20px`, display `28px`. Use weight/case/color before adding a size.

## Spacing
- Use the Tailwind scale only: 1, 2, 3, 4, 6, 8 (= 0.25rem … 2rem). No arbitrary gaps.

## Radius
- sm `0.375rem`, md `0.5rem` (default), lg `0.75rem`. Be consistent per component.
