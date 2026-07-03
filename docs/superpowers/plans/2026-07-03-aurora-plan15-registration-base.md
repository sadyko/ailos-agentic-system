# Aurora Redesign — Plan 15: Registration foundation (patient base)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Ship the Registration module's first usable screen at `/registration`: KPI cards + a searchable, sortable patient base table (12 patients, all prototype columns incl. inpatient tag, Telegram, coverage/insurer, colored balance, registrar), with rows navigating to a patient-card route stub (`/registration/patient/:id`) that the next slice fills.

**Architecture:** `src/data/registration.ts` (REG_PATIENTS verbatim, registrar round-robin baked in) behind `src/services/registration.ts` (`getRegPatients()`, `getRegPatient(id)`). `src/domain/registration.ts` holds `RegPatient`, `regIsInpatient`, and `dateKey` (dd.mm.yyyy → sortable number, TDD). `src/features/registration/`: `PatientsPage` (stats + search + `PatientsTable`) and a minimal `RegPatientCardPage` stub. Router: `/registration` → PatientsPage (replaces placeholder), `/registration/patient/:id` → stub. Maps to prototype `reg-base.jsx:623-746` (table/search/sort) + `reg-data.jsx:3-23`. **Deferred (per module map):** per-column filters, RegisterPatientModal (new patient), registrar dashboard, calendar tab, the full patient card, visit/services registration — later slices. Stats are computed from the live list (Всего / Активные / С покрытием / В стационаре) — the prototype's period-money KPIs belong to the deferred dashboard slice.

**Tech Stack:** React 19, TS, design-system `Card`/`Table`/`Badge`/`Input`/`Button`/`Avatar`, lucide-react, react-router, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

---

### Task 1: Registration domain + data + service (TDD)

**Files:** `src/domain/registration.ts`, `src/domain/registration.test.ts`, `src/data/registration.ts`, `src/services/registration.ts`, `src/services/registration.test.ts`.

- [ ] **Step 1: Failing domain tests** `src/domain/registration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dateKey, regIsInpatient } from './registration'

describe('registration domain', () => {
  it('dateKey orders dd.mm.yyyy correctly', () => {
    expect(dateKey('02.06.2026')).toBeGreaterThan(dateKey('30.05.2026'))
    expect(dateKey('01.01.2027')).toBeGreaterThan(dateKey('31.12.2026'))
    expect(dateKey('')).toBe(0)
  })
  it('regIsInpatient flags only patients with an inpatient block', () => {
    expect(regIsInpatient({ inpatient: { dept: 'Хирургия', since: '', histNo: '', doctor: '' } })).toBe(true)
    expect(regIsInpatient({})).toBe(false)
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- domain/registration`

- [ ] **Step 3: Implement** `src/domain/registration.ts`:
```ts
export interface RegInpatient { dept: string; since: string; histNo: string; doctor: string }
export interface RegPatient {
  pid: string; id: number; name: string; dob: string; age: number; sex: 'М' | 'Ж'
  phone: string; last: string; visits: number; status: 'active' | 'archive'
  coverage: string; insurer: string; tg: boolean; branch: string
  balance: number; cashback: number; registrar: string; inpatient?: RegInpatient
}

export function regIsInpatient(p: { inpatient?: RegInpatient }): boolean {
  return !!p.inpatient
}

// "dd.mm.yyyy" -> sortable number (0 for empty/invalid)
export function dateKey(dmy: string): number {
  const m = String(dmy ?? '').split('.')
  return (+m[2] || 0) * 10000 + (+m[1] || 0) * 100 + (+m[0] || 0)
}
```

- [ ] **Step 4: Run — PASS**, then failing service test `src/services/registration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getRegPatients, getRegPatient } from './registration'

describe('registration service', () => {
  it('returns the 12-patient base with registrars assigned round-robin', async () => {
    const list = await getRegPatients()
    expect(list).toHaveLength(12)
    expect(list[0].registrar).toBe('Исломбек К.')
    expect(list[1].registrar).toBe('Дилфуза Ш.')
    expect(list[5].registrar).toBe('Исломбек К.')
    expect(list.every(p => p.registrar.length > 0)).toBe(true)
  })
  it('two patients are inpatients', async () => {
    const list = await getRegPatients()
    expect(list.filter(p => p.inpatient).length).toBe(2)
  })
  it('getRegPatient finds by id', async () => {
    const p = await getRegPatient(195247)
    expect(p!.name).toBe('Арзибаева Дилрабо Ровшанбековна')
  })
})
```

- [ ] **Step 5: Run — FAIL**, then implement `src/data/registration.ts` (verbatim from prototype `reg-data.jsx:3-16`; registrar baked per the round-robin `["Исломбек К.","Дилфуза Ш.","Хилола А.","Нодира Т.","Малика Р."]` by index):
```ts
import type { RegPatient } from '@/domain/registration'

export const REG_PATIENTS: RegPatient[] = [
  { pid: 'P-26-00058', id: 181961, name: 'Ахмеди Саддам Хусейн', dob: '15.11.1994', age: 31, sex: 'М', phone: '+998 33 322 22 88', last: '02.06.2026', visits: 14, status: 'active', coverage: 'Платно', insurer: '', tg: true, branch: 'MFH', balance: 0, cashback: 35850, registrar: 'Исломбек К.' },
  { pid: 'P-26-00141', id: 195247, name: 'Арзибаева Дилрабо Ровшанбековна', dob: '28.08.2018', age: 7, sex: 'Ж', phone: '+998 97 337 39 09', last: '04.06.2026', visits: 3, status: 'active', coverage: 'Страховка', insurer: 'Apex Insurance', tg: false, branch: 'MFH', balance: 120000, cashback: 4200, registrar: 'Дилфуза Ш.' },
  { pid: 'P-25-00922', id: 195538, name: 'Пинхасова Ларина Левовна', dob: '16.06.1973', age: 52, sex: 'Ж', phone: '+998 50 009 64 87', last: '04.06.2026', visits: 9, status: 'active', coverage: 'Корпоративный', insurer: '', tg: true, branch: 'MFH', balance: -280000, cashback: 0, registrar: 'Хилола А.' },
  { pid: 'P-24-01180', id: 161000, name: 'Тоиров Тимурбек Алишер угли', dob: '14.02.2016', age: 9, sex: 'М', phone: '+998 90 123 45 67', last: '03.06.2026', visits: 21, status: 'active', coverage: 'ДМС', insurer: 'Gross Insurance', tg: false, branch: 'MFH', balance: 540000, cashback: 18000, registrar: 'Нодира Т.' },
  { pid: 'P-26-00203', id: 188903, name: 'Юлдашев Бекзод Анварович', dob: '22.06.1979', age: 46, sex: 'М', phone: '+998 93 555 10 20', last: '01.06.2026', visits: 5, status: 'active', coverage: 'Платно', insurer: '', tg: true, branch: 'MFH', balance: 0, cashback: 9100, registrar: 'Малика Р.' },
  { pid: 'P-23-00455', id: 171204, name: 'Хасанова Малика Бахтиёровна', dob: '03.11.1991', age: 34, sex: 'Ж', phone: '+998 99 871 44 12', last: '30.05.2026', visits: 12, status: 'active', coverage: 'ДМС', insurer: "Kapital Sug'urta", tg: true, branch: 'ML', balance: 75000, cashback: 21300, registrar: 'Исломбек К.' },
  { pid: 'P-22-01902', id: 140551, name: 'Эргашев Сардор Икромович', dob: '11.12.1965', age: 60, sex: 'М', phone: '+998 94 700 88 33', last: '18.05.2026', visits: 33, status: 'active', coverage: 'Корпоративный', insurer: '', tg: false, branch: 'MFH', balance: 0, cashback: 46500, registrar: 'Дилфуза Ш.' },
  { pid: 'P-26-00077', id: 192011, name: 'Каримов Дониёр Шухратович', dob: '09.09.2002', age: 23, sex: 'М', phone: '+998 88 444 55 66', last: '12.05.2026', visits: 2, status: 'active', coverage: 'Страховка', insurer: 'Euroasia Insurance', tg: true, branch: 'MFH', balance: 0, cashback: 0, registrar: 'Хилола А.', inpatient: { dept: 'Хирургия', since: '08.06.2026', histNo: '2026/00044', doctor: 'Мудунов А.М.' } },
  { pid: 'P-21-00310', id: 120877, name: 'Назарова Шахноза Фарходовна', dob: '30.01.1996', age: 30, sex: 'Ж', phone: '+998 91 234 88 90', last: '28.04.2026', visits: 8, status: 'archive', coverage: 'Платно', insurer: '', tg: false, branch: 'ML', balance: 0, cashback: 3000, registrar: 'Нодира Т.' },
  { pid: 'P-26-00099', id: 195104, name: 'Собирова Нилуфар Жамшидовна', dob: '18.04.1988', age: 38, sex: 'Ж', phone: '+998 97 110 22 33', last: '25.05.2026', visits: 6, status: 'active', coverage: 'ДМС', insurer: "Ishonch Sug'urta", tg: true, branch: 'MFH', balance: 260000, cashback: 12750, registrar: 'Малика Р.', inpatient: { dept: 'Стационар', since: '06.06.2026', histNo: '2026/00018', doctor: 'Абубакирова О.А.' } },
  { pid: 'P-20-00088', id: 100432, name: 'Рахимов Жасур Бахтиярович', dob: '05.07.1983', age: 42, sex: 'М', phone: '+998 90 909 09 09', last: '02.04.2026', visits: 17, status: 'active', coverage: 'Платно', insurer: '', tg: true, branch: 'MFH', balance: 0, cashback: 27800, registrar: 'Исломбек К.' },
  { pid: 'P-25-00671', id: 178320, name: 'Юсупова Дилноза Маратовна', dob: '21.03.2000', age: 25, sex: 'Ж', phone: '+998 93 321 65 87', last: '15.03.2026', visits: 4, status: 'active', coverage: 'Корпоративный', insurer: '', tg: false, branch: 'ML', balance: 0, cashback: 5400, registrar: 'Дилфуза Ш.' },
]
```
Then `src/services/registration.ts`:
```ts
import type { RegPatient } from '@/domain/registration'
import { REG_PATIENTS } from '@/data/registration'

// Async on purpose: the seam a real backend replaces later.
export async function getRegPatients(): Promise<RegPatient[]> {
  return REG_PATIENTS
}
export async function getRegPatient(id: number): Promise<RegPatient | undefined> {
  return REG_PATIENTS.find(p => p.id === id)
}
```

- [ ] **Step 6: Run — PASS**, full `npm run verify` green.
- [ ] **Step 7: Commit:** `git add -A && git commit -m "feat(registration): patient base domain + data + service seam (TDD)"`

---

### Task 2: PatientsPage (stats + search + sortable table) + card stub + routing

**Files:** `src/features/registration/PatientsPage.tsx`, `PatientsTable.tsx`, `RegPatientCardPage.tsx`, `PatientsPage.test.tsx`. Modify `src/app/router.tsx`.

- [ ] **Step 1: `PatientsTable.tsx`** (sortable columns; colored balance; inpatient tag; Telegram indicator):
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Send, BedDouble } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RegPatient } from '@/domain/registration'
import { dateKey } from '@/domain/registration'
import { initials, avatarColor, moneyFmt } from '@/domain/format'

type SortKey = 'name' | 'dob' | 'last' | 'visits' | 'balance'
const SORTS: Record<SortKey, (a: RegPatient, b: RegPatient) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'ru'),
  dob: (a, b) => dateKey(a.dob) - dateKey(b.dob),
  last: (a, b) => dateKey(a.last) - dateKey(b.last),
  visits: (a, b) => a.visits - b.visits,
  balance: (a, b) => a.balance - b.balance,
}

function fmtBalance(b: number): string {
  if (b === 0) return '0'
  return `${b < 0 ? '−' : '+'}${moneyFmt(Math.abs(b))}`
}

export function PatientsTable({ patients }: { patients: RegPatient[] }) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('last')
  const [dir, setDir] = useState<1 | -1>(-1)
  const toggle = (k: SortKey) => { if (k === sortKey) setDir(d => (d === 1 ? -1 : 1)); else { setSortKey(k); setDir(1) } }
  const rows = [...patients].sort((a, b) => SORTS[sortKey](a, b) * dir)
  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => toggle(k)} className={cn('inline-flex items-center gap-1 hover:text-foreground', sortKey === k && 'text-foreground')}>
        {children}<ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  )
  if (rows.length === 0) return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Пациенты не найдены.</div>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <Th k="name">Пациент</Th>
          <Th k="dob">Дата рожд.</Th>
          <TableHead>Пол</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead>Телеграм</TableHead>
          <Th k="last">Последний визит</Th>
          <Th k="visits" className="text-right">Визитов</Th>
          <TableHead>Покрытие</TableHead>
          <Th k="balance" className="text-right">Баланс</Th>
          <TableHead>Регистратор</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(p => (
          <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/registration/patient/${p.id}`)}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar className="size-8"><AvatarFallback style={{ background: avatarColor(p.name), color: '#fff' }}>{initials(p.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.inpatient && <Badge variant="secondary" className="gap-1 px-1.5 text-[10px]"><BedDouble className="size-3" />стационар</Badge>}
                    {p.status === 'archive' && <Badge variant="outline" className="px-1.5 text-[10px]">архив</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.pid} · ID {p.id}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm tabular-nums">{p.dob}<span className="ml-1 text-xs text-muted-foreground">({p.age})</span></TableCell>
            <TableCell className="text-sm">{p.sex}</TableCell>
            <TableCell className="text-sm tabular-nums">{p.phone}</TableCell>
            <TableCell>{p.tg ? <span className="inline-flex items-center gap-1 text-xs text-primary"><Send className="size-3" />активен</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
            <TableCell className="text-sm tabular-nums">{p.last}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{p.visits}</TableCell>
            <TableCell className="text-sm">{p.coverage}{p.insurer && <span className="block text-xs text-muted-foreground">{p.insurer}</span>}</TableCell>
            <TableCell className={cn('text-right text-sm tabular-nums', p.balance > 0 && 'text-ok', p.balance < 0 && 'text-destructive')}>{fmtBalance(p.balance)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.registrar}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```
(If `React.ReactNode` needs an import, use `import type { ReactNode } from 'react'`.)

- [ ] **Step 2: `PatientsPage.tsx`** (stats computed from the list + global search):
```tsx
import { useEffect, useMemo, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { RegPatient } from '@/domain/registration'
import { getRegPatients } from '@/services/registration'
import { PatientsTable } from './PatientsTable'

export function PatientsPage() {
  const [patients, setPatients] = useState<RegPatient[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    let alive = true
    getRegPatients().then(p => { if (alive) setPatients(p) })
    return () => { alive = false }
  }, [])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return patients
    return patients.filter(p => (p.name + ' ' + p.pid + ' ' + p.id + ' ' + p.phone).toLowerCase().includes(s))
  }, [patients, q])
  const stats = [
    { label: 'Всего пациентов', value: patients.length },
    { label: 'Активные', value: patients.filter(p => p.status === 'active').length },
    { label: 'С покрытием (ДМС/страховка/корп.)', value: patients.filter(p => p.coverage !== 'Платно').length },
    { label: 'Сейчас в стационаре', value: patients.filter(p => p.inpatient).length },
  ]
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium">Регистратура</div>
          <div className="text-sm text-muted-foreground">База пациентов клиники — поиск, карточки, запись на услуги.</div>
        </div>
        <Button disabled title="Создание пациента — в следующем обновлении"><UserPlus className="size-4" />Создать пациента</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по ФИО, ID, телефону…" aria-label="Поиск пациента" className="h-10 flex-1 bg-transparent text-sm outline-none" />
        {q && <button className="text-xs text-primary" onClick={() => setQ('')}>Сбросить</button>}
      </div>
      <PatientsTable patients={filtered} />
    </div>
  )
}
```

- [ ] **Step 3: `RegPatientCardPage.tsx`** (stub for the next slice):
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { RegPatient } from '@/domain/registration'
import { getRegPatient } from '@/services/registration'
import { initials, avatarColor } from '@/domain/format'

export function RegPatientCardPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [p, setP] = useState<RegPatient | undefined>()
  useEffect(() => {
    let alive = true
    getRegPatient(Number(patientId)).then(x => { if (alive) setP(x) })
    return () => { alive = false }
  }, [patientId])
  if (!p) return <div className="p-8 text-sm text-muted-foreground">Пациент не найден.</div>
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/registration')}><ArrowLeft className="size-4" />К базе пациентов</Button>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Avatar className="size-12"><AvatarFallback style={{ background: avatarColor(p.name), color: '#fff' }}>{initials(p.name)}</AvatarFallback></Avatar>
        <div>
          <div className="font-semibold">{p.name}</div>
          <div className="text-sm text-muted-foreground">{p.pid} · ID {p.id} · {p.dob} ({p.age}) · {p.sex === 'Ж' ? 'жен.' : 'муж.'} · {p.phone}</div>
        </div>
      </div>
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Карточка пациента — в следующем обновлении.</div>
    </div>
  )
}
```

- [ ] **Step 4: Router** — in `src/app/router.tsx`: import both pages; replace `{ path: 'registration', element: <ModulePlaceholder title="Регистратура" /> }` with `{ path: 'registration', element: <PatientsPage /> }` and add `{ path: 'registration/patient/:patientId', element: <RegPatientCardPage /> }`.

- [ ] **Step 5: Smoke test** `PatientsPage.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'jest-axe'
import { PatientsPage } from './PatientsPage'

describe('PatientsPage (smoke)', () => {
  it('renders stats, search and the patient table with no axe violations', async () => {
    const { container, findByText, getByLabelText } = render(<MemoryRouter><PatientsPage /></MemoryRouter>)
    expect(await findByText('Ахмеди Саддам Хусейн')).toBeTruthy()
    expect(getByLabelText('Поиск пациента')).toBeTruthy()
    await waitFor(() => expect(container.querySelectorAll('tbody tr').length).toBe(12))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 6: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): patient base screen (stats, search, sortable table) + card stub"`

---

### Task 3: Gate + screenshot
- [ ] `npm run verify && npm run build`; (controller) screenshot `/registration` and a search-filtered state; visual pass.

---

## Self-Review (plan author)

**Spec coverage:** Slice 0+1 of the Registration map: typed data seam (12 patients verbatim, registrar round-robin baked — no in-place mutation), `getRegPatients`/`getRegPatient` service, and the patient base screen (derived stats, global search, sortable table with all prototype columns: patient+pid+inpatient/archive tags, dob+age, sex, phone, Telegram, last visit, visits, coverage+insurer, colored balance with proper −/+ signs — `moneyFmt` strips signs so `fmtBalance` handles them — registrar), rows → card stub route. Deferred items named (per-column filters, create-patient modal, dashboard, calendar, full card, registration flow).

**Placeholder scan:** none — data complete, all code shown. The disabled "Создать пациента" button carries an explanatory title (deferred slice), consistent with earlier card-shell patterns.

**Type consistency:** `RegPatient`/`regIsInpatient`/`dateKey` in domain; data/service/table/pages all consume them; `initials`/`avatarColor`/`moneyFmt` exist in `@/domain/format`; `text-ok` utility exists (theme). Router paths match the spec's route table.

**Scope:** One shippable screen + its seam; TDD on pure logic; smoke on the page; visually verified.
