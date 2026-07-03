# Aurora Redesign — Plan 10: Consultation visit actions (revisit + admission)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add the two right-panel follow-up actions a doctor takes after a visit: "Запись на повторный визит" (reason / service / date / slot / comment) and "Заявка на госпитализацию" (date / branch / department / doctor / notes). Fills out the consultation's right panel (currently only the timer).

**Architecture:** An `ActionButtons` section under the `Timer` in the consultation's right column opens `RevisitModal` / `AdmissionModal` (design-system `Dialog` forms). Both are self-contained (mock lists + `notify` on submit; no persistence). Ported at the form level from prototype `consultation.jsx` RevisitModal (L1442) + AdmissionModal (L1684). **Deferred (noted):** the revisit calendar-grid + slot-availability engine and the admission bed-selection stage — a follow-up.

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Dialog`/`Button`/`Input`/`Textarea`/`Select`, lucide-react, Vitest + jest-axe. Reuses `SVC_DOCTORS`/`SVC_SLOTS` from `@/domain/recommendations`.

**Testability:** the two modals are prop-driven → render+axe smoke tests. The wiring is covered by the existing `ConsultationPage` smoke test staying green.

**Reference:** prototype `consultation.jsx`. Prior: Plans 1–9.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/features/doctor/consultation/
  RevisitModal.tsx      + RevisitModal.test.tsx
  AdmissionModal.tsx    + AdmissionModal.test.tsx
  ActionButtons.tsx
  ConsultationPage.tsx  # right column: Timer + ActionButtons
```

---

### Task 1: The two modals + ActionButtons + wiring

**Files:** `RevisitModal.tsx`, `AdmissionModal.tsx`, `ActionButtons.tsx`, `ConsultationPage.tsx`, + 2 smoke tests.

- [ ] **Step 1: `src/features/doctor/consultation/RevisitModal.tsx`**
```tsx
import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Patient } from '@/domain/types'
import { SVC_SLOTS } from '@/domain/recommendations'

const REASONS = ['Контроль после лечения', 'Оценка результатов анализов', 'Продолжение лечения', 'Повторный осмотр', 'Перевязка / процедура', 'Другое']

export function RevisitModal({ patient, onClose, notify }: { patient: Patient; onClose: () => void; notify: (m: string, t?: 'ok' | 'warn') => void }) {
  const [reason, setReason] = useState(REASONS[0])
  const [service, setService] = useState(patient.service)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [comment, setComment] = useState('')
  const submit = () => {
    if (!date) { notify('Укажите дату повторного визита', 'warn'); return }
    notify('Повторный визит запланирован'); onClose()
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="size-4" />Запись на повторный визит</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">Причина
            <Select value={reason} onValueChange={setReason}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></label>
          <label className="block text-xs text-muted-foreground">Услуга<Input className="mt-1" value={service} onChange={e => setService(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">Дата<Input type="date" className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="block text-xs text-muted-foreground">Время
              <Select value={slot} onValueChange={setSlot}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Слот" /></SelectTrigger>
                <SelectContent>{SVC_SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></label>
          </div>
          <label className="block text-xs text-muted-foreground">Комментарий<Textarea className="mt-1" value={comment} onChange={e => setComment(e.target.value)} placeholder="При необходимости" /></label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={submit}><CalendarClock className="size-4" />Записать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: `src/features/doctor/consultation/AdmissionModal.tsx`**
```tsx
import { useState } from 'react'
import { BedDouble } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Patient } from '@/domain/types'
import { SVC_DOCTORS } from '@/domain/recommendations'

const BRANCHES = ['Medion Innovation (главный)']
const DEPARTMENTS = ['Хирургическое отделение', 'Онкологическое отделение', 'Терапевтическое отделение', 'Кардиологическое отделение', 'Проктологическое отделение', 'Гинекологическое отделение']

export function AdmissionModal({ patient, onClose, notify }: { patient: Patient; onClose: () => void; notify: (m: string, t?: 'ok' | 'warn') => void }) {
  const [date, setDate] = useState('')
  const [branch, setBranch] = useState(BRANCHES[0])
  const [dept, setDept] = useState('')
  const [doctor, setDoctor] = useState('')
  const [notes, setNotes] = useState('')
  const submit = () => {
    if (!dept || !doctor) { notify('Укажите отделение и врача', 'warn'); return }
    notify('Заявка на госпитализацию создана (черновик)'); onClose()
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BedDouble className="size-4" />Заявка на госпитализацию</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/40 p-2 text-sm">Пациент: {patient.id} · {patient.name}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-muted-foreground">Планируемая дата<Input type="date" className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="block text-xs text-muted-foreground">Филиал
            <Select value={branch} onValueChange={setBranch}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></label>
          <label className="block text-xs text-muted-foreground">Отделение
            <Select value={dept} onValueChange={setDept}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Выберите отделение…" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></label>
          <label className="block text-xs text-muted-foreground">Врач
            <Select value={doctor} onValueChange={setDoctor}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Выберите врача…" /></SelectTrigger>
              <SelectContent>{SVC_DOCTORS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></label>
        </div>
        <label className="block text-xs text-muted-foreground">Обоснование / примечания<Textarea className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Показания к госпитализации" /></label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={submit}><BedDouble className="size-4" />Оформить заявку</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: `src/features/doctor/consultation/ActionButtons.tsx`**
```tsx
import { useState } from 'react'
import { CalendarClock, BedDouble } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Patient } from '@/domain/types'
import { RevisitModal } from './RevisitModal'
import { AdmissionModal } from './AdmissionModal'

export function ActionButtons({ patient, notify }: { patient: Patient; notify: (m: string, t?: 'ok' | 'warn') => void }) {
  const [revisit, setRevisit] = useState(false)
  const [admission, setAdmission] = useState(false)
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">Действия по визиту</div>
      <Button variant="outline" className="w-full justify-start" onClick={() => setRevisit(true)}><CalendarClock className="size-4" />Повторный визит</Button>
      <Button variant="outline" className="w-full justify-start" onClick={() => setAdmission(true)}><BedDouble className="size-4" />Госпитализация</Button>
      {revisit && <RevisitModal patient={patient} notify={notify} onClose={() => setRevisit(false)} />}
      {admission && <AdmissionModal patient={patient} notify={notify} onClose={() => setAdmission(false)} />}
    </section>
  )
}
```

- [ ] **Step 4: Wire into `ConsultationPage.tsx`** — the right column currently renders `<div className="min-h-0 overflow-auto"><Timer status={status} setStatus={changeStatus} onFinish={() => notify('Приём завершён')} /></div>`. Add `ActionButtons` under the Timer: import `import { ActionButtons } from './ActionButtons'` and change that div to:
```tsx
<div className="min-h-0 space-y-3 overflow-auto">
  <Timer status={status} setStatus={changeStatus} onFinish={() => notify('Приём завершён')} />
  <ActionButtons patient={patient} notify={notify} />
</div>
```

- [ ] **Step 5: Smoke tests.** `RevisitModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RevisitModal } from './RevisitModal'

const patient = { num: 1, id: 1, name: 'Тест Пациент', dob: '', age: 40, sex: 'Ж' as const, visit: '', stype: '', service: 'Приём терапевта', status: 'now' as const, coverage: '', source: '', time: '', done: '', day: 0, phone: '' }

describe('RevisitModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<RevisitModal patient={patient} onClose={() => {}} notify={() => {}} />)
    expect(getByText('Запись на повторный визит')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```
`AdmissionModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AdmissionModal } from './AdmissionModal'

const patient = { num: 1, id: 1, name: 'Тест Пациент', dob: '', age: 40, sex: 'Ж' as const, visit: '', stype: '', service: '', status: 'now' as const, coverage: '', source: '', time: '', done: '', day: 0, phone: '' }

describe('AdmissionModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(<AdmissionModal patient={patient} onClose={() => {}} notify={() => {}} />)
    expect(getByText('Заявка на госпитализацию')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 6: Gate + commit** — `npm run verify && npm run build` green (2 new smoke tests + ConsultationPage smoke + all prior). If axe flags a modal (e.g. a `<label>` wrapping a Select needs the control to have an accessible name — the SelectTrigger has visible text via SelectValue; add `aria-label` to a SelectTrigger only if axe complains), fix in-component. Commit: `git add -A && git commit -m "feat(doctor): consultation visit actions (revisit + admission modals)"`

---

### Task 2: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2:** (Controller) screenshot the right-panel actions + one open modal.

---

## Self-Review (plan author)

**Spec coverage:** Adds the consultation's post-visit actions (right panel): `RevisitModal` + `AdmissionModal` opened from `ActionButtons` under the timer (Task 1), wired into `ConsultationPage`. Ported at the form level from the prototype; re-skinned on design-system Dialog/Select/Input/Textarea; reuses `SVC_DOCTORS`/`SVC_SLOTS`. **Deferred (noted):** the revisit calendar-grid/slot-availability engine + the admission bed-selection stage. Russian verbatim; no emojis.

**Placeholder scan:** No TODOs. Mock lists (reasons/branches/departments) are complete inline. Both modals validate + `notify` on submit (no persistence — appropriate for these draft actions).

**Type consistency:** Both modals take `{ patient: Patient; onClose; notify }`; `ActionButtons` passes them + is rendered by `ConsultationPage` with its `patient` + `notify`. `SVC_SLOTS`/`SVC_DOCTORS` imported from `@/domain/recommendations` (exist). Smoke tests provide a minimal `Patient` matching `@/domain/types`.

**Scope:** Two self-contained action modals + the button group, smoke-tested + wired, visually verifiable.
