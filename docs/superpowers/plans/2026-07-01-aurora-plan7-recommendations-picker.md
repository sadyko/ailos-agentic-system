# Aurora Redesign — Plan 7: Recommendations picker ("Рекомендации")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation's "Рекомендации" card interactive: a 5-column recommendation picker (type → direction → service+price → doctor → time-slot with closed/booked states), a recommendations list with status + remove, held in the shared store, plus a toolbar "Вставить рекомендации" insert. Finishes the interactive left panel (all 4 cards).

**Architecture:** Extend the store with `recs: Recommendation[]` + `addRec`/`removeRec`. `RecsCard` (replacing its Plan-2 shell) reads the store and opens `RecPickerModal` (the clinic-wide service catalog + doctor + slot). `RichTextToolbar` gains "Вставить рекомендации" (`fmtRecs`). Ported from prototype `consultation-left.jsx` (SVC_* catalog L228–248, ServicePickerModal rec-mode L261–367, RecsCard L592) + `consultation.jsx` (fmtRecs L40–42). **Deferred (noted):** the "Все рекомендации" history modal (RecsAllModal) + service/rec templates — a follow-up.

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Dialog`/`Button`/`Badge`/`ScrollArea`, lucide-react, Vitest + jest-axe. `moneyFmt` from `@/domain/format`.

**Testability:** `fmtRecs`/`shortDoc` are pure → TDD. Picker/card are render+axe smoke tests.

**Reference:** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation-left.jsx`. Prior: Plans 4–6 (diagnosis/services/prescriptions store+modal+card).

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/domain/recommendations.ts        # Recommendation, SVC_* catalog, shortDoc, fmtRecs
src/domain/recommendations.test.ts   # fmtRecs + shortDoc (TDD)
src/features/doctor/consultation/
  store.tsx                          # + recs, addRec, removeRec
  RecPickerModal.tsx                 # 5-column recommendation picker
  RecPickerModal.test.tsx            # smoke
  cards/RecsCard.tsx                 # REPLACE shell with interactive card
  RichTextToolbar.tsx                # + "Вставить рекомендации"
```

---

### Task 1: Recommendations domain (TDD) + store extension

**Files:** `src/domain/recommendations.ts`, `src/domain/recommendations.test.ts`, `store.tsx`.

- [ ] **Step 1: Failing tests** `src/domain/recommendations.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { shortDoc, fmtRecs, SVC_BY_DIR, type Recommendation } from './recommendations'

describe('recommendations domain', () => {
  it('shortDoc abbreviates patronymic + first name', () => {
    expect(shortDoc('Казанцева Наталья Владимировна')).toBe('Казанцева Н.В.')
  })
  it('SVC_BY_DIR has priced services per direction', () => {
    expect(SVC_BY_DIR['Лаборатория'].length).toBeGreaterThan(2)
    expect(SVC_BY_DIR['Лаборатория'][0]).toHaveProperty('n')
  })
  it('fmtRecs renders each recommendation with cat/doctor/slot', () => {
    const recs: Recommendation[] = [{ name: 'МРТ малого таза', cat: 'Лучевая диагностика', price: 680000, doctor: 'Казанцева Наталья Владимировна', slot: '09:00–09:20', done: false }]
    expect(fmtRecs(recs)).toBe('Рекомендовано:\n— МРТ малого таза (Лучевая диагностика), Казанцева Н.В., 09:00–09:20')
    expect(fmtRecs([])).toBe('')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- recommendations`

- [ ] **Step 3: Implement** `src/domain/recommendations.ts` (ported verbatim):
```ts
export interface CatalogService { n: string; p: number }
export interface Recommendation { name: string; cat: string; price: number; doctor: string | null; slot: string | null; done: boolean }

export const SVC_TYPES = ['Консультация', 'Лабораторная диагностика', 'Лучевая диагностика', 'Инструментальная диагностика', 'Процедуры и лечение', 'Медикаменты', 'Онкологический стационар']
export const SVC_DIRS = ['Кардиология', 'Неврология', 'Терапия', 'Хирургия', 'Онкология', 'ЛОР (отоларингология)', 'Дерматология', 'Эндокринология', 'Лучевая диагностика', 'Лаборатория', 'Эндоскопия', 'Функциональная диагностика']
export const SVC_BY_DIR: Record<string, CatalogService[]> = {
  'Кардиология': [{ n: 'Приём (осмотр, консультация) кардиолога', p: 280000 }, { n: 'ЭхоКГ (УЗИ сердца)', p: 240000 }, { n: 'Холтер-мониторинг ЭКГ', p: 260000 }],
  'Неврология': [{ n: 'Приём (осмотр, консультация) невролога', p: 260000 }, { n: 'ЭЭГ', p: 180000 }],
  'Терапия': [{ n: 'Приём (осмотр, консультация) терапевта', p: 200000 }],
  'Хирургия': [{ n: 'Приём (осмотр, консультация) хирурга', p: 250000 }],
  'Онкология': [{ n: 'Приём (осмотр, консультация) онколога', p: 300000 }],
  'ЛОР (отоларингология)': [{ n: 'Приём (осмотр, консультация) ЛОРа', p: 230000 }, { n: 'Аудиометрия', p: 140000 }],
  'Дерматология': [{ n: 'Приём (осмотр, консультация) дерматолога', p: 220000 }, { n: 'Дерматоскопия', p: 160000 }],
  'Эндокринология': [{ n: 'Приём (осмотр, консультация) эндокринолога', p: 240000 }, { n: 'УЗИ щитовидной железы', p: 160000 }],
  'Лучевая диагностика': [{ n: 'МРТ малого таза', p: 680000 }, { n: 'КТ органов брюшной полости', p: 540000 }, { n: 'УЗИ органов брюшной полости', p: 240000 }],
  'Лаборатория': [{ n: 'Общий анализ крови', p: 95000 }, { n: 'Общий анализ мочи', p: 70000 }, { n: 'Биохимия крови (расширенная)', p: 210000 }, { n: 'ТТГ, Т4 свободный', p: 130000 }, { n: 'Липидный профиль', p: 150000 }],
  'Эндоскопия': [{ n: 'Ректороманоскопия', p: 320000 }, { n: 'Колоноскопия', p: 600000 }, { n: 'ФГДС', p: 280000 }],
  'Функциональная диагностика': [{ n: 'ЭКГ с расшифровкой', p: 90000 }, { n: 'Спирометрия', p: 120000 }],
}
export const SVC_DOCTORS = ['Казанцева Наталья Владимировна', 'Бакиева Малика Алимовна', 'Абдуллаев Бекзоджон Кутбиддинович', 'Ибрагимов Азиз Каримович', 'Юсупова Дилноза Маратовна', 'Назарова Шахноза Фарходовна']
export const SVC_SLOTS = ['08:00–08:20', '08:20–08:40', '08:40–09:00', '09:00–09:20', '09:20–09:40', '09:40–10:00', '10:00–10:20', '10:20–10:40', '11:00–11:20', '11:20–11:40']
export const SVC_SLOTS_CLOSED = ['08:20–08:40', '09:20–09:40']
export const SVC_SLOTS_BOOKED = ['08:40–09:00', '10:00–10:20']

export function shortDoc(n: string): string {
  const p = String(n).split(' ')
  return p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') + (p[2] ? p[2][0] + '.' : '')
}

export function fmtRecs(list: Recommendation[]): string {
  if (!list.length) return ''
  return 'Рекомендовано:\n' + list.map(r => `— ${r.name}${r.cat ? ` (${r.cat})` : ''}${r.doctor ? `, ${shortDoc(r.doctor)}` : ''}${r.slot ? `, ${r.slot}` : ''}`).join('\n')
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- recommendations`

- [ ] **Step 5: Extend the store** `store.tsx` — add `recs` alongside dx/services/rx (keep those as-is):
```tsx
import type { Recommendation } from '@/domain/recommendations'
// interface: recs: Recommendation[]; addRec: (r: Recommendation) => void; removeRec: (index: number) => void
// provider: const [recs, setRecs] = useState<Recommendation[]>([])
// value: recs, addRec: r => setRecs(list => [...list, r]), removeRec: index => setRecs(list => list.filter((_, i) => i !== index)),
```

- [ ] **Step 6: Gate + commit** — `npm run verify` green. Commit: `git add -A && git commit -m "feat(doctor): recommendations domain (SVC catalog, fmtRecs, shortDoc) + store recs (TDD)"`

---

### Task 2: RecPickerModal + interactive RecsCard

**Files:** `RecPickerModal.tsx`, `RecPickerModal.test.tsx`, `cards/RecsCard.tsx` (replace).

- [ ] **Step 1: `src/features/doctor/consultation/RecPickerModal.tsx`** (5-column: type → dir → service → doctor → slot):
```tsx
import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { SVC_TYPES, SVC_DIRS, SVC_BY_DIR, SVC_DOCTORS, SVC_SLOTS, SVC_SLOTS_CLOSED, SVC_SLOTS_BOOKED, type Recommendation, type CatalogService } from '@/domain/recommendations'
import { moneyFmt } from '@/domain/format'

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border">
      <div className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
    </div>
  )
}
const row = (on: boolean, extra = '') => cn('flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm hover:bg-accent', on && 'bg-accent font-medium', extra)

export function RecPickerModal({ onAdd, onClose }: { onAdd: (r: Recommendation) => void; onClose: () => void }) {
  const [type, setType] = useState(SVC_TYPES[0])
  const [dir, setDir] = useState(SVC_DIRS[0])
  const [srv, setSrv] = useState<string>(SVC_BY_DIR[SVC_DIRS[0]]?.[0]?.n ?? '')
  const [doctor, setDoctor] = useState<string>('')
  const [slot, setSlot] = useState<string>('')
  const [added, setAdded] = useState(0)
  const services = SVC_BY_DIR[dir] ?? []
  const selected = services.find(s => s.n === srv)
  const chooseDir = (d: string) => { setDir(d); setSrv(SVC_BY_DIR[d]?.[0]?.n ?? '') }
  const emit = (s?: CatalogService) => { if (!s) return; onAdd({ name: s.n, cat: dir, price: s.p, doctor: doctor || null, slot: slot || null, done: false }); setAdded(a => a + 1) }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Рекомендовать услугу</DialogTitle></DialogHeader>
        <div className="grid h-80 grid-cols-[1fr_1fr_1.4fr_1.3fr_1fr] gap-2">
          <Col title="Типы услуг">{SVC_TYPES.map(t => <button key={t} className={row(type === t)} onClick={() => setType(t)}>{t}</button>)}</Col>
          <Col title="Направление">{SVC_DIRS.map(d => <button key={d} className={row(dir === d)} onClick={() => chooseDir(d)}>{d}</button>)}</Col>
          <Col title="Услуги">
            {services.map(s => (
              <button key={s.n} className={row(srv === s.n)} onClick={() => setSrv(s.n)} onDoubleClick={() => emit(s)} title="Двойной клик — добавить">
                <span className="min-w-0 flex-1 truncate">{s.n}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{moneyFmt(s.p)}</span>
              </button>
            ))}
          </Col>
          <Col title="Врачи">
            <button className={row(doctor === '')} onClick={() => setDoctor('')}>Без привязки к врачу</button>
            {SVC_DOCTORS.map(d => <button key={d} className={row(doctor === d)} onClick={() => setDoctor(d)}>{d}</button>)}
          </Col>
          <Col title="Слот">
            <button className={row(slot === '')} onClick={() => setSlot('')}>Без слота</button>
            {SVC_SLOTS.map(s => {
              const dis = SVC_SLOTS_CLOSED.includes(s) || SVC_SLOTS_BOOKED.includes(s)
              const tag = SVC_SLOTS_BOOKED.includes(s) ? 'занят' : SVC_SLOTS_CLOSED.includes(s) ? 'закрыт' : ''
              return (
                <button key={s} disabled={dis} className={row(slot === s, dis ? 'opacity-50' : '')} onClick={() => !dis && setSlot(s)}>
                  <span className="flex-1 tabular-nums">{s}</span>{tag && <span className="text-[10px] text-muted-foreground">{tag}</span>}
                </button>
              )
            })}
          </Col>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="mr-auto">Двойной клик по услуге — добавить{added > 0 ? ` · добавлено: ${added}` : ''}</span>
          <Button variant="ghost" onClick={onClose}>{added > 0 ? 'Готово' : 'Отмена'}</Button>
          <Button disabled={!selected} onClick={() => emit(selected)}><Plus className="size-4" />Добавить в рекомендации</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Replace `cards/RecsCard.tsx`**
```tsx
import { useState } from 'react'
import { ListChecks, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '../SectionCard'
import { RecPickerModal } from '../RecPickerModal'
import { useConsultationStore } from '../store'
import { shortDoc } from '@/domain/recommendations'

export function RecsCard() {
  const { recs, addRec, removeRec } = useConsultationStore()
  const [open, setOpen] = useState(false)
  return (
    <SectionCard title="Рекомендации" icon={<ListChecks className="size-4" />} count={recs.length}
      action={<Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />Добавить</Button>}>
      {recs.length === 0 && <p className="text-xs text-muted-foreground">Рекомендаций нет.</p>}
      <div className="space-y-1.5">
        {recs.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.cat}{r.doctor ? ` · ${shortDoc(r.doctor)}` : ''}{r.slot ? ` · ${r.slot}` : ''}</div>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{r.done ? 'Выполнено' : 'Передано в продажи'}</Badge>
            <button aria-label="Убрать рекомендацию" onClick={() => removeRec(i)} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {open && <RecPickerModal onAdd={addRec} onClose={() => setOpen(false)} />}
    </SectionCard>
  )
}
```
(The "Все рекомендации" history modal is deferred to a follow-up plan.)

- [ ] **Step 3: Smoke test** `RecPickerModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RecPickerModal } from './RecPickerModal'

describe('RecPickerModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<RecPickerModal onAdd={() => {}} onClose={() => {}} />)
    expect(getByText('Рекомендовать услугу')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify` green. Commit: `git add -A && git commit -m "feat(doctor): interactive recommendations card + 5-column picker"`

---

### Task 3: Toolbar "Вставить рекомендации" + gate + screenshot

**Files:** `RichTextToolbar.tsx`.

- [ ] **Step 1: Add the insert** to `RichTextToolbar.tsx` — the toolbar already reads `{ dx, rx }` from the store and imports `fmtDx`/`fmtRx` + `Stethoscope`/`Pill`, with "Диагноз" and "Рецепт" buttons. Add recommendations:
  1. Import `ListChecks` from lucide-react (add to the existing import).
  2. Import `fmtRecs` from `@/domain/recommendations`.
  3. Change the store destructure to `const { dx, rx, recs } = useConsultationStore()`.
  4. Add a handler near `insertRx`:
```tsx
const insertRecs = (e: React.MouseEvent) => { e.preventDefault(); const t = fmtRecs(recs); if (!t) return; try { document.execCommand('insertText', false, t + '\n') } catch { /* */ } }
```
  5. In the JSX, immediately AFTER the "Рецепт" insert button, add:
```tsx
<button type="button" title="Вставить рекомендации из карточки" onMouseDown={insertRecs} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><ListChecks className="size-4" />Рекомендации</button>
```

- [ ] **Step 2: Gate** — `npm run verify && npm run build` — green; report counts.
- [ ] **Step 3: Manual** — open a consultation → "Рекомендации" "Добавить" opens the 5-column picker (type/dir/service/doctor/slot; closed+booked slots disabled) → add one → it lists with a status badge; the toolbar "Рекомендации" inserts the text into the document. Stop dev.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(doctor): insert recommendations into the document"`.
(Controller then screenshots the recommendations picker for the owner.)

---

## Self-Review (plan author)

**Spec coverage:** The final left-panel picker: the "Рекомендации" card is interactive (Task 2) with a 5-column picker (service catalog + doctor + slot, closed/booked slots disabled), backed by the store extended with `recs` (Task 1, TDD on `fmtRecs`/`shortDoc`), plus a toolbar insert (Task 3). Completes all 4 interactive left cards. Ported from the prototype (SVC catalog, rec-mode picker, RecsCard, fmtRecs); re-skinned on design-system Dialog/ScrollArea/Badge. **Deferred (explicitly noted):** the "Все рекомендации" history modal + service/rec templates — a follow-up. Then hints/past-results, then draft/version history complete the consultation.

**Placeholder scan:** No TODOs. Catalog is the full ported set. Every code step is complete.

**Type consistency:** `Recommendation`/`CatalogService` in `domain/recommendations.ts`, consumed by `store.tsx`, `RecPickerModal`, `RecsCard`, toolbar. Store adds `recs`/`addRec`/`removeRec(index)` used by `RecsCard`; `onAdd:(r:Recommendation)` matches `addRec`. `shortDoc`/`fmtRecs` match tests + callers. Toolbar reads `{ dx, rx, recs }` (all provided). `moneyFmt` from `@/domain/format`.

**Scope:** One coherent interactive card (recommendations): pick (5-col) → list → status → remove → insert; pure logic unit-tested, UI smoke-tested, visually validated.
