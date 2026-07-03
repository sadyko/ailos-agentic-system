# Aurora Redesign — Plan 13: Hints panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add the consultation's "Подсказки" panel (right column): context cards formed by diagnosis/protocol — Протокол / Назначение / Внимание (allergy alert) — each with an optional "Вставить в документ" that appends its text into the РЕКОМЕНДАЦИИ section.

**Architecture:** A self-contained `HintsPanel` (static hint cards ported verbatim from prototype `consultation.jsx` HintsPanel L1809–1829) rendered in `ConsultationPage`'s right column under `HistoryPanel`. Insert reuses the Plan-12 append pattern: escape → `<br>`-join → append into `[data-section-tag="РЕКОМЕНДАЦИИ"]` (fallback: first section) → dispatch bubbling `input`. The "Внимание" card is styled as an alert and has no insert (faithful to prototype).

**Tech Stack:** React 19, TS, design-system `Badge`/`Button`, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis.

### Task 1: HintsPanel + wiring + smoke test

**Files:** Create `src/features/doctor/consultation/HintsPanel.tsx`, `HintsPanel.test.tsx`. Modify `ConsultationPage.tsx`.

- [ ] **Step 1: `HintsPanel.tsx`**
```tsx
import { Sparkles, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Hint { tag: 'Протокол' | 'Назначение' | 'Внимание'; title: string; body: string; insert: string }
const HINTS: Hint[] = [
  { tag: 'Протокол', title: 'K62.5 — кровотечение из прямой кишки', body: 'Рекомендован осмотр аноскопом и ректороманоскопия для исключения источника кровотечения в нижних отделах. Контроль ОАК (Hb 118 ↓).', insert: 'Назначено: аноскопия, ректороманоскопия. Контроль ОАК в динамике.' },
  { tag: 'Назначение', title: 'Венотоники при геморрое', body: 'При подтверждённом геморрое 1–2 ст. — флеботропная терапия (диосмин/гесперидин) курсом 7 дней, местные средства.', insert: 'Детралекс 1000 мг — 1 таб × 2 р/день, 7 дней. Натальсид супп. — 1 супп. × 2 р/день, 10 дней.' },
  { tag: 'Внимание', title: 'Аллергия: пенициллин', body: 'У пациента отмечена аллергия на пенициллин — исключить антибиотики пенициллинового ряда при назначении.', insert: '' },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function insertHint(text: string) {
  const el = (document.querySelector('[data-section-tag="РЕКОМЕНДАЦИИ"]') ?? document.querySelector('[data-section-tag]')) as HTMLElement | null
  if (!el) return
  const html = esc(text)
  el.innerHTML = el.textContent?.trim() ? `${el.innerHTML}<br>${html}` : html
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function HintsPanel() {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5" />Подсказки</div>
      <p className="mb-2 text-xs text-muted-foreground">Подсказки формируются по диагнозу и тексту документа. Можно вставить любой фрагмент в заключение.</p>
      <div className="space-y-2">
        {HINTS.map((h, i) => (
          <div key={i} className={cn('rounded-md border p-2', h.tag === 'Внимание' && 'border-destructive/40 bg-destructive/5')}>
            <div className="flex items-start gap-2">
              <Badge variant={h.tag === 'Внимание' ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">{h.tag}</Badge>
              <span className="text-sm font-medium leading-snug">{h.title}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{h.body}</p>
            {h.insert && <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => insertHint(h.insert)}><Plus className="size-3.5" />Вставить в документ</Button>}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `ConsultationPage.tsx`** — import `HintsPanel` and render it in the right column, immediately under `<HistoryPanel ... />`:
```tsx
<HintsPanel />
```

- [ ] **Step 3: Smoke test** `HintsPanel.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HintsPanel } from './HintsPanel'

describe('HintsPanel (smoke)', () => {
  it('renders the three hint cards with no axe violations', async () => {
    const { container, getByText, getAllByText } = render(<HintsPanel />)
    expect(getByText('K62.5 — кровотечение из прямой кишки')).toBeTruthy()
    expect(getByText('Аллергия: пенициллин')).toBeTruthy()
    expect(getAllByText('Вставить в документ')).toHaveLength(2) // Внимание has no insert
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(doctor): hints panel (protocol/prescription/allergy) with insert"`

### Task 2: Gate + screenshot
- [ ] (Controller) screenshot the right column with the hints panel + an inserted hint in РЕКОМЕНДАЦИИ.

---

## Self-Review (plan author)
**Coverage:** faithful port of the prototype HintsPanel (3 cards verbatim, alert styling for Внимание, insert-into-document); insert reuses the proven Plan-12 append pattern targeted at РЕКОМЕНДАЦИИ. **Placeholders:** none — full code. **Types:** self-contained component, no store dependency; `cn`/`Badge`/`Button` exist. **Scope:** one small feature, smoke-tested, visually verifiable.
