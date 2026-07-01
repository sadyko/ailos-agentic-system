# Aurora Redesign — Plan 6: Prescriptions (drug picker) + printable recipe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation's "Рецепт" (prescriptions) card interactive: a drug picker (search INN/trade → form → dose/freq/days, light or detailed/injection mode), a prescriptions list, a printable recipe, and a toolbar "Вставить рецепт" insert. Reuses the store/modal/card pattern from Plans 4–5.

**Architecture:** Extend the consultation store with `rx: Prescription[]` + `addRx`/`removeRx`. `RxCard` (replacing its Plan-2 shell) reads the store, opens `PrescribeModal` (search + form + dosage; detailed mode adds route/solvent/volume/rate for injections), and "Сформировать рецепт" opens `RecipeModal` (a printable Rp: sheet). `RichTextToolbar` gains "Вставить рецепт" (`fmtRx` → insert at cursor), consuming the store's `rx`. Ported from prototype `consultation-left.jsx` (DRUGS L631–676, rxUsage/rxQty L678–696, RxCard L698–731, PrescribeModal L734+) and `consultation.jsx` (fmtRx L44–46). Recipe print reuses the `is-printing`/`.print-doc-root` CSS added in Plan 3.

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Dialog`/`Button`/`Input`/`Select`/`ToggleGroup`/`ScrollArea`/`Separator`, lucide-react, Vitest + jest-axe. `dropdown` via `Select`.

**Testability:** `rxUsage`/`fmtRx` are pure → TDD. Modal/card/recipe are render+axe smoke tests; `window.print` is a jsdom no-op.

**Reference:** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation-left.jsx`. Prior: Plans 4–5 (diagnosis/services store+modal+card).

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/domain/prescriptions.ts        # Prescription, DRUGS, RX_ROUTES, RX_SOLVENTS, rxUsage, fmtRx
src/domain/prescriptions.test.ts   # rxUsage + fmtRx (TDD)
src/features/doctor/consultation/
  store.tsx                        # + rx, addRx, removeRx
  PrescribeModal.tsx               # drug picker (light/detailed)
  RecipeModal.tsx                  # printable Rp: sheet
  PrescribeModal.test.tsx          # smoke
  RecipeModal.test.tsx             # smoke
  cards/RxCard.tsx                 # REPLACE shell with interactive card
  RichTextToolbar.tsx              # + "Вставить рецепт"
```

---

### Task 1: Prescriptions domain (TDD) + store extension

**Files:** `src/domain/prescriptions.ts`, `src/domain/prescriptions.test.ts`, `store.tsx`.

- [ ] **Step 1: Failing tests** `src/domain/prescriptions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DRUGS, rxUsage, fmtRx, type Prescription } from './prescriptions'

const base: Prescription = { inn: 'Диосмин + Гесперидин', trade: 'Детралекс', group: 'Венотоник', form: 'таблетки 1000 мг', unit: 'таб.', dose: '1 таб.', freq: '2 раза/день', days: '7 дней', note: '', detailed: false, route: 'внутрь', solvent: '', volume: '', rate: '', rateUnit: 'мл/ч' }

describe('prescriptions domain', () => {
  it('DRUGS is a catalog of INN + trade names + forms', () => {
    expect(DRUGS.length).toBeGreaterThan(10)
    expect(DRUGS[0]).toHaveProperty('inn'); expect(DRUGS[0]).toHaveProperty('trade'); expect(DRUGS[0]).toHaveProperty('forms')
  })
  it('rxUsage (light) joins dose/freq/days', () => {
    expect(rxUsage(base)).toBe('1 таб., 2 раза/день, 7 дней')
  })
  it('rxUsage (detailed injection) describes route/solvent/volume/rate', () => {
    const inj: Prescription = { ...base, detailed: true, route: 'в/в капельно', solvent: 'Натрия хлорид 0.9%', volume: '100', rate: '60', rateUnit: 'мл/ч', dose: '', freq: '1 раз/день', days: '5 дней' }
    expect(rxUsage(inj)).toContain('в/в капельно')
    expect(rxUsage(inj)).toContain('растворитель Натрия хлорид 0.9%')
    expect(rxUsage(inj)).toContain('объём 100 мл')
  })
  it('fmtRx numbers the meds', () => {
    expect(fmtRx([base])).toBe('Назначения:\n1. Детралекс (Диосмин + Гесперидин), таблетки 1000 мг — 1 таб., 2 раза/день, 7 дней')
    expect(fmtRx([])).toBe('')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- prescriptions`

- [ ] **Step 3: Implement** `src/domain/prescriptions.ts` (DRUGS + rxUsage + fmtRx ported verbatim):
```ts
export interface DrugForm { label: string; kind: 'oral' | 'supp' | 'inj' | 'inf'; unit: string }
export interface Drug { inn: string; trade: string[]; group: string; forms: DrugForm[] }
export interface Prescription {
  inn: string; trade: string; group: string; form: string; unit: string
  dose: string; freq: string; days: string; note: string
  detailed: boolean; route: string; solvent: string; volume: string; rate: string; rateUnit: string
}

export const RX_ROUTES = ['внутрь', 'в/в капельно', 'в/в струйно', 'в/м', 'п/к', 'ректально', 'местно']
export const RX_SOLVENTS = ['Натрия хлорид 0.9%', 'Глюкоза 5%', 'Раствор Рингера', '—']

export const DRUGS: Drug[] = [
  { inn: 'Диосмин + Гесперидин', trade: ['Детралекс', 'Венарус', 'Флебодиа 600'], group: 'Венотоник', forms: [{ label: 'таблетки, покр. оболочкой 1000 мг', kind: 'oral', unit: 'таб.' }, { label: 'таблетки, покр. оболочкой 500 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Натрия альгинат', trade: ['Натальсид'], group: 'Гемостатик местный', forms: [{ label: 'суппозитории ректальные 250 мг', kind: 'supp', unit: 'супп.' }] },
  { inn: 'Парацетамол', trade: ['Панадол', 'Перфалган', 'Цефекон'], group: 'Анальгетик-антипиретик', forms: [{ label: 'таблетки 500 мг', kind: 'oral', unit: 'таб.' }, { label: 'раствор для инфузий 10 мг/мл, 100 мл', kind: 'inf', unit: 'фл.' }] },
  { inn: 'Омепразол', trade: ['Омез', 'Лосек'], group: 'Ингибитор протонной помпы', forms: [{ label: 'капсулы 20 мг', kind: 'oral', unit: 'капс.' }, { label: 'лиофилизат для инфузий 40 мг', kind: 'inf', unit: 'фл.' }] },
  { inn: 'Цефтриаксон', trade: ['Роцефин', 'Цефтриаксон'], group: 'Антибиотик (цефалоспорин III)', forms: [{ label: 'порошок для приготовления раствора 1000 мг', kind: 'inj', unit: 'фл.' }] },
  { inn: 'Метронидазол', trade: ['Метрогил', 'Трихопол'], group: 'Противомикробное', forms: [{ label: 'раствор для инфузий 5 мг/мл, 100 мл', kind: 'inf', unit: 'фл.' }, { label: 'таблетки 250 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Натрия хлорид', trade: ['Физиологический раствор'], group: 'Растворитель / инфузия', forms: [{ label: 'раствор для инфузий 0.9%, 200 мл', kind: 'inf', unit: 'фл.' }, { label: 'раствор для инфузий 0.9%, 400 мл', kind: 'inf', unit: 'фл.' }] },
  { inn: 'Декстроза (глюкоза)', trade: ['Глюкоза'], group: 'Растворитель / инфузия', forms: [{ label: 'раствор для инфузий 5%, 200 мл', kind: 'inf', unit: 'фл.' }] },
  { inn: 'Кеторолак', trade: ['Кеторол', 'Кетанов'], group: 'НПВС (анальгетик)', forms: [{ label: 'раствор для инъекций 30 мг/мл, 1 мл', kind: 'inj', unit: 'амп.' }, { label: 'таблетки 10 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Диклофенак', trade: ['Вольтарен', 'Диклоберл'], group: 'НПВС', forms: [{ label: 'раствор для инъекций 25 мг/мл, 3 мл', kind: 'inj', unit: 'амп.' }, { label: 'суппозитории 50 мг', kind: 'supp', unit: 'супп.' }] },
  { inn: 'Амлодипин', trade: ['Норваск', 'Тенокс'], group: 'Антагонист кальция', forms: [{ label: 'таблетки 5 мг', kind: 'oral', unit: 'таб.' }, { label: 'таблетки 10 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Метформин', trade: ['Глюкофаж', 'Сиофор'], group: 'Сахароснижающее', forms: [{ label: 'таблетки 500 мг', kind: 'oral', unit: 'таб.' }, { label: 'таблетки 1000 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Ципрофлоксацин', trade: ['Ципролет', 'Цифран'], group: 'Антибиотик (фторхинолон)', forms: [{ label: 'таблетки 500 мг', kind: 'oral', unit: 'таб.' }, { label: 'раствор для инфузий 2 мг/мл, 100 мл', kind: 'inf', unit: 'фл.' }] },
  { inn: 'Транексамовая кислота', trade: ['Транексам'], group: 'Гемостатик системный', forms: [{ label: 'раствор для инъекций 50 мг/мл, 5 мл', kind: 'inj', unit: 'амп.' }, { label: 'таблетки 250 мг', kind: 'oral', unit: 'таб.' }] },
  { inn: 'Калия хлорид', trade: ['Калия хлорид'], group: 'Электролит (концентрат)', forms: [{ label: 'концентрат для инфузий 40 мг/мл, 10 мл', kind: 'inf', unit: 'амп.' }] },
  { inn: 'Дротаверин', trade: ['Но-шпа'], group: 'Спазмолитик', forms: [{ label: 'таблетки 40 мг', kind: 'oral', unit: 'таб.' }, { label: 'раствор для инъекций 20 мг/мл, 2 мл', kind: 'inj', unit: 'амп.' }] },
]

export function rxUsage(m: Prescription): string {
  const inj = m.detailed && m.route && m.route !== 'внутрь' && m.route !== 'ректально' && m.route !== 'местно'
  if (inj) {
    return [m.route,
      m.solvent && m.solvent !== '—' ? `растворитель ${m.solvent}` : null,
      m.volume ? `объём ${m.volume} мл` : null,
      m.rate ? `скорость ${m.rate} ${m.rateUnit}` : null,
      m.freq, m.days, m.note].filter(Boolean).join('; ')
  }
  return [m.dose, m.freq, m.days, m.note].filter(Boolean).join(', ')
}

export function fmtRx(list: Prescription[]): string {
  if (!list.length) return ''
  return 'Назначения:\n' + list.map((m, i) => `${i + 1}. ${m.trade} (${m.inn}), ${m.form} — ${rxUsage(m)}`).join('\n')
}

export const routeForKind = (k: DrugForm['kind']): string => k === 'inf' ? 'в/в капельно' : k === 'inj' ? 'в/м' : k === 'supp' ? 'ректально' : 'внутрь'
```

- [ ] **Step 4: Run — PASS:** `npm run test -- prescriptions`

- [ ] **Step 5: Extend the store** `store.tsx` — add `rx` alongside dx/services (keep those as-is):
```tsx
import type { Prescription } from '@/domain/prescriptions'
// interface: rx: Prescription[]; addRx: (m: Prescription) => void; removeRx: (index: number) => void
// provider: const [rx, setRx] = useState<Prescription[]>([])
// value: rx, addRx: m => setRx(list => [...list, m]), removeRx: index => setRx(list => list.filter((_, i) => i !== index)),
```

- [ ] **Step 6: Gate + commit** — `npm run verify` green. Commit: `git add -A && git commit -m "feat(doctor): prescriptions domain (DRUGS, rxUsage, fmtRx) + store rx (TDD)"`

---

### Task 2: PrescribeModal + interactive RxCard

**Files:** `PrescribeModal.tsx`, `PrescribeModal.test.tsx`, `cards/RxCard.tsx` (replace).

- [ ] **Step 1: `src/features/doctor/consultation/PrescribeModal.tsx`**
```tsx
import { useState } from 'react'
import { Pill, Search, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DRUGS, RX_ROUTES, RX_SOLVENTS, routeForKind, type Drug, type Prescription } from '@/domain/prescriptions'

export function PrescribeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Prescription) => void }) {
  const [mode, setMode] = useState<'light' | 'full'>('light')
  const [q, setQ] = useState('')
  const [drug, setDrug] = useState<Drug | null>(null)
  const [formIdx, setFormIdx] = useState(0)
  const [dose, setDose] = useState(''); const [freq, setFreq] = useState(''); const [days, setDays] = useState(''); const [note, setNote] = useState('')
  const [route, setRoute] = useState('внутрь'); const [solvent, setSolvent] = useState('Натрия хлорид 0.9%'); const [volume, setVolume] = useState(''); const [rate, setRate] = useState('')

  const matches = q.trim() ? DRUGS.filter(d => (d.inn + ' ' + d.trade.join(' ')).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []
  const form = drug ? drug.forms[formIdx] : null
  const isInject = !!form && (form.kind === 'inf' || form.kind === 'inj')
  const pick = (d: Drug) => { setDrug(d); setFormIdx(0); setQ(''); setRoute(routeForKind(d.forms[0].kind)) }
  const changeForm = (i: number) => { setFormIdx(i); if (drug) setRoute(routeForKind(drug.forms[i].kind)) }
  const submit = () => {
    if (!drug || !form) return
    const detailed = mode === 'full'
    onAdd({
      inn: drug.inn, trade: drug.trade[0], group: drug.group, form: form.label, unit: form.unit,
      dose, freq, days, note, detailed,
      route: detailed ? route : (form.kind === 'supp' ? 'ректально' : 'внутрь'),
      solvent: detailed && isInject ? solvent : '', volume: detailed && isInject ? volume : '', rate: detailed && isInject ? rate : '', rateUnit: 'мл/ч',
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pill className="size-4" />Назначить медикамент</DialogTitle></DialogHeader>
        <ToggleGroup type="single" value={mode} onValueChange={v => v && setMode(v as 'light' | 'full')} className="w-fit">
          <ToggleGroupItem value="light" aria-label="Лайт">Лайт</ToggleGroupItem>
          <ToggleGroupItem value="full" aria-label="Детальная">Детальная</ToggleGroupItem>
        </ToggleGroup>
        {!drug ? (
          <>
            <div className="flex items-center gap-2 rounded-md border px-2">
              <Search className="size-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по МНН или торговому наименованию…" aria-label="Поиск препарата" className="h-9 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="max-h-64 space-y-1 overflow-auto">
              {matches.map(d => (
                <button key={d.inn} onClick={() => pick(d)} className="flex w-full flex-col rounded px-3 py-2 text-left hover:bg-accent">
                  <span className="text-sm font-medium">{d.trade.join(' · ')}</span>
                  <span className="text-xs text-muted-foreground">{d.inn} · {d.group}</span>
                </button>
              ))}
              {q.trim() && matches.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Ничего не найдено.</p>}
              {!q.trim() && <p className="p-3 text-center text-sm text-muted-foreground">Введите название препарата.</p>}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-2 text-sm"><b>{drug.trade[0]}</b> · {drug.inn} <span className="text-muted-foreground">· {drug.group}</span></div>
            <label className="block text-xs text-muted-foreground">Форма выпуска
              <Select value={String(formIdx)} onValueChange={v => changeForm(Number(v))}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{drug.forms.map((f, i) => <SelectItem key={i} value={String(i)}>{f.label}</SelectItem>)}</SelectContent></Select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs text-muted-foreground">Доза<Input className="mt-1" value={dose} onChange={e => setDose(e.target.value)} placeholder="1 таб." /></label>
              <label className="block text-xs text-muted-foreground">Кратность<Input className="mt-1" value={freq} onChange={e => setFreq(e.target.value)} placeholder="2 раза/день" /></label>
              <label className="block text-xs text-muted-foreground">Длительность<Input className="mt-1" value={days} onChange={e => setDays(e.target.value)} placeholder="7 дней" /></label>
            </div>
            {mode === 'full' && isInject && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                <label className="block text-xs text-muted-foreground">Путь введения
                  <Select value={route} onValueChange={setRoute}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{RX_ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></label>
                <label className="block text-xs text-muted-foreground">Растворитель
                  <Select value={solvent} onValueChange={setSolvent}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{RX_SOLVENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></label>
                <label className="block text-xs text-muted-foreground">Объём, мл<Input className="mt-1" value={volume} onChange={e => setVolume(e.target.value)} placeholder="100" /></label>
                <label className="block text-xs text-muted-foreground">Скорость, мл/ч<Input className="mt-1" value={rate} onChange={e => setRate(e.target.value)} placeholder="60" /></label>
              </div>
            )}
            <label className="block text-xs text-muted-foreground">Примечание<Input className="mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="после еды" /></label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDrug(null)}>Назад к поиску</Button>
              <Button onClick={submit}><Plus className="size-4" />Добавить в рецепт</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Replace `cards/RxCard.tsx`**
```tsx
import { useState } from 'react'
import { Pill, Plus, X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '../SectionCard'
import { PrescribeModal } from '../PrescribeModal'
import { RecipeModal } from '../RecipeModal'
import { useConsultationStore } from '../store'
import { rxUsage } from '@/domain/prescriptions'
import type { Patient } from '@/domain/types'

export function RxCard({ patient }: { patient: Patient }) {
  const { rx, addRx, removeRx } = useConsultationStore()
  const [open, setOpen] = useState(false)
  const [recipe, setRecipe] = useState(false)
  return (
    <SectionCard title="Рецепт" icon={<Pill className="size-4" />} count={rx.length}
      action={<Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />Добавить</Button>}>
      {rx.length === 0 && <p className="text-xs text-muted-foreground">Назначения не добавлены.</p>}
      <div className="space-y-2">
        {rx.map((m, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Pill className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate"><b>{m.trade}</b> <span className="text-xs text-muted-foreground">· {m.inn}</span></div>
              <div className="text-xs text-muted-foreground">{m.form} — {rxUsage(m)}</div>
            </div>
            <button aria-label="Убрать из рецепта" onClick={() => removeRx(i)} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {rx.length > 0 && <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => setRecipe(true)}><Printer className="size-4" />Сформировать рецепт</Button>}
      {open && <PrescribeModal onClose={() => setOpen(false)} onAdd={addRx} />}
      {recipe && <RecipeModal patient={patient} meds={rx} onClose={() => setRecipe(false)} />}
    </SectionCard>
  )
}
```
(NOTE: `RxCard` now takes a `patient` prop. Update `LeftPanel.tsx` to pass it: `<RxCard patient={patient} />`.)

- [ ] **Step 3: Update `LeftPanel.tsx`** — change `<RxCard />` to `<RxCard patient={patient} />` (patient is already a prop of LeftPanel).

- [ ] **Step 4: Smoke test** `PrescribeModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PrescribeModal } from './PrescribeModal'

describe('PrescribeModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<PrescribeModal onClose={() => {}} onAdd={() => {}} />)
    expect(getByText('Назначить медикамент')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 5: Gate + commit** — `npm run verify` green (needs `RecipeModal` to exist for the import in RxCard; if executing strictly in order, create a minimal `RecipeModal` stub first: `export function RecipeModal(){ return null }`, fully built in Task 3 — OR do Task 3 before running this task's verify). Commit: `git add -A && git commit -m "feat(doctor): interactive prescriptions card + drug picker (light/detailed)"`

---

### Task 3: RecipeModal (printable) + toolbar "Вставить рецепт"

**Files:** `RecipeModal.tsx`, `RecipeModal.test.tsx`, `RichTextToolbar.tsx`.

- [ ] **Step 1: `src/features/doctor/consultation/RecipeModal.tsx`** — a printable Rp: sheet; "Печать" clones the sheet into a `.print-doc-root` (reusing the Plan-3 print CSS), closes the modal, and prints:
```tsx
import { useRef } from 'react'
import { Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Patient } from '@/domain/types'
import type { Prescription } from '@/domain/prescriptions'
import { rxUsage } from '@/domain/prescriptions'
import { ruAge, CLINIC_FOOTER } from '@/domain/consultation'

export function RecipeModal({ patient, meds, onClose }: { patient: Patient; meds: Prescription[]; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  const print = () => {
    const node = sheet.current; if (!node) return
    const clone = node.cloneNode(true) as HTMLElement
    const wrap = document.createElement('div'); wrap.className = 'print-doc-root'
    wrap.style.cssText = 'position:absolute; left:-99999px; top:0; width:794px;'
    wrap.appendChild(clone); document.body.appendChild(wrap)
    const pageSt = document.createElement('style'); pageSt.textContent = '@media print{ @page{ size: A4 portrait; margin: 16mm; } }'
    document.head.appendChild(pageSt)
    onClose()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.add('is-printing')
      const cleanup = () => { document.body.classList.remove('is-printing'); wrap.remove(); pageSt.remove() }
      window.addEventListener('afterprint', cleanup, { once: true })
      setTimeout(cleanup, 60000)
      window.print()
    }))
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Рецептурный бланк</DialogTitle></DialogHeader>
        <div ref={sheet} className="rounded-md border bg-white p-6 text-sm text-black">
          <div className="text-center font-semibold">Медицинский рецепт</div>
          <div className="mt-2 text-xs text-neutral-600">Пациент: {patient.name} · {ruAge(patient.age)} · {patient.sex === 'Ж' ? 'жен.' : 'муж.'} · ID {patient.id}</div>
          <Separator className="my-3" />
          <div className="font-semibold">Rp:</div>
          <ol className="mt-1 list-decimal space-y-2 pl-5">
            {meds.map((m, i) => (
              <li key={i}><b>{m.trade}</b> ({m.inn}), {m.form}<div className="text-xs text-neutral-600">D.S. {rxUsage(m)}</div></li>
            ))}
          </ol>
          <Separator className="my-3" />
          <div className="flex justify-between text-xs text-neutral-600"><span>Врач: Казанцева Н. В. ________</span><span>Дата: 04.06.2026</span></div>
          <div className="mt-3 text-[10px] text-neutral-500">{CLINIC_FOOTER}</div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
          <Button onClick={print}><Printer className="size-4" />Печать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Smoke test** `RecipeModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RecipeModal } from './RecipeModal'
import type { Prescription } from '@/domain/prescriptions'

const med: Prescription = { inn: 'Диосмин + Гесперидин', trade: 'Детралекс', group: 'Венотоник', form: 'таблетки 1000 мг', unit: 'таб.', dose: '1 таб.', freq: '2 раза/день', days: '7 дней', note: '', detailed: false, route: 'внутрь', solvent: '', volume: '', rate: '', rateUnit: 'мл/ч' }
const patient = { num: 1, id: 1, name: 'Тест Пациент', dob: '', age: 40, sex: 'Ж' as const, visit: '', stype: '', service: '', status: 'now' as const, coverage: '', source: '', time: '', done: '', day: 0, phone: '' }

describe('RecipeModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<RecipeModal patient={patient} meds={[med]} onClose={() => {}} />)
    expect(getByText('Рецептурный бланк')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 3: Toolbar "Вставить рецепт"** — in `RichTextToolbar.tsx`, add (next to the "Диагноз" insert): import `Pill` (already imported? add if not) + `fmtRx` from `@/domain/prescriptions`; read `rx` from the store (`const { dx, rx } = useConsultationStore()`); add an insert handler + button:
```tsx
const insertRx = (e: React.MouseEvent) => { e.preventDefault(); const t = fmtRx(rx); if (!t) return; try { document.execCommand('insertText', false, t + '\n') } catch { /* */ } }
// button after the "Диагноз" button:
<button type="button" title="Вставить рецепт из карточки" onMouseDown={insertRx} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><Pill className="size-4" />Рецепт</button>
```

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green (RecipeModal + PrescribeModal smoke; toolbar; all prior). Commit: `git add -A && git commit -m "feat(doctor): printable recipe + insert prescriptions into the document"`

---

### Task 4: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2: Manual** — open a consultation → "Рецепт" "Добавить" → search a drug (e.g. «детралекс») → pick → set dose/freq/days → add; it lists; "Сформировать рецепт" shows the Rp: sheet; the toolbar "Рецепт" inserts the prescriptions text into the document. Stop dev.
- [ ] **Step 3: Commit** any final touch: `git add -A && git commit -m "chore: prescriptions gate green"`.
(Controller then screenshots the drug picker + recipe for the owner.)

---

## Self-Review (plan author)

**Spec coverage:** Third/fourth left-panel pickers slice: the "Рецепт" card is interactive (Task 2) with a light/detailed drug picker (search → form → dosage; injections add route/solvent/volume/rate), a printable recipe (Task 3), and a toolbar insert (`fmtRx`, Task 3), backed by the store extended with `rx` (Task 1, TDD on `rxUsage`/`fmtRx`). Ported from the prototype (DRUGS, rxUsage, RxCard, PrescribeModal, fmtRx); re-skinned on design-system Dialog/Select/ToggleGroup/Input; recipe print reuses the Plan-3 `.print-doc-root`/`is-printing` CSS. Russian verbatim; no emojis. Recommendations (recs, doctor/slot + history) + templates remain — the last pickers, then hints/past-results, then draft/version history complete the consultation.

**Placeholder scan:** No TODOs. DRUGS is the full 16-drug catalog. `RecipeModal` stub note (Task 2 Step 5) is an explicit ordering aid, resolved in Task 3. Every code step is complete.

**Type consistency:** `Prescription`/`Drug`/`DrugForm` in `domain/prescriptions.ts`; `rxUsage`/`fmtRx`/`routeForKind` consumed by `PrescribeModal`, `RxCard`, `RecipeModal`, toolbar. Store adds `rx`/`addRx`/`removeRx(index)` used by `RxCard`; `onAdd:(m:Prescription)` matches `addRx`. `RxCard` gains a `patient` prop (passed by `LeftPanel`, which has `patient`). `RecipeModal({patient, meds, onClose})` matches its caller. `ruAge`/`CLINIC_FOOTER` from `@/domain/consultation` (exist). Toolbar reads `{ dx, rx }` from the store (both provided).

**Scope:** One coherent interactive feature (prescriptions) end-to-end: pick (2 modes) → list → recipe (print) → insert; pure logic unit-tested, UI smoke-tested, visually validated.
