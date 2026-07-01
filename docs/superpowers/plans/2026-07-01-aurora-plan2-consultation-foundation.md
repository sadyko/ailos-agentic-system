# Aurora Redesign — Plan 2: Consultation Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the consultation (doctor patient-intake) screen's foundation: open a patient from the queue → a 3-column consultation with the patient card, an editable A4 medical document (sections per document type), and a working timer with save-validation + finish — re-skinned onto the design system.

**Architecture:** New route `/doctor/consultation/:patientId` rendered inside the existing `AppShell`. A `getPatient(id)` service seam addition. Consultation is a 3-column layout: left = patient card + interactive-card shells (Diagnosis/Services/Recs/Rx headers, their pickers land in Plan 4); center = the A4 document (document-type selector + editable sections + zoom); right = timer + save/finish. The queue row-click (a no-op stub from Plan 1) now navigates here. Local component state only (a shared cross-route store for status/draft persistence is Plan 6).

**Tech Stack:** React 19, Vite, TS, Tailwind v4, design-system components (Card, Button, Badge, Select, Separator), lucide-react, react-router-dom, Vitest + jest-axe.

**Reference (read-only):** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation.jsx` (center doc, DOC_TYPES, SECTIONS_BY_DOCTYPE, REQUIRED_FIELDS, A4Section, Timer) and `consultation-left.jsx` (PatientCard, SectionCard, DX_TYPES). Design spec: `docs/superpowers/specs/2026-07-01-aurora-redesign-design.md`. This plan is the FIRST of several for the full-1:1 consultation (Plan 3 = rich-text toolbar + A4 print/pagination; Plan 4 = left-panel pickers; Plan 5 = past-results/hints; Plan 6 = draft/version history + status store; + revisit/admission actions).

---

## Conventions
- **Working dir:** `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate: `npm run verify`. Build: `npm run build`.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Russian UI copy verbatim from the prototype; **no emojis**; lucide icons only.

## File Structure (this plan)
```
src/
  services/doctor.ts                 # + getPatient(id)
  domain/consultation.ts             # DOC_TYPES, SECTIONS_BY_DOCTYPE, SECTION_UZ, REQUIRED_FIELDS, secsFor, ruAge
  domain/consultation.test.ts        # secsFor / ruAge unit tests
  features/doctor/consultation/
    ConsultationPage.tsx             # route target: loads patient, 3-col layout, status/toast state
    ConsultationHeader.tsx           # top bar: back, patient name, status badge
    Toast.tsx                        # lightweight auto-dismiss toast
    LeftPanel.tsx                    # composes PatientCard + the 4 card shells
    PatientCard.tsx                  # patient header + tags + note
    SectionCard.tsx                  # reusable left-zone card wrapper (icon + title + count + action)
    cards/DiagnosisCard.tsx          # shell (Plan 4 adds the ICD-10 picker)
    cards/ServicesCard.tsx           # shell
    cards/RecsCard.tsx               # shell
    cards/RxCard.tsx                 # shell
    A4Document.tsx                   # doc-type select + zoom + editable sections + doc header/footer
    A4Section.tsx                    # one editable section card (tag ru|uz + contentEditable body)
    DocTypeSelect.tsx                # document-type dropdown (design-system Select)
    Timer.tsx                        # stopwatch: start/pause/resume/finish + status
    consultation.test.tsx            # smoke (render + axe) for ConsultationPage
  app/router.tsx                     # + /doctor/consultation/:patientId
  features/doctor/QueueTable.tsx     # onOpen now navigates (via a prop from Worklist)
  features/doctor/Worklist.tsx       # passes navigate to QueueTable
```

---

### Task 1: `getPatient` service + consultation domain constants (TDD for logic)

**Files:** `src/services/doctor.ts` (modify), `src/domain/consultation.ts`, `src/domain/consultation.test.ts`.

- [ ] **Step 1: Add `getPatient` to `src/services/doctor.ts`** (append; keep existing exports):
```ts
export async function getPatient(id: number): Promise<Patient | undefined> {
  return PATIENTS.find(p => p.id === id)
}
```

- [ ] **Step 2: Write failing tests** `src/domain/consultation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { secsFor, ruAge, DOC_TYPES, REQUIRED_FIELDS } from './consultation'

describe('consultation domain', () => {
  it('DOC_TYPES has 5 document types', () => {
    expect(DOC_TYPES).toHaveLength(5)
    expect(DOC_TYPES[0].name).toBe('Приём (осмотр, консультация)')
  })
  it('secsFor(0) returns the ambulatory intake sections', () => {
    expect(secsFor(0)).toEqual(['ЖАЛОБЫ','АНАМНЕЗ','ЛАБОРАТОРНЫЕ','ИНСТРУМЕНТАЛЬНЫЕ','ОСМОТР','ТЕРАПИЯ','РЕКОМЕНДАЦИИ'])
  })
  it('secsFor falls back to template sections for unknown type', () => {
    expect(secsFor(99)).toEqual(['ЖАЛОБЫ','АНАМНЕЗ','ОСМОТР','ТЕРАПИЯ','РЕКОМЕНДАЦИИ'])
  })
  it('ruAge picks the right Russian suffix', () => {
    expect(ruAge(1)).toBe('1 год')
    expect(ruAge(3)).toBe('3 года')
    expect(ruAge(7)).toBe('7 лет')
    expect(ruAge(15)).toBe('15 лет')
  })
  it('REQUIRED_FIELDS are Жалобы/Осмотр/Рекомендации', () => {
    expect(REQUIRED_FIELDS.map(f => f.tag)).toEqual(['ЖАЛОБЫ','ОСМОТР','РЕКОМЕНДАЦИИ'])
  })
})
```

- [ ] **Step 3: Run — expect FAIL:** `npm run test -- consultation`

- [ ] **Step 4: Implement** `src/domain/consultation.ts` (ported verbatim from the prototype):
```ts
export interface DocType { name: string; desc: string }
export const DOC_TYPES: DocType[] = [
  { name: 'Приём (осмотр, консультация)', desc: 'Основной документ амбулаторного приёма: жалобы, анамнез, осмотр, диагноз, рекомендации.' },
  { name: 'Анкета — МРТ', desc: 'Опросник перед МРТ: противопоказания, импланты, вес, аллергии на контраст.' },
  { name: 'Анкета — КТ', desc: 'Опросник перед КТ: функция почек, аллергии, беременность, предыдущие исследования.' },
  { name: 'Протокол химиотерапии', desc: 'Схема и цикл ПХТ, расчёт доз по площади тела, премедикация, контроль показателей.' },
  { name: 'Направление на ВКК', desc: 'Направление на врачебно-консультативную комиссию с обоснованием.' },
]

const TEMPLATE_SECTIONS = ['ЖАЛОБЫ', 'АНАМНЕЗ', 'ОСМОТР', 'ТЕРАПИЯ', 'РЕКОМЕНДАЦИИ']
const SECTIONS_BY_DOCTYPE: Record<number, string[]> = {
  0: ['ЖАЛОБЫ', 'АНАМНЕЗ', 'ЛАБОРАТОРНЫЕ', 'ИНСТРУМЕНТАЛЬНЫЕ', 'ОСМОТР', 'ТЕРАПИЯ', 'РЕКОМЕНДАЦИИ'],
  1: ['ПОКАЗАНИЯ', 'ПРОТИВОПОКАЗАНИЯ', 'МЕТАЛЛ / ИМПЛАНТЫ', 'КОНТРАСТ / АЛЛЕРГИИ', 'ЗАКЛЮЧЕНИЕ'],
  2: ['ПОКАЗАНИЯ', 'ФУНКЦИЯ ПОЧЕК', 'КОНТРАСТ / АЛЛЕРГИИ', 'БЕРЕМЕННОСТЬ', 'ЗАКЛЮЧЕНИЕ'],
  3: ['СХЕМА И ЦИКЛ', 'РАСЧЁТ ДОЗ', 'ПРЕМЕДИКАЦИЯ', 'КОНТРОЛЬ ПОКАЗАТЕЛЕЙ', 'РЕКОМЕНДАЦИИ'],
  4: ['ОБОСНОВАНИЕ', 'ДИАГНОЗ', 'АНАМНЕЗ', 'ВОПРОС К КОМИССИИ'],
}
export const secsFor = (docType: number): string[] => SECTIONS_BY_DOCTYPE[docType] ?? TEMPLATE_SECTIONS

export const SECTION_UZ: Record<string, string> = {
  'ЖАЛОБЫ': 'Shikoyatlar', 'АНАМНЕЗ': 'Anamnez', 'ОБЪЕКТИВНЫЙ СТАТУС': 'Obyektiv holat',
  'ДИАГНОЗ': 'Tashxis', 'ПЛАН ЛЕЧЕНИЯ': 'Davolash rejasi', 'ОСМОТР': 'Ko‘rik',
  'ТЕРАПИЯ': 'Davolash', 'ЛЕЧЕНИЕ': 'Davolash', 'РЕКОМЕНДАЦИИ': 'Tavsiyalar',
  'ЛАБОРАТОРНЫЕ': 'Laborator tekshiruvlar', 'ИНСТРУМЕНТАЛЬНЫЕ': 'Instrumental tekshiruvlar',
  'ЭПИКРИЗ': 'Epikriz', 'ПЛАН': 'Reja',
}

export const REQUIRED_FIELDS = [
  { tag: 'ЖАЛОБЫ', label: 'Жалобы' },
  { tag: 'ОСМОТР', label: 'Осмотр' },
  { tag: 'РЕКОМЕНДАЦИИ', label: 'Рекомендации' },
]

export function ruAge(n: number): string {
  n = Number(n) || 0
  const a = n % 100, b = n % 10
  const w = a > 10 && a < 20 ? 'лет' : b === 1 ? 'год' : b >= 2 && b <= 4 ? 'года' : 'лет'
  return `${n} ${w}`
}

export const CLINIC_FOOTER = 'Medion Innovation (ООО «Diatech Equipment Service»), ИНН 309 123 456 · г. Ташкент, ул. Истирохат, 258'
```

- [ ] **Step 5: Run — expect PASS:** `npm run test -- consultation`
- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat(doctor): getPatient service + consultation domain constants (TDD)"`

---

### Task 2: Toast + Consultation route wiring (open from queue)

**Files:** `src/features/doctor/consultation/Toast.tsx`, `src/features/doctor/consultation/ConsultationPage.tsx` (minimal shell first), `src/app/router.tsx`, `src/features/doctor/Worklist.tsx`, `src/features/doctor/QueueTable.tsx`.

- [ ] **Step 1: Toast** `src/features/doctor/consultation/Toast.tsx`:
```tsx
import { useEffect } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'

export type ToastMsg = { msg: string; tone: 'ok' | 'warn' } | null

export function Toast({ toast, onClose }: { toast: ToastMsg; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3400)
    return () => clearTimeout(t)
  }, [toast, onClose])
  if (!toast) return null
  const Icon = toast.tone === 'ok' ? Check : TriangleAlert
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-md">
      <Icon className={`size-4 ${toast.tone === 'ok' ? 'text-primary' : 'text-destructive'}`} />
      <span>{toast.msg}</span>
      <button aria-label="Закрыть" onClick={onClose} className="ml-1 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
    </div>
  )
}
```

- [ ] **Step 2: Minimal `ConsultationPage`** `src/features/doctor/consultation/ConsultationPage.tsx` (loads the patient; full layout added in Task 3+ — for now render a header stub so the route works):
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Patient } from '@/domain/types'
import { getPatient } from '@/services/doctor'

export function ConsultationPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | undefined>()
  useEffect(() => {
    let alive = true
    getPatient(Number(patientId)).then(p => { if (alive) setPatient(p) })
    return () => { alive = false }
  }, [patientId])

  if (!patient) {
    return (
      <div className="p-8">
        <button className="text-sm text-primary" onClick={() => navigate('/doctor')}>← К очереди</button>
        <p className="mt-4 text-sm text-muted-foreground">Пациент не найден.</p>
      </div>
    )
  }
  return (
    <div className="p-6">
      <button className="text-sm text-primary" onClick={() => navigate('/doctor')}>← К очереди</button>
      <h1 className="mt-3 text-xl font-semibold">{patient.name}</h1>
    </div>
  )
}
```
(Task 3 replaces the render body with the 3-column layout.)

- [ ] **Step 3: Add the route** in `src/app/router.tsx`: import `ConsultationPage` and add a child route under the shell:
`{ path: 'doctor/consultation/:patientId', element: <ConsultationPage /> }`

- [ ] **Step 4: Wire the queue click** — `QueueTable` already calls `onOpen(p)`. In `src/features/doctor/Worklist.tsx`, replace the `openPatient` no-op with navigation:
```tsx
import { useNavigate } from 'react-router-dom'
// inside Worklist:
const navigate = useNavigate()
const openPatient = (p: Patient) => navigate(`/doctor/consultation/${p.id}`)
```
(Keep passing `openPatient` to `QueueTable`'s `onOpen`.)

- [ ] **Step 5: Gate + manual check** — `npm run verify` green; `npm run dev`, click a queue row → navigates to the consultation stub showing the patient name; "← К очереди" returns. Commit:
`git add -A && git commit -m "feat(doctor): consultation route + open-from-queue navigation + Toast"`

---

### Task 3: Consultation shell — 3-column layout + header

**Files:** `ConsultationHeader.tsx`, `ConsultationPage.tsx` (expand), `consultation.test.tsx`.

- [ ] **Step 1: Header** `src/features/doctor/consultation/ConsultationHeader.tsx`:
```tsx
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Patient } from '@/domain/types'
import { ruAge } from '@/domain/consultation'

const STATUS_LABEL: Record<string, string> = { now: 'Идёт приём', paused: 'Пауза', done: 'Завершён', queue: 'В очереди', invited: 'Приглашён' }

export function ConsultationHeader({ patient, status, onBack }: { patient: Patient; status: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b bg-card px-5 py-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />К очереди</Button>
      <div className="min-w-0">
        <div className="truncate font-medium">{patient.name}</div>
        <div className="text-xs text-muted-foreground">{ruAge(patient.age)} · {patient.sex === 'Ж' ? 'жен.' : 'муж.'} · ID {patient.id}</div>
      </div>
      <Badge className="ml-auto" variant={status === 'now' ? 'default' : 'secondary'}>{STATUS_LABEL[status] ?? status}</Badge>
    </header>
  )
}
```

- [ ] **Step 2: Expand `ConsultationPage`** to the 3-column layout with local status + toast state (left/center/right filled by later tasks — use placeholders that the later tasks replace):
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Patient } from '@/domain/types'
import { getPatient } from '@/services/doctor'
import { ConsultationHeader } from './ConsultationHeader'
import { Toast, type ToastMsg } from './Toast'
import { LeftPanel } from './LeftPanel'
import { A4Document } from './A4Document'
import { Timer } from './Timer'

export function ConsultationPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | undefined>()
  const [status, setStatus] = useState<'now' | 'paused' | 'done'>('now')
  const [toast, setToast] = useState<ToastMsg>(null)
  const notify = (msg: string, tone: 'ok' | 'warn' = 'ok') => setToast({ msg, tone })

  useEffect(() => {
    let alive = true
    getPatient(Number(patientId)).then(p => { if (alive) setPatient(p) })
    return () => { alive = false }
  }, [patientId])

  const back = () => navigate('/doctor')

  if (!patient) {
    return <div className="p-8"><button className="text-sm text-primary" onClick={back}>← К очереди</button><p className="mt-4 text-sm text-muted-foreground">Пациент не найден.</p></div>
  }
  return (
    <div className="flex h-screen flex-col">
      <ConsultationHeader patient={patient} status={status} onBack={back} />
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr_300px] gap-4 overflow-hidden p-4">
        <div className="min-h-0 overflow-auto"><LeftPanel patient={patient} /></div>
        <div className="min-h-0 overflow-auto"><A4Document patient={patient} notify={notify} /></div>
        <div className="min-h-0 overflow-auto"><Timer status={status} setStatus={setStatus} onFinish={() => notify('Приём завершён')} /></div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
```

- [ ] **Step 3: Smoke test** `src/features/doctor/consultation/consultation.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { axe } from 'jest-axe'
import { ConsultationPage } from './ConsultationPage'

describe('ConsultationPage', () => {
  it('renders a patient consultation with no axe violations', async () => {
    const { container, findByText } = render(
      <MemoryRouter initialEntries={['/doctor/consultation/195247']}>
        <Routes><Route path="/doctor/consultation/:patientId" element={<ConsultationPage />} /></Routes>
      </MemoryRouter>
    )
    await findByText('Арзибаева Дилрабо Ровшанбековна')
    await waitFor(() => expect(container.querySelector('header')).toBeTruthy())
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
(This test depends on `LeftPanel`, `A4Document`, `Timer` existing — implement Tasks 4–6 before running it green; until then this task's `verify` may fail on missing imports. If executing strictly in order, stub `LeftPanel`/`A4Document`/`Timer` as `export function X(){ return null }` placeholders here and flesh them out in Tasks 4–6, OR implement Tasks 4–6 then return to run this test. Note this in your report.)

- [ ] **Step 4: Commit** (after Tasks 4–6 make it green, or with stubs): `git add -A && git commit -m "feat(doctor): consultation 3-column shell + header"`

---

### Task 4: Left panel — PatientCard + SectionCard + card shells

**Files:** `PatientCard.tsx`, `SectionCard.tsx`, `cards/DiagnosisCard.tsx`, `cards/ServicesCard.tsx`, `cards/RecsCard.tsx`, `cards/RxCard.tsx`, `LeftPanel.tsx`.

- [ ] **Step 1: `SectionCard`** (reusable left-zone wrapper) `src/features/doctor/consultation/SectionCard.tsx`:
```tsx
import type { ReactNode } from 'react'

export function SectionCard({ title, icon, count, action, children }: { title: string; icon: ReactNode; count?: number; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-medium">{title}</h2>
        {count != null && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{count}</span>}
        <span className="ml-auto">{action}</span>
      </div>
      {children && <div className="p-3">{children}</div>}
    </section>
  )
}
```

- [ ] **Step 2: `PatientCard`** `src/features/doctor/consultation/PatientCard.tsx` (ported from `consultation-left.jsx` PatientCard; tags + note; use design-system Avatar/Badge):
```tsx
import { useState } from 'react'
import { Tag, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Patient } from '@/domain/types'
import { initials, avatarColor } from '@/domain/format'
import { ruAge } from '@/domain/consultation'

const TAGS = ['VIP-пациент', 'Говорит на UZ', 'Тревожный', 'Льготник', 'Сопровождение']
const NOTE = '«Просит звонить заранее перед визитом. Сопровождает мама. Предпочитает приём в первой половине дня — при записи уточнять удобное время.» — регистратура'

export function PatientCard({ patient }: { patient: Patient }) {
  const [allTags, setAllTags] = useState(false)
  const [expand, setExpand] = useState(false)
  const shown = allTags ? TAGS : TAGS.slice(0, 2)
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <Avatar className="size-11"><AvatarFallback style={{ background: avatarColor(patient.name), color: '#fff' }}>{initials(patient.name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-tight">{patient.name}, {ruAge(patient.age)}, {patient.sex === 'Ж' ? 'жен.' : 'муж.'}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>ID {patient.id}</span>
            <a href={`/registration/patient/${patient.id}`} className="inline-flex items-center gap-1 text-primary"><User className="size-3" />Карта пациента</a>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Tag className="size-3" />Комментарии и теги</div>
        <div className="flex flex-wrap gap-1.5">
          {shown.map(t => <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs">{t}</span>)}
          {TAGS.length > 2 && <button className="rounded bg-muted px-2 py-0.5 text-xs text-primary" onClick={() => setAllTags(a => !a)}>{allTags ? 'свернуть' : `+${TAGS.length - 2}`}</button>}
        </div>
        <p className={`mt-2 text-xs text-muted-foreground ${!expand ? 'line-clamp-2' : ''}`}>{NOTE}</p>
        <button className="mt-1 text-xs text-primary" onClick={() => setExpand(e => !e)}>{expand ? 'свернуть' : 'раскрыть'}</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Four card shells** — each renders a `SectionCard` with an "add" button that is disabled with a title noting it lands in a later plan. Create `cards/DiagnosisCard.tsx`, `cards/ServicesCard.tsx`, `cards/RecsCard.tsx`, `cards/RxCard.tsx`. Example `DiagnosisCard.tsx`:
```tsx
import { Stethoscope, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '../SectionCard'

export function DiagnosisCard() {
  return (
    <SectionCard title="Диагноз (МКБ-10)" icon={<Stethoscope className="size-4" />} count={0}
      action={<Button variant="ghost" size="icon" disabled title="Подбор диагноза — в следующем обновлении"><Plus className="size-4" /></Button>}>
      <p className="text-xs text-muted-foreground">Диагнозы не добавлены.</p>
    </SectionCard>
  )
}
```
Make `ServicesCard` (title "Услуги приёма", icon `ClipboardList`, empty text "Услуги не добавлены."), `RecsCard` (title "Рекомендации", icon `ListChecks`, "Рекомендаций нет."), `RxCard` (title "Назначения", icon `Pill`, "Назначений нет.") — same shape.

- [ ] **Step 4: `LeftPanel`** composes them `src/features/doctor/consultation/LeftPanel.tsx`:
```tsx
import type { Patient } from '@/domain/types'
import { PatientCard } from './PatientCard'
import { DiagnosisCard } from './cards/DiagnosisCard'
import { ServicesCard } from './cards/ServicesCard'
import { RecsCard } from './cards/RecsCard'
import { RxCard } from './cards/RxCard'

export function LeftPanel({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-3">
      <PatientCard patient={patient} />
      <DiagnosisCard />
      <ServicesCard />
      <RecsCard />
      <RxCard />
    </div>
  )
}
```

- [ ] **Step 5: Gate + commit** — `npm run verify` green (once Tasks 5–6 exist for the smoke test). Commit: `git add -A && git commit -m "feat(doctor): consultation left panel (patient card + card shells)"`

---

### Task 5: Center A4 document — doc-type select + editable sections + zoom

**Files:** `A4Section.tsx`, `DocTypeSelect.tsx`, `A4Document.tsx`.

- [ ] **Step 1: `A4Section`** `src/features/doctor/consultation/A4Section.tsx` (editable section card; tag ru | uz; contentEditable body):
```tsx
export function A4Section({ ru, uz, value = '' }: { ru: string; uz?: string; value?: string }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/[0.03]">
      <div className="rounded-t-md bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">
        {ru}{uz && <span className="font-normal text-primary/70"> | {uz}</span>}
      </div>
      <div className="min-h-14 px-3 py-2 text-sm outline-none focus:bg-background" contentEditable suppressContentEditableWarning data-section-tag={ru}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: `DocTypeSelect`** `src/features/doctor/consultation/DocTypeSelect.tsx` (design-system Select over DOC_TYPES):
```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DOC_TYPES } from '@/domain/consultation'

export function DocTypeSelect({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
      <SelectTrigger aria-label="Тип документа" className="w-72"><SelectValue /></SelectTrigger>
      <SelectContent>
        {DOC_TYPES.map((dt, i) => <SelectItem key={i} value={String(i)}>{dt.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: `A4Document`** `src/features/doctor/consultation/A4Document.tsx` (doc header + toolbar row with doc-type select + zoom; editable sections per type). NOTE: `notify` is used by the save flow added in Task 6; accept it as a prop now.
```tsx
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Patient } from '@/domain/types'
import { DOC_TYPES, secsFor, SECTION_UZ, ruAge, CLINIC_FOOTER } from '@/domain/consultation'
import { A4Section } from './A4Section'
import { DocTypeSelect } from './DocTypeSelect'

export function A4Document({ patient, notify: _notify }: { patient: Patient; notify: (m: string, t?: 'ok' | 'warn') => void }) {
  const [docType, setDocType] = useState(0)
  const [zoom, setZoom] = useState(100)
  const sections = secsFor(docType)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DocTypeSelect value={docType} onChange={setDocType} />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Уменьшить" onClick={() => setZoom(z => Math.max(60, z - 10))}><Minus className="size-4" /></Button>
          <span className="w-12 text-center text-sm tabular-nums">{zoom}%</span>
          <Button variant="outline" size="icon" aria-label="Увеличить" onClick={() => setZoom(z => Math.min(140, z + 10))}><Plus className="size-4" /></Button>
        </div>
      </div>
      <div className="mx-auto max-w-3xl origin-top rounded-lg border bg-white p-8 shadow-sm" style={{ transform: `scale(${zoom / 100})` }}>
        <div className="mb-4 text-center">
          <div className="text-base font-semibold">{DOC_TYPES[docType].name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{patient.name} · {ruAge(patient.age)} · {patient.sex === 'Ж' ? 'жен.' : 'муж.'} · ID {patient.id}</div>
          <div className="text-xs text-muted-foreground">{patient.service}</div>
        </div>
        <Separator className="mb-4" />
        <div className="space-y-3">
          {sections.map(s => <A4Section key={s} ru={s} uz={SECTION_UZ[s]} />)}
        </div>
        <Separator className="my-4" />
        <div className="text-[10px] leading-tight text-muted-foreground">{CLINIC_FOOTER}</div>
      </div>
    </div>
  )
}
```
(The real A4 pagination engine + rich-text toolbar are Plan 3; here sections stack and zoom scales the sheet.)

- [ ] **Step 4: Gate + commit** — `npm run verify` green (with Task 6's Timer present). Commit: `git add -A && git commit -m "feat(doctor): consultation A4 document (doc-type select + editable sections + zoom)"`

---

### Task 6: Right panel — Timer + save/validate + finish

**Files:** `Timer.tsx`, wire save-validation into `A4Document.tsx` (expose a save action) + `ConsultationPage.tsx`.

- [ ] **Step 1: `Timer`** `src/features/doctor/consultation/Timer.tsx` (stopwatch; start on mount when status is `now`; pause/resume/finish):
```tsx
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(sec)}`
}

export function Timer({ status, setStatus, onFinish }: { status: 'now' | 'paused' | 'done'; setStatus: (s: 'now' | 'paused' | 'done') => void; onFinish: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef<number | null>(null)
  useEffect(() => {
    if (status === 'now') {
      ref.current = window.setInterval(() => setElapsed(e => e + 1), 1000)
      return () => { if (ref.current) window.clearInterval(ref.current) }
    }
  }, [status])
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="text-center">
        <div className="text-2xl font-semibold tabular-nums">{fmt(elapsed)}</div>
        <div className="text-xs text-muted-foreground">{status === 'now' ? 'Приём идёт' : status === 'paused' ? 'Пауза' : 'Завершён'}</div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {status === 'now' && <Button variant="outline" onClick={() => setStatus('paused')}><Pause className="size-4" />Пауза</Button>}
        {status === 'paused' && <Button variant="outline" onClick={() => setStatus('now')}><Play className="size-4" />Продолжить</Button>}
        {status !== 'done' && <Button onClick={() => { setStatus('done'); onFinish() }}><Square className="size-4" />Завершить приём</Button>}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Save-validation** — add a "Сохранить" action that checks the required sections have content. In `A4Document.tsx`, add a Save button in the toolbar row and a `handleSave` that reads the contentEditable sections' text by their `data-section-tag` and validates `REQUIRED_FIELDS`:
```tsx
// add import: import { REQUIRED_FIELDS } from '@/domain/consultation'
// add a ref on the sheet container: const sheet = useRef<HTMLDivElement>(null) and put ref={sheet} on the white sheet div
const handleSave = () => {
  const root = sheet.current
  const missing = REQUIRED_FIELDS.filter(f => {
    const el = root?.querySelector(`[data-section-tag="${f.tag}"]`)
    return !el || !el.textContent?.trim()
  })
  if (missing.length) { _notify(`Заполните: ${missing.map(m => m.label).join(', ')}`, 'warn'); return }
  _notify('Документ сохранён')
}
// add to the toolbar (before the zoom controls): <Button size="sm" onClick={handleSave}>Сохранить</Button>
```
(Rename `_notify` to `notify` in the destructure now that it's used.) Draft/version persistence is Plan 6; this validates + toasts.

- [ ] **Step 3: Run the ConsultationPage smoke test** (from Task 3) — `npm run verify`. It should now be green (LeftPanel, A4Document, Timer all exist). Zero axe violations. If the contentEditable sheet triggers an axe issue, ensure each section has its `data-section-tag` and an accessible structure (the tag div is a heading-like label; acceptable). Fix real violations in the components.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(doctor): consultation timer + save-validation + finish"`

---

### Task 7: Full gate + screenshot + checkpoint

- [ ] **Step 1: Full gate** — `npm run verify && npm run build` — all green (consultation domain tests + ConsultationPage smoke + the Plan 1 tests). Report counts.
- [ ] **Step 2: Manual sanity** — `npm run dev`; from `/doctor` click a patient → consultation opens with patient card (left), the A4 document with editable Приём sections + doc-type switch + zoom (center), and the running timer (right); "Сохранить" with empty required sections shows the warn toast; "Завершить приём" sets status done; "К очереди" returns. Stop dev.
- [ ] **Step 3: Commit** any final touch: `git add -A && git commit -m "chore: consultation foundation gate green"`

(After this task, the controller captures a screenshot of the consultation for the owner and this plan's increment is complete; Plan 3 adds the rich-text toolbar + A4 print/pagination.)

---

## Self-Review (plan author)

**Spec coverage:** Consultation is the core Doctor screen (spec §5 build order, "full 1:1" owner decision). This plan = the foundation slice: route + open-from-queue (Task 2), 3-col shell + header (Task 3), patient card + left card shells (Task 4), A4 editable document with doc-type + sections + zoom (Task 5), timer + save-validation + finish (Task 6). Reuse: DOC_TYPES/SECTIONS_BY_DOCTYPE/REQUIRED_FIELDS/PatientCard/A4Section/Timer ported verbatim from the prototype; re-skinned on design-system components; Russian copy kept; no emojis. Data via the `getPatient` service seam (Task 1). Deferred to later consultation plans (called out): rich-text formatting toolbar + A4 print/pagination (Plan 3), left-panel pickers/modals (Plan 4), past-results/hints inserts (Plan 5), draft/publish/version history + cross-route status store (Plan 6), revisit/admission actions.

**Placeholder scan:** The card "shells" (Task 4) and the deferred toolbar/pagination are explicit, scoped deferrals to named follow-up plans — not vague TODOs. Every code step shows real code. The Task 3 smoke test's dependency on Tasks 4–6 is called out with an explicit ordering instruction (stub or implement-then-test).

**Type consistency:** `Patient` from `@/domain/types` used throughout. `getPatient(id: number)` matches `ConsultationPage`'s `getPatient(Number(patientId))`. `secsFor`/`DOC_TYPES`/`REQUIRED_FIELDS`/`SECTION_UZ`/`ruAge`/`CLINIC_FOOTER` defined in `domain/consultation.ts` and consumed by A4Document/Header. `status` union `'now'|'paused'|'done'` consistent between `ConsultationPage`, `Timer`, `ConsultationHeader` (header accepts a wider `string` and maps labels — compatible). `ToastMsg` type shared by `Toast` + `ConsultationPage`. `data-section-tag` written by `A4Section` and read by `A4Document.handleSave`.

**Scope:** One coherent, runnable increment — a usable consultation (open, see patient, fill sections, timer, save-validate, finish) — self-contained and testable, with the advanced editor features sequenced into named follow-up plans.
