# Aurora Redesign — Plan 4: Diagnosis (ICD-10) picker + consultation store

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation's Diagnosis card interactive: an ICD-10 search modal to add diagnoses (typed main/concomitant/complication/background, main-unique), a diagnosis list with remove, a shared **consultation store** (React context) holding the diagnoses, and a toolbar "Вставить диагноз" button that inserts the formatted diagnosis text into the document. Establishes the store + modal + insert pattern that Services/Prescriptions (next plan) reuse.

**Architecture:** A `ConsultationStoreProvider` (React context) wraps the consultation and holds `dx: Diagnosis[]` with `addDx`/`removeDx`. `DiagnosisCard` (replacing its Plan-2 shell) reads the store and opens `DiagnosisModal`. `RichTextToolbar` gains a "Вставить диагноз" button that reads the store and `execCommand('insertText', fmtDx(dx))` into the focused section. Ported from prototype `consultation-left.jsx` (ICD10 L74–104, DiagnosisModal L112–178, DiagnosisCard L180–208) and `consultation.jsx` (fmtDx L36–39). `window.CN_STORE` becomes the typed React context.

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Dialog`/`Badge`/`ToggleGroup`/`Input`/`Button`/`ScrollArea`, lucide-react, Vitest + jest-axe.

**Testability:** `fmtDx` + `addDiagnosis` are pure → unit-tested (TDD). The modal/card/insert are render+axe smoke tests (`execCommand` is a jsdom no-op).

**Reference:** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation-left.jsx` / `consultation.jsx`. Prior: Plan 2/3 consultation.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian copy verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/domain/diagnosis.ts            # DxType, Diagnosis, IcdCode, DX_TYPES, ICD10, fmtDx, addDiagnosis
src/domain/diagnosis.test.ts       # fmtDx + addDiagnosis (TDD)
src/features/doctor/consultation/
  store.tsx                        # ConsultationStoreProvider + useConsultationStore (dx)
  DiagnosisModal.tsx               # ICD-10 search + type + add
  cards/DiagnosisCard.tsx          # REPLACE shell with interactive card (reads store)
  DiagnosisModal.test.tsx          # smoke
  RichTextToolbar.tsx              # + "Вставить диагноз" button (reads store)
  ConsultationPage.tsx             # wrap content in <ConsultationStoreProvider>
```

---

### Task 1: Diagnosis domain (TDD)

**Files:** `src/domain/diagnosis.ts`, `src/domain/diagnosis.test.ts`.

- [ ] **Step 1: Failing tests** `src/domain/diagnosis.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addDiagnosis, fmtDx, ICD10, type Diagnosis } from './diagnosis'

describe('diagnosis domain', () => {
  it('ICD10 is a non-empty catalog with code/name/cat', () => {
    expect(ICD10.length).toBeGreaterThan(20)
    expect(ICD10[0]).toHaveProperty('code'); expect(ICD10[0]).toHaveProperty('name'); expect(ICD10[0]).toHaveProperty('cat')
  })
  it('addDiagnosis appends', () => {
    const out = addDiagnosis([], { code: 'K59.0', text: 'Запор', type: 'concomitant' })
    expect(out).toHaveLength(1)
  })
  it('adding a new main demotes the previous main to concomitant', () => {
    const a: Diagnosis[] = [{ code: 'K62.5', text: 'A', type: 'main' }]
    const out = addDiagnosis(a, { code: 'C20', text: 'B', type: 'main' })
    expect(out.find(d => d.code === 'K62.5')!.type).toBe('concomitant')
    expect(out.find(d => d.code === 'C20')!.type).toBe('main')
  })
  it('addDiagnosis de-dupes by code', () => {
    const a: Diagnosis[] = [{ code: 'K59.0', text: 'Запор', type: 'concomitant' }]
    expect(addDiagnosis(a, { code: 'K59.0', text: 'Запор', type: 'main' })).toHaveLength(1)
  })
  it('fmtDx renders the insert text with the type label', () => {
    expect(fmtDx([{ code: 'K62.5', text: 'Кровотечение', type: 'main' }])).toBe('Диагноз (МКБ-10):\nK62.5 — Кровотечение (основной)')
    expect(fmtDx([])).toBe('')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- diagnosis`

- [ ] **Step 3: Implement** `src/domain/diagnosis.ts` (ICD10 ported verbatim from the prototype):
```ts
export type DxType = 'main' | 'concomitant' | 'complication' | 'background'
export interface Diagnosis { code: string; text: string; type: DxType }
export interface IcdCode { code: string; name: string; cat: string }

export const DX_TYPES: { key: DxType; label: string; short: string }[] = [
  { key: 'main', label: 'Основной', short: 'осн.' },
  { key: 'concomitant', label: 'Сопутствующий', short: 'сопут.' },
  { key: 'complication', label: 'Осложнение', short: 'осл.' },
  { key: 'background', label: 'Фоновый', short: 'фон.' },
]
const DX_LABEL: Record<DxType, string> = { main: 'основной', concomitant: 'сопутствующий', complication: 'осложнение', background: 'фоновый' }

export const ICD10: IcdCode[] = [
  { code: 'K62.5', name: 'Кровотечение из заднего прохода и прямой кишки', cat: 'Болезни органов пищеварения' },
  { code: 'K64.9', name: 'Геморрой неуточнённый', cat: 'Болезни органов пищеварения' },
  { code: 'K64.1', name: 'Геморрой второй степени', cat: 'Болезни органов пищеварения' },
  { code: 'K60.2', name: 'Анальная трещина неуточнённая', cat: 'Болезни органов пищеварения' },
  { code: 'K59.0', name: 'Запор', cat: 'Болезни органов пищеварения' },
  { code: 'K58.9', name: 'Синдром раздражённого кишечника без диареи', cat: 'Болезни органов пищеварения' },
  { code: 'K57.30', name: 'Дивертикулярная болезнь толстой кишки', cat: 'Болезни органов пищеварения' },
  { code: 'K51.9', name: 'Язвенный колит неуточнённый', cat: 'Болезни органов пищеварения' },
  { code: 'K50.90', name: 'Болезнь Крона неуточнённая', cat: 'Болезни органов пищеварения' },
  { code: 'K21.0', name: 'ГЭРБ с эзофагитом', cat: 'Болезни органов пищеварения' },
  { code: 'K29.5', name: 'Хронический гастрит неуточнённый', cat: 'Болезни органов пищеварения' },
  { code: 'K80.20', name: 'Камни жёлчного пузыря без холецистита', cat: 'Болезни органов пищеварения' },
  { code: 'C20', name: 'Злокачественное новообразование прямой кишки', cat: 'Новообразования' },
  { code: 'C18.9', name: 'Злокачественное новообразование ободочной кишки', cat: 'Новообразования' },
  { code: 'D12.6', name: 'Доброкачественное новообразование ободочной кишки', cat: 'Новообразования' },
  { code: 'D50.9', name: 'Железодефицитная анемия неуточнённая', cat: 'Болезни крови' },
  { code: 'E11.9', name: 'Сахарный диабет 2 типа без осложнений', cat: 'Эндокринные болезни' },
  { code: 'E78.5', name: 'Гиперлипидемия неуточнённая', cat: 'Эндокринные болезни' },
  { code: 'I10', name: 'Эссенциальная (первичная) гипертензия', cat: 'Болезни системы кровообращения' },
  { code: 'I25.1', name: 'Атеросклеротическая болезнь сердца', cat: 'Болезни системы кровообращения' },
  { code: 'N39.0', name: 'Инфекция мочевыводящих путей без уточнения', cat: 'Болезни мочеполовой системы' },
  { code: 'N18.3', name: 'Хроническая болезнь почек, стадия 3', cat: 'Болезни мочеполовой системы' },
  { code: 'B18.2', name: 'Хронический вирусный гепатит C', cat: 'Инфекционные болезни' },
  { code: 'J06.9', name: 'Острая инфекция верхних дыхательных путей', cat: 'Болезни органов дыхания' },
  { code: 'J45.9', name: 'Астма неуточнённая', cat: 'Болезни органов дыхания' },
  { code: 'M54.5', name: 'Боль внизу спины', cat: 'Болезни костно-мышечной системы' },
  { code: 'M17.0', name: 'Первичный гонартроз двусторонний', cat: 'Болезни костно-мышечной системы' },
  { code: 'R10.4', name: 'Другая и неуточнённая боль в животе', cat: 'Симптомы и признаки' },
  { code: 'Z12.11', name: 'Скрининговое обследование на рак толстой кишки', cat: 'Факторы, влияющие на здоровье' },
]

export function addDiagnosis(list: Diagnosis[], d: Diagnosis): Diagnosis[] {
  if (list.some(x => x.code === d.code)) return list
  const base = d.type === 'main' ? list.map(x => (x.type === 'main' ? { ...x, type: 'concomitant' as DxType } : x)) : list
  return [...base, d]
}

export function fmtDx(list: Diagnosis[]): string {
  if (!list.length) return ''
  return 'Диагноз (МКБ-10):\n' + list.map(d => `${d.code} — ${d.text}${DX_LABEL[d.type] ? ` (${DX_LABEL[d.type]})` : ''}`).join('\n')
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- diagnosis`
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): diagnosis domain (ICD-10 catalog, addDiagnosis, fmtDx) (TDD)"`

---

### Task 2: Consultation store (context) + wire into ConsultationPage

**Files:** `src/features/doctor/consultation/store.tsx`, `ConsultationPage.tsx`.

- [ ] **Step 1: `store.tsx`**
```tsx
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Diagnosis } from '@/domain/diagnosis'
import { addDiagnosis } from '@/domain/diagnosis'

interface ConsultationStore {
  dx: Diagnosis[]
  addDx: (d: Diagnosis) => void
  removeDx: (code: string) => void
}
const Ctx = createContext<ConsultationStore | null>(null)

export function ConsultationStoreProvider({ children }: { children: ReactNode }) {
  const [dx, setDx] = useState<Diagnosis[]>([])
  const value: ConsultationStore = {
    dx,
    addDx: d => setDx(list => addDiagnosis(list, d)),
    removeDx: code => setDx(list => list.filter(x => x.code !== code)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConsultationStore(): ConsultationStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConsultationStore must be used within ConsultationStoreProvider')
  return v
}
```

- [ ] **Step 2: Wrap the consultation content** in `ConsultationPage.tsx` — import `ConsultationStoreProvider` and wrap the returned patient layout (the `<div className="flex h-screen flex-col">…</div>`) in `<ConsultationStoreProvider>…</ConsultationStoreProvider>` so `LeftPanel` and `A4Document` (and its toolbar) share the store. (The "not found" branch does not need the provider.)

- [ ] **Step 3: Gate + commit** — `npm run verify` green (no behavior change yet; existing ConsultationPage smoke still passes). Commit: `git add -A && git commit -m "feat(doctor): consultation store (React context for diagnoses)"`

---

### Task 3: DiagnosisModal + interactive DiagnosisCard

**Files:** `DiagnosisModal.tsx`, `cards/DiagnosisCard.tsx` (replace), `DiagnosisModal.test.tsx`.

- [ ] **Step 1: `src/features/doctor/consultation/DiagnosisModal.tsx`**
```tsx
import { useState } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ICD10, DX_TYPES, type Diagnosis, type DxType } from '@/domain/diagnosis'

export function DiagnosisModal({ existing, onAdd, onClose }: { existing: Diagnosis[]; onAdd: (d: Diagnosis) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState<DxType>(existing.some(d => d.type === 'main') ? 'concomitant' : 'main')
  const [added, setAdded] = useState<string[]>([])
  const has = (code: string) => existing.some(d => d.code === code) || added.includes(code)
  const norm = (s: string) => s.toLowerCase().replace(/[.\s]/g, '')
  const ql = q.trim().toLowerCase(), qc = norm(q)
  const list = ICD10.filter(d => !ql || d.name.toLowerCase().includes(ql) || norm(d.code).includes(qc) || d.cat.toLowerCase().includes(ql))
  const add = (d: (typeof ICD10)[number]) => { if (has(d.code)) return; onAdd({ code: d.code, text: d.name, type }); setAdded(a => [...a, d.code]) }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Добавить диагноз (МКБ-10)</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 rounded-md border px-2">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по коду или названию…" aria-label="Поиск диагноза" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Тип:</span>
          <ToggleGroup type="single" value={type} onValueChange={v => v && setType(v as DxType)}>
            {DX_TYPES.map(t => <ToggleGroupItem key={t.key} value={t.key} aria-label={t.label} className="text-xs">{t.label}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <ScrollArea className="h-80 rounded-md border">
          {list.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Ничего не найдено по «{q}»</div>}
          {list.map(d => {
            const on = has(d.code)
            return (
              <div key={d.code} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{d.code}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{d.name}</span><span className="block truncate text-xs text-muted-foreground">{d.cat}</span></span>
                {on
                  ? <span className="flex items-center gap-1 text-xs text-primary"><Check className="size-3.5" />Добавлен</span>
                  : <Button variant="secondary" size="sm" onClick={() => add(d)}><Plus className="size-3.5" />Добавить</Button>}
              </div>
            )
          })}
        </ScrollArea>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="mr-auto">Найдено: {list.length} · добавлено: {added.length}</span>
          <Button onClick={onClose}><Check className="size-4" />Готово</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Replace `src/features/doctor/consultation/cards/DiagnosisCard.tsx`** with the interactive version (reads the store):
```tsx
import { useState } from 'react'
import { Stethoscope, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '../SectionCard'
import { DiagnosisModal } from '../DiagnosisModal'
import { useConsultationStore } from '../store'
import { DX_TYPES } from '@/domain/diagnosis'

const SHORT = Object.fromEntries(DX_TYPES.map(t => [t.key, t.short]))

export function DiagnosisCard() {
  const { dx, addDx, removeDx } = useConsultationStore()
  const [adding, setAdding] = useState(false)
  return (
    <SectionCard title="Диагноз" icon={<Stethoscope className="size-4" />} count={dx.length}
      action={<Button variant="ghost" size="sm" onClick={() => setAdding(true)}><Plus className="size-4" />Добавить</Button>}>
      {dx.length === 0 && <p className="text-xs text-muted-foreground">Диагноз не указан.</p>}
      <div className="space-y-1.5">
        {dx.map(d => (
          <div key={d.code} className="flex items-start gap-2 text-sm">
            <span className="flex shrink-0 items-center gap-1">
              <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
              <Badge variant={d.type === 'main' ? 'default' : 'secondary'} className="px-1 text-[10px]">{SHORT[d.type]}</Badge>
            </span>
            <span className="min-w-0 flex-1">{d.text}</span>
            <button aria-label="Убрать диагноз" onClick={() => removeDx(d.code)} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {adding && <DiagnosisModal existing={dx} onAdd={addDx} onClose={() => setAdding(false)} />}
    </SectionCard>
  )
}
```

- [ ] **Step 3: Smoke test** `src/features/doctor/consultation/DiagnosisModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DiagnosisModal } from './DiagnosisModal'

describe('DiagnosisModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<DiagnosisModal existing={[]} onAdd={() => {}} onClose={() => {}} />)
    expect(getByText('Добавить диагноз (МКБ-10)')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify` green (DiagnosisModal smoke + ConsultationPage smoke — the card now reads the store, which is provided by ConsultationPage). Commit: `git add -A && git commit -m "feat(doctor): interactive diagnosis card + ICD-10 picker modal"`

---

### Task 4: "Вставить диагноз" toolbar insert + gate + screenshot

**Files:** `RichTextToolbar.tsx`.

- [ ] **Step 1: Add the insert button** to `RichTextToolbar.tsx` — import the store + `fmtDx`, and add a labelled button (after the clear-format button, with a divider) that inserts the formatted diagnoses at the cursor:
```tsx
// imports:
import { Stethoscope } from 'lucide-react'
import { useConsultationStore } from './store'
import { fmtDx } from '@/domain/diagnosis'
// inside RichTextToolbar(), after `const exec = useExec()`:
const { dx } = useConsultationStore()
const insertDx = (e: React.MouseEvent) => {
  e.preventDefault()
  const text = fmtDx(dx)
  if (!text) return
  try { document.execCommand('insertText', false, text + '\n') } catch { /* */ }
}
// in the JSX, after the "Очистить форматирование" button:
<Div />
<button type="button" title="Вставить диагноз из карточки" onMouseDown={insertDx} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><Stethoscope className="size-4" />Диагноз</button>
```
(The toolbar is rendered inside `A4Document` inside `ConsultationPage`'s `ConsultationStoreProvider`, so `useConsultationStore` resolves. The `RichTextToolbar` smoke test renders the toolbar WITHOUT a provider — so update that test to wrap it: `render(<ConsultationStoreProvider><RichTextToolbar /></ConsultationStoreProvider>)`, importing the provider.)

- [ ] **Step 2: Update `RichTextToolbar.test.tsx`** to wrap in the provider:
```tsx
import { ConsultationStoreProvider } from './store'
// change render(...) to:
const { container, getByTitle } = render(<ConsultationStoreProvider><RichTextToolbar /></ConsultationStoreProvider>)
```

- [ ] **Step 3: Gate** — `npm run verify && npm run build` — all green; report counts.
- [ ] **Step 4: Manual** — `npm run dev`; open a consultation → "Диагноз" card "Добавить" opens the ICD-10 search; add a main + a concomitant → they list with badges; the previous main demotes; remove works; put the cursor in a document section and click the toolbar "Диагноз" button → the formatted diagnosis text inserts. Stop dev.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doctor): insert diagnosis from card into the document"`.
(Controller then screenshots the diagnosis picker for the owner.)

---

## Self-Review (plan author)

**Spec coverage:** First slice of Plan 2's deferred "left-panel pickers": the Diagnosis card becomes interactive (Task 3) backed by a typed store (Task 2) with pure logic (Task 1, TDD), and wires into the document via a toolbar insert (Task 4) — the same store/modal/insert pattern Services + Prescriptions reuse in the next plan. Ported from the prototype (ICD10, DiagnosisModal, DiagnosisCard, fmtDx); re-skinned on design-system Dialog/ToggleGroup/ScrollArea/Badge; `window.CN_STORE.dx` → typed React context. Russian verbatim; no emojis. Services/Recommendations/Prescriptions/Templates + the other blue-insert buttons remain the NEXT plan.

**Placeholder scan:** No TODOs. ICD10 is the full 28-row catalog. Every code step is complete. The RichTextToolbar smoke test's provider-wrap is explicitly specified (Task 4 Steps 1–2) so it doesn't throw on `useConsultationStore`.

**Type consistency:** `Diagnosis`/`DxType`/`IcdCode` in `domain/diagnosis.ts`, consumed by `store.tsx`, `DiagnosisModal`, `DiagnosisCard`, and the toolbar insert. `addDiagnosis`/`fmtDx` signatures match their tests and callers. `useConsultationStore()` returns `{ dx, addDx, removeDx }` used by `DiagnosisCard` (all three) + `RichTextToolbar` (dx). Provider wraps `ConsultationPage`'s patient layout so every consumer resolves.

**Scope:** One coherent interactive feature (diagnosis) end-to-end: pick → list → insert; pure logic unit-tested, UI smoke-tested, visually validated.
