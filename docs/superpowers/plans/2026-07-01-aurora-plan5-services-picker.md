# Aurora Redesign — Plan 5: Services picker ("Услуги приёма")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation's "Услуги приёма" (visit services) card interactive: a 3-column service picker (type → direction → service+price), a services list with per-row price + total + remove, held in the shared consultation store. Reuses the diagnosis store/modal/card pattern from Plan 4.

**Architecture:** Extend `ConsultationStoreProvider` with `services: Service[]` + `addService`/`removeService`. `ServicesCard` (replacing its Plan-2 shell) reads the store and opens `ServicePickerModal` (own-mode 3-column picker over the doctor's own-service catalog). No document insert (the prototype's toolbar has no services insert — services are billed line-items, not document text). Ported from prototype `consultation-left.jsx` (OWN_* catalog L212–224, ServicePickerModal own-mode L261–367, ServicesCard L483–504).

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Dialog`/`Button`/`ScrollArea`, lucide-react, Vitest + jest-axe. `moneyFmt` from `@/domain/format`.

**Testability:** the catalog is data (a shape assertion); the picker/card are render+axe smoke tests. Follow the Plan 4 pattern.

**Reference:** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation-left.jsx`. Prior: Plan 4 (diagnosis store/modal/card).

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/domain/services.ts             # Service, OWN_TYPES, OWN_DIRS, OWN_BY_DIR
src/domain/services.test.ts        # catalog shape
src/features/doctor/consultation/
  store.tsx                        # + services, addService, removeService
  ServicePickerModal.tsx           # own-mode 3-column picker
  ServicePickerModal.test.tsx      # smoke
  cards/ServicesCard.tsx           # REPLACE shell with interactive card
```

---

### Task 1: Services domain + store extension

**Files:** `src/domain/services.ts`, `src/domain/services.test.ts`, `src/features/doctor/consultation/store.tsx` (extend).

- [ ] **Step 1: Failing test** `src/domain/services.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { OWN_TYPES, OWN_DIRS, OWN_BY_DIR } from './services'

describe('services catalog', () => {
  it('has own types + the Проктология direction with priced services', () => {
    expect(OWN_TYPES.length).toBeGreaterThan(0)
    expect(OWN_DIRS).toContain('Проктология')
    const svc = OWN_BY_DIR['Проктология']
    expect(svc.length).toBeGreaterThan(3)
    expect(svc[0]).toHaveProperty('n'); expect(svc[0]).toHaveProperty('p')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- services`

- [ ] **Step 3: Implement** `src/domain/services.ts` (ported verbatim):
```ts
export interface Service { name: string; price: number }
export interface CatalogService { n: string; p: number }

export const OWN_TYPES = ['Консультация', 'Инструментальная диагностика', 'Процедуры и лечение']
export const OWN_DIRS = ['Проктология']
export const OWN_BY_DIR: Record<string, CatalogService[]> = {
  'Проктология': [
    { n: 'Приём (осмотр, консультация) онкопроктолога', p: 280000 },
    { n: 'Повторный приём онкопроктолога', p: 180000 },
    { n: 'Аноскопия', p: 120000 },
    { n: 'Ректороманоскопия', p: 320000 },
    { n: 'Лигирование геморроидальных узлов', p: 450000 },
    { n: 'Перевязка / обработка раны', p: 80000 },
    { n: 'Биопсия (прицельная)', p: 260000 },
  ],
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- services`

- [ ] **Step 5: Extend the store** `src/features/doctor/consultation/store.tsx` — add services alongside dx. Update the interface + provider (keep dx exactly as-is):
```tsx
import type { Diagnosis } from '@/domain/diagnosis'
import type { Service } from '@/domain/services'
// interface ConsultationStore: add
  services: Service[]
  addService: (s: Service) => void
  removeService: (index: number) => void
// provider: add
  const [services, setServices] = useState<Service[]>([])
// value: add
    services,
    addService: s => setServices(list => [...list, s]),
    removeService: index => setServices(list => list.filter((_, i) => i !== index)),
```

- [ ] **Step 6: Gate + commit** — `npm run verify` green. Commit: `git add -A && git commit -m "feat(doctor): services catalog + store services (add/remove)"`

---

### Task 2: ServicePickerModal + interactive ServicesCard

**Files:** `ServicePickerModal.tsx`, `ServicePickerModal.test.tsx`, `cards/ServicesCard.tsx` (replace).

- [ ] **Step 1: `src/features/doctor/consultation/ServicePickerModal.tsx`**
```tsx
import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { OWN_TYPES, OWN_DIRS, OWN_BY_DIR, type Service, type CatalogService } from '@/domain/services'
import { moneyFmt } from '@/domain/format'

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border">
      <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
    </div>
  )
}

export function ServicePickerModal({ onAdd, onClose }: { onAdd: (s: Service) => void; onClose: () => void }) {
  const [type, setType] = useState(OWN_TYPES[0])
  const [dir, setDir] = useState(OWN_DIRS[0])
  const [srv, setSrv] = useState<string>(OWN_BY_DIR[OWN_DIRS[0]]?.[0]?.n ?? '')
  const [added, setAdded] = useState(0)
  const services = OWN_BY_DIR[dir] ?? []
  const selected = services.find(s => s.n === srv)
  const emit = (s?: CatalogService) => { if (!s) return; onAdd({ name: s.n, price: s.p }); setAdded(a => a + 1) }
  const rowCls = (on: boolean) => cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent', on && 'bg-accent font-medium')
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Добавить услугу приёма</DialogTitle></DialogHeader>
        <div className="grid h-80 grid-cols-[1fr_1fr_1.4fr] gap-2">
          <Col title="Типы услуг">{OWN_TYPES.map(t => <button key={t} className={rowCls(type === t)} onClick={() => setType(t)}>{t}</button>)}</Col>
          <Col title="Направление">{OWN_DIRS.map(d => <button key={d} className={rowCls(dir === d)} onClick={() => setDir(d)}>{d}</button>)}</Col>
          <Col title="Услуги">
            {services.map(s => (
              <button key={s.n} className={rowCls(srv === s.n)} onClick={() => setSrv(s.n)} onDoubleClick={() => emit(s)} title="Двойной клик — добавить услугу">
                <span className="min-w-0 flex-1 truncate">{s.n}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{moneyFmt(s.p)}</span>
              </button>
            ))}
          </Col>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="mr-auto">Двойной клик по услуге — добавить{added > 0 ? ` · добавлено: ${added}` : ''}</span>
          <Button variant="ghost" onClick={onClose}>{added > 0 ? 'Готово' : 'Отмена'}</Button>
          <Button disabled={!selected} onClick={() => emit(selected)}><Plus className="size-4" />Добавить услугу</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Replace `src/features/doctor/consultation/cards/ServicesCard.tsx`**
```tsx
import { useState } from 'react'
import { FlaskConical, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '../SectionCard'
import { ServicePickerModal } from '../ServicePickerModal'
import { useConsultationStore } from '../store'
import { moneyFmt } from '@/domain/format'

export function ServicesCard() {
  const { services, addService, removeService } = useConsultationStore()
  const [open, setOpen] = useState(false)
  const total = services.reduce((sum, s) => sum + s.price, 0)
  return (
    <SectionCard title="Услуги приёма" icon={<FlaskConical className="size-4" />} count={services.length}
      action={<Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />Добавить</Button>}>
      {services.length === 0 && <p className="text-xs text-muted-foreground">Услуги не добавлены.</p>}
      <div className="space-y-1.5">
        {services.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{moneyFmt(s.price)} сум</span>
            <button aria-label="Убрать услугу" onClick={() => removeService(i)} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {services.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-medium">
          <span>Итого</span><span className="tabular-nums">{moneyFmt(total)} сум</span>
        </div>
      )}
      {open && <ServicePickerModal onAdd={addService} onClose={() => setOpen(false)} />}
    </SectionCard>
  )
}
```

- [ ] **Step 3: Smoke test** `src/features/doctor/consultation/ServicePickerModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ServicePickerModal } from './ServicePickerModal'

describe('ServicePickerModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<ServicePickerModal onAdd={() => {}} onClose={() => {}} />)
    expect(getByText('Добавить услугу приёма')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify` green (ServicePickerModal smoke + ConsultationPage smoke — the card reads the store via the page provider). Commit: `git add -A && git commit -m "feat(doctor): interactive services card + service picker"`

---

### Task 3: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — all green; report counts.
- [ ] **Step 2: Manual** — open a consultation → "Услуги приёма" "Добавить" opens the 3-column picker; select/double-click a service → it lists with price; the card shows the total; remove works. Stop dev.
- [ ] **Step 3: Commit** any final touch: `git add -A && git commit -m "chore: services picker gate green"`.
(Controller then screenshots the services picker for the owner.)

---

## Self-Review (plan author)

**Spec coverage:** Second left-panel picker (after diagnosis): the "Услуги приёма" card is interactive (Task 2), backed by the shared store extended with services (Task 1), over the ported own-service catalog. Reuses the Plan-4 store/modal/card pattern. No document insert (faithful — the prototype's toolbar has no services insert; services are billed line-items). Recommendations (recs, with doctor/slot + history) and Prescriptions (drug picker + printable recipe) remain the NEXT plans.

**Placeholder scan:** No TODOs. The catalog is the full ported list. Store extension shows the exact added fields (dx untouched). Every code step is complete.

**Type consistency:** `Service`/`CatalogService` in `domain/services.ts`, consumed by `store.tsx`, `ServicePickerModal`, `ServicesCard`. Store adds `services`/`addService`/`removeService(index)` — `ServicesCard` uses all three; `removeService(i)` matches the index-based remove. `onAdd: (s: Service)` matches `addService`. `moneyFmt` from `@/domain/format`. Provider (from Plan 4) wraps `ConsultationPage`, so `ServicesCard`'s `useConsultationStore` resolves.

**Scope:** One coherent interactive card (services): pick → list → total → remove; catalog data-tested, UI smoke-tested, visually validated.
