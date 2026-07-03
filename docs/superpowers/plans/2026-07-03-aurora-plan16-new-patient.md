# Aurora Redesign — Plan 16: New-patient form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make «Создать пациента» real: a 3-section modal (Личные данные with photo + auto-age + sex toggle · Документы и резидентство with auto-category · Контакты и адрес with region→district cascade + Telegram invite), a guardian block for minors (<16: pick from base or enter new), required-field validation, and actual persistence — created patients appear in the base table and survive reload.

**Architecture:** Domain helpers `calcAge(iso, today=REFERENCE_DAY)` + `isoToDMY` (TDD). Service `createRegPatient(input)` appends to a localStorage overlay (`aurora.reg.newPatients`) merged by `getRegPatients`/`getRegPatient` (same seam pattern as Plan 8's status overrides); generates sequential `pid`/`id`; new records default `visits:0,status:'active',coverage:'Платно',balance:0,cashback:0,registrar:'Исломбек К.'`. UI: `NewPatientModal` (design-system Dialog/Input/Select/ToggleGroup; `RpField` label wrapper; photo via file-upload/webcam/URL; guardian picker searching adult patients) + `WebcamCapture` (getUserMedia, ported). Wire into `PatientsPage` (enable the button; refresh list on create). Ported from prototype `reg-base.jsx:198-501`. **Simplifications (noted):** phone = plain input (the prototype's flag-emoji PhoneInput violates the no-emoji rule); edit-mode + `regDemographics` prefill deferred with the patient card slice.

**Tech Stack:** React 19, TS, design-system `Dialog`/`Input`/`Select`/`ToggleGroup`/`Button`/`Avatar`/`ScrollArea`, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis.

---

### Task 1: Age/date helpers + createRegPatient (TDD)

**Files:** `src/domain/registration.ts` (+ helpers), `src/domain/registration.test.ts` (+ tests), `src/services/registration.ts` (+ create/overlay), `src/services/registration.test.ts` (+ tests).

- [ ] **Step 1: Add failing domain tests** (append to `src/domain/registration.test.ts`):
```ts
import { calcAge, isoToDMY } from './registration'   // merge into the existing import

describe('registration age/date helpers', () => {
  it('calcAge computes full years against a reference day', () => {
    const today = new Date(2026, 5, 4) // 04.06.2026
    expect(calcAge('2018-08-28', today)).toBe(7)   // birthday later in the year
    expect(calcAge('2016-02-14', today)).toBe(10)  // birthday passed
    expect(calcAge('', today)).toBeNull()
    expect(calcAge('not-a-date', today)).toBeNull()
  })
  it('isoToDMY converts 2018-08-28 to 28.08.2018', () => {
    expect(isoToDMY('2018-08-28')).toBe('28.08.2018')
    expect(isoToDMY('')).toBe('')
  })
})
```

- [ ] **Step 2: Run — FAIL**, then implement in `src/domain/registration.ts` (append; import `REFERENCE_DAY` from `./dates`):
```ts
import { REFERENCE_DAY } from './dates'

export function calcAge(iso: string, today: Date = REFERENCE_DAY): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  let a = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--
  return a >= 0 && a < 140 ? a : null
}

export function isoToDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}
```

- [ ] **Step 3: Run — PASS.** Add failing service tests (append to `src/services/registration.test.ts`; add `beforeEach` import + `createRegPatient` to the service import):
```ts
describe('registration service — createRegPatient', () => {
  beforeEach(() => { localStorage.clear() })
  it('creates a patient that appears in the base and by id', async () => {
    const p = await createRegPatient({ name: 'Тестова Анна Ивановна', dob: '01.01.1990', age: 36, sex: 'Ж', phone: '+998 90 000 11 22', tg: false })
    expect(p.pid.startsWith('P-26-9')).toBe(true)
    const list = await getRegPatients()
    expect(list).toHaveLength(13)
    expect((await getRegPatient(p.id))!.name).toBe('Тестова Анна Ивановна')
  })
  it('created patients get sequential ids and default fields', async () => {
    const a = await createRegPatient({ name: 'А', dob: '', age: null, sex: 'М', phone: '', tg: false })
    const b = await createRegPatient({ name: 'Б', dob: '', age: null, sex: 'Ж', phone: '', tg: true })
    expect(b.id).toBe(a.id + 1)
    expect(a.visits).toBe(0); expect(a.status).toBe('active'); expect(a.coverage).toBe('Платно'); expect(a.balance).toBe(0)
  })
})
```

- [ ] **Step 4: Run — FAIL**, then extend `src/services/registration.ts`:
```ts
const NEW_KEY = 'aurora.reg.newPatients'
function loadNew(): RegPatient[] {
  try { const l = JSON.parse(localStorage.getItem(NEW_KEY) ?? '[]'); return Array.isArray(l) ? (l as RegPatient[]) : [] } catch { return [] }
}

export interface NewPatientInput { name: string; dob: string; age: number | null; sex: 'М' | 'Ж'; phone: string; tg: boolean }

export async function createRegPatient(input: NewPatientInput): Promise<RegPatient> {
  const existing = loadNew()
  const n = existing.length + 1
  const p: RegPatient = {
    pid: `P-26-9${String(n).padStart(4, '0')}`, id: 900000 + n,
    name: input.name, dob: input.dob, age: input.age ?? 0, sex: input.sex, phone: input.phone,
    last: '', visits: 0, status: 'active', coverage: 'Платно', insurer: '', tg: input.tg,
    branch: 'MFH', balance: 0, cashback: 0, registrar: 'Исломбек К.',
  }
  localStorage.setItem(NEW_KEY, JSON.stringify([...existing, p]))
  return p
}

// update the existing reads to merge the overlay:
export async function getRegPatients(): Promise<RegPatient[]> {
  return [...REG_PATIENTS, ...loadNew()]
}
export async function getRegPatient(id: number): Promise<RegPatient | undefined> {
  return (await getRegPatients()).find(p => p.id === id)
}
```
NOTE: the existing base tests assert `toHaveLength(12)` — they run with empty localStorage (and any test file that previously left overlay data must be cleaned). Ensure the OLD describe block in this test file also gets `beforeEach(() => localStorage.clear())` so ordering never breaks it (add it; report that you did).

- [ ] **Step 5: Run — PASS**, full `npm run verify` green.
- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat(registration): age/date helpers + createRegPatient with persistent overlay (TDD)"`

---

### Task 2: NewPatientModal + WebcamCapture + wiring

**Files:** `src/features/registration/WebcamCapture.tsx`, `NewPatientModal.tsx`, `NewPatientModal.test.tsx`. Modify `PatientsPage.tsx`.

- [ ] **Step 1: `WebcamCapture.tsx`** (ported):
```tsx
import { useEffect, useRef, useState } from 'react'
import { Camera, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function WebcamCapture({ onClose, onCapture }: { onClose: () => void; onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    if (!navigator.mediaDevices?.getUserMedia) { setErr('Камера не поддерживается этим браузером.'); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; setReady(true) }
      })
      .catch(e => setErr(`Нет доступа к камере: ${e?.message ?? e}. Разрешите доступ в браузере.`))
    return () => { active = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])
  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/jpeg', 0.9)
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCapture(url)
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="size-4" />Съёмка фото пациента</DialogTitle></DialogHeader>
        {err
          ? <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"><TriangleAlert className="size-4 text-destructive" />{err}</div>
          : <video ref={videoRef} className="w-full rounded-md bg-black" autoPlay playsInline muted />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={snap} disabled={!!err || !ready}><Camera className="size-4" />Сделать снимок</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: `NewPatientModal.tsx`** — the full form. Structure (all Russian copy verbatim from the prototype; complete code below):
```tsx
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { UserRound, Camera, Upload, Link2, Send, TriangleAlert, Check, Search, Plus, ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { RegPatient } from '@/domain/registration'
import { calcAge, isoToDMY } from '@/domain/registration'
import { createRegPatient } from '@/services/registration'
import { capWords, initials, avatarColor } from '@/domain/format'
import { WebcamCapture } from './WebcamCapture'

const REGIONS = ['г. Ташкент', 'Ташкентская область', 'Самаркандская область', 'Бухарская область', 'Андижанская область', 'Ферганская область', 'Наманганская область', 'Хорезмская область', 'Кашкадарьинская область', 'Сурхандарьинская область', 'Навоийская область', 'Джизакская область', 'Сырдарьинская область', 'Республика Каракалпакстан']
const DISTRICTS = ['Юнусабадский', 'Чиланзарский', 'Мирзо-Улугбекский', 'Яшнабадский', 'Шайхантахурский', 'Сергелийский', 'Учтепинский', 'Алмазарский', 'Яккасарайский', 'Бектемирский']
const RELATIONS = ['Мать', 'Отец', 'Бабушка', 'Дедушка', 'Опекун', 'Иной представитель']

function Field({ label, req, error, full, children }: { label: string; req?: boolean; error?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <label className={cn('block text-xs', full && 'sm:col-span-2 lg:col-span-3', error ? 'text-destructive' : 'text-muted-foreground')}>
      {label}{req && <span className="text-destructive"> *</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function SectionHead({ n, title, sub, warn }: { n: ReactNode; title: string; sub: string; warn?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold', warn ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')}>{n}</span>
      <b className="text-sm">{title}</b>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

function GuardianFromBase({ pool, value, onPick }: { pool: RegPatient[]; value: string; onPick: (pid: string) => void }) {
  const [q, setQ] = useState('')
  const picked = value ? pool.find(p => p.pid === value) : null
  if (picked) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-2">
        <Avatar className="size-8"><AvatarFallback style={{ background: avatarColor(picked.name), color: '#fff' }}>{initials(picked.name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{picked.name}</div>
          <div className="text-xs text-muted-foreground">{picked.pid} · {picked.phone}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onPick('')}>Изменить</Button>
      </div>
    )
  }
  const adults = pool.filter(p => p.age >= 18)
  const ql = q.trim().toLowerCase()
  const list = adults.filter(p => !ql || `${p.name} ${p.pid} ${p.phone}`.toLowerCase().includes(ql)).slice(0, 6)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-md border px-2">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск опекуна по ФИО, ID или телефону…" aria-label="Поиск опекуна" className="h-9 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="max-h-40 space-y-1 overflow-auto">
        {list.map(p => (
          <button type="button" key={p.pid} onClick={() => onPick(p.pid)} className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-accent">
            <Avatar className="size-7"><AvatarFallback style={{ background: avatarColor(p.name), color: '#fff' }}>{initials(p.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.pid} · {p.phone}</span>
            </span>
            <Plus className="size-4 text-muted-foreground" />
          </button>
        ))}
        {list.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Не найдено. Заполните нового опекуна.</p>}
      </div>
    </div>
  )
}

export function NewPatientModal({ pool, onClose, onCreated, notify }: { pool: RegPatient[]; onClose: () => void; onCreated: () => void; notify: (m: string) => void }) {
  const [f, setF] = useState({
    last: '', first: '', middle: '', dob: '', sex: '' as '' | 'М' | 'Ж', phone: '', phone2: '',
    residency: 'resident', pinfl: '', passport: '', nationality: 'Узбек', category: '',
    email: '', lang: 'Узбекский', country: 'Узбекистан', region: '', district: '', street: '', mahalla: '', tgSent: false,
    gmode: 'base' as 'base' | 'new', gpatient: '', gname: '', gphone: '', grel: 'Мать',
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [photo, setPhoto] = useState<string | null>(null)
  const [cam, setCam] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  const setCap = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: capWords(e.target.value) }))
  const setV = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))

  const age = useMemo(() => calcAge(f.dob), [f.dob])
  const minor = age != null && age < 16
  const catAuto = age == null ? '' : age < 1 ? 'Новорождённый' : age < 18 ? 'Ребёнок' : 'Взрослый'

  const save = async () => {
    const e: Record<string, boolean> = {}
    if (!f.last.trim()) e.last = true
    if (!f.first.trim()) e.first = true
    if (!f.dob) e.dob = true
    if (!f.sex) e.sex = true
    if (!f.phone.trim()) e.phone = true
    if (minor) {
      if (f.gmode === 'base' && !f.gpatient) e.gpatient = true
      if (f.gmode === 'new' && (!f.gname.trim() || !f.gphone.trim())) { e.gname = !f.gname.trim(); e.gphone = !f.gphone.trim() }
    }
    setErrors(e)
    if (Object.keys(e).length) return
    await createRegPatient({
      name: [f.last, f.first, f.middle].filter(Boolean).join(' '),
      dob: isoToDMY(f.dob), age, sex: f.sex as 'М' | 'Ж', phone: f.phone, tg: f.tgSent,
    })
    notify('Пациент создан')
    onCreated()
    onClose()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="size-4" />Создать пациента</DialogTitle></DialogHeader>

        <section>
          <SectionHead n="1" title="Личные данные" sub="ФИО, дата рождения, пол, телефон" />
          <div className="flex gap-4">
            <div className="w-32 shrink-0 space-y-1.5">
              <button type="button" onClick={() => photoRef.current?.click()} className="flex h-36 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border text-xs text-muted-foreground hover:bg-accent">
                {photo ? <img src={photo} alt="Фото пациента" className="h-full w-full object-cover" /> : <><ImageIcon className="size-6" />Фото пациента</>}
              </button>
              <div className="flex justify-center gap-1">
                <Button type="button" variant="outline" size="icon" title="Сфотографировать с веб-камеры" onClick={() => setCam(true)}><Camera className="size-4" /></Button>
                <Button type="button" variant="outline" size="icon" title="Загрузить файл с компьютера" onClick={() => photoRef.current?.click()}><Upload className="size-4" /></Button>
                <Button type="button" variant="outline" size="icon" title="Добавить фото по ссылке (URL)" onClick={() => { const u = window.prompt('Ссылка на фото (URL)'); if (u?.trim()) { setPhoto(u.trim()); notify('Фото по ссылке добавлено') } }}><Link2 className="size-4" /></Button>
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = () => { setPhoto(String(r.result)); notify(`Фото загружено: ${file.name}`) }; r.readAsDataURL(file) } e.target.value = '' }} />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Фамилия" req error={errors.last}><Input autoFocus value={f.last} onChange={setCap('last')} placeholder="Каримова" /></Field>
              <Field label="Имя" req error={errors.first}><Input value={f.first} onChange={setCap('first')} placeholder="Азиза" /></Field>
              <Field label="Отчество"><Input value={f.middle} onChange={setCap('middle')} placeholder="Рустамовна" /></Field>
              <Field label="Дата рождения" req error={errors.dob}><Input type="date" value={f.dob} onChange={set('dob')} /></Field>
              <Field label="Возраст"><Input value={age != null ? `${age} лет` : ''} placeholder="—" readOnly tabIndex={-1} className="bg-muted/50" /></Field>
              <Field label="Пол" req error={errors.sex}>
                <ToggleGroup type="single" value={f.sex} onValueChange={v => v && setV('sex', v as 'М' | 'Ж')} className="w-full">
                  <ToggleGroupItem value="М" aria-label="Мужской" className="flex-1">Мужской</ToggleGroupItem>
                  <ToggleGroupItem value="Ж" aria-label="Женский" className="flex-1">Женский</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field label="Номер телефона" req error={errors.phone}><Input value={f.phone} onChange={set('phone')} placeholder="+998 90 961 00 04" /></Field>
              <Field label="Доп. номер телефона"><Input value={f.phone2} onChange={set('phone2')} placeholder="+998 90 000 00 00" /></Field>
              <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" /></Field>
            </div>
          </div>
        </section>

        {minor && (
          <section className="rounded-md border border-warn/40 bg-warn/10 p-3">
            <SectionHead n={<TriangleAlert className="size-3.5" />} warn title="Данные опекуна" sub={`Пациенту ${age} лет — требуется законный представитель`} />
            <ToggleGroup type="single" value={f.gmode} onValueChange={v => v && setV('gmode', v as 'base' | 'new')} className="w-fit">
              <ToggleGroupItem value="base" aria-label="Выбрать из базы">Выбрать из базы</ToggleGroupItem>
              <ToggleGroupItem value="new" aria-label="Новый опекун">Новый опекун</ToggleGroupItem>
            </ToggleGroup>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Кем приходится">
                <Select value={f.grel} onValueChange={v => setV('grel', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </Field>
            </div>
            {f.gmode === 'base' ? (
              <div className="mt-2">
                <div className={cn('mb-1 text-xs', errors.gpatient ? 'text-destructive' : 'text-muted-foreground')}>Опекун из базы пациентов{errors.gpatient && ' — выберите'}</div>
                <GuardianFromBase pool={pool} value={f.gpatient} onPick={v => setV('gpatient', v)} />
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="ФИО опекуна" req error={errors.gname} full><Input value={f.gname} onChange={setCap('gname')} placeholder="Каримов Рустам Аброрович" /></Field>
                <Field label="Телефон опекуна" req error={errors.gphone}><Input value={f.gphone} onChange={set('gphone')} placeholder="+998 90 000 00 00" /></Field>
                <Field label="Паспорт опекуна"><Input placeholder="AB1234567" /></Field>
              </div>
            )}
          </section>
        )}

        <section>
          <SectionHead n="2" title="Документы и резидентство" sub="ПИНФЛ, паспорт, гражданство" />
          <div className="mb-3">
            <Field label="Резидентство">
              <ToggleGroup type="single" value={f.residency} onValueChange={v => v && setV('residency', v)} className="w-fit">
                <ToggleGroupItem value="resident" aria-label="Резидент РУз">Резидент РУз</ToggleGroupItem>
                <ToggleGroupItem value="nonresident" aria-label="Нерезидент">Нерезидент</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="ПИНФЛ (ЖШШИР)"><Input value={f.pinfl} onChange={set('pinfl')} placeholder="14 цифр" /></Field>
            <Field label="Паспорт / документ №"><Input value={f.passport} onChange={set('passport')} placeholder="AB1234567" /></Field>
            <Field label="Гражданство / национальность"><Input value={f.nationality} onChange={set('nationality')} placeholder="Узбек" /></Field>
            <Field label="Категория пациента">
              <Select value={f.category || 'auto'} onValueChange={v => setV('category', v === 'auto' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{catAuto ? `Авто: ${catAuto}` : '—'}</SelectItem>
                  <SelectItem value="Взрослый">Взрослый</SelectItem>
                  <SelectItem value="Ребёнок">Ребёнок</SelectItem>
                  <SelectItem value="Новорождённый">Новорождённый</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <SectionHead n="3" title="Контакты и адрес" sub="Где с пациентом можно связаться" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Предпочитаемый язык">
              <Select value={f.lang} onValueChange={v => setV('lang', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{['Узбекский', 'Русский', 'Английский', 'Каракалпакский'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Страна">
              <Select value={f.country} onValueChange={v => setV('country', v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{['Узбекистан', 'Казахстан', 'Кыргызстан', 'Таджикистан', 'Россия', 'Другая'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Регион">
              <Select value={f.region || 'none'} onValueChange={v => { setV('region', v === 'none' ? '' : v); setV('district', '') }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Выберите регион —</SelectItem>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Район">
              <Select value={f.district || 'none'} onValueChange={v => setV('district', v === 'none' ? '' : v)} disabled={!f.region}>
                <SelectTrigger className="w-full"><SelectValue placeholder={f.region ? '— Выберите район —' : '— Сначала регион —'} /></SelectTrigger>
                <SelectContent><SelectItem value="none">{f.region ? '— Выберите район —' : '— Сначала регион —'}</SelectItem>{(f.region ? DISTRICTS : []).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Махалля"><Input value={f.mahalla} onChange={set('mahalla')} placeholder="Юнусабад-3" /></Field>
            <Field label="Улица, дом, квартира" full><Input value={f.street} onChange={set('street')} placeholder="ул. Амира Темура 12, кв. 47" /></Field>
            <Field label="Telegram-бот (уведомления и напоминания)" full>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', f.tgSent ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground')}>
                  <Send className="size-3" />{f.tgSent ? 'Приглашение отправлено' : 'Не подключён'}
                </span>
                {f.tgSent
                  ? <span className="text-xs text-muted-foreground">Ссылка на бота отправлена на {f.phone || 'номер пациента'} — подключение после перехода по ней.</span>
                  : <Button type="button" variant="secondary" size="sm" onClick={() => setV('tgSent', true)}><Send className="size-3.5" />Отправить приглашение в бот</Button>}
              </div>
            </Field>
          </div>
        </section>

        <DialogFooter className="items-center">
          {Object.keys(errors).length > 0 && <span className="mr-auto flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="size-3.5" />Заполните обязательные поля{minor ? ' и данные опекуна' : ''}</span>}
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={save}><Check className="size-4" />Создать пациента</Button>
        </DialogFooter>
      </DialogContent>
      {cam && <WebcamCapture onClose={() => setCam(false)} onCapture={url => { setPhoto(url); setCam(false); notify('Фото снято с камеры') }} />}
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire `PatientsPage.tsx`** — enable the button and refresh on create:
  1. Imports: `NewPatientModal`, `Toast` pattern — PatientsPage has no toast; reuse the consultation `Toast`? It lives at `@/features/doctor/consultation/Toast` — feature-crossing import is acceptable for now OR simpler: use a transient inline message. **Do the simple thing:** import the existing `Toast`/`ToastMsg` from `@/features/doctor/consultation/Toast` (it's a generic component; note the reuse) and add toast state like ConsultationPage does.
  2. Add state: `const [creating, setCreating] = useState(false)` + toast state + a `reload` function that re-runs `getRegPatients().then(setPatients)`.
  3. Change the disabled button to `onClick={() => setCreating(true)}` (remove `disabled` + title).
  4. Render `{creating && <NewPatientModal pool={patients} onClose={() => setCreating(false)} onCreated={reload} notify={m => setToast({ msg: m, tone: 'ok' })} />}` and `<Toast toast={toast} onClose={() => setToast(null)} />`.

- [ ] **Step 4: Smoke test** `NewPatientModal.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { NewPatientModal } from './NewPatientModal'

describe('NewPatientModal (smoke)', () => {
  beforeEach(() => { localStorage.clear() })
  it('mounts with the three sections, no axe violations', async () => {
    const { baseElement, getByText } = render(<NewPatientModal pool={[]} onClose={() => {}} onCreated={() => {}} notify={() => {}} />)
    expect(getByText('Личные данные')).toBeTruthy()
    expect(getByText('Документы и резидентство')).toBeTruthy()
    expect(getByText('Контакты и адрес')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
  it('validates required fields on save', () => {
    const { getByText } = render(<NewPatientModal pool={[]} onClose={() => {}} onCreated={() => {}} notify={() => {}} />)
    fireEvent.click(getByText('Создать пациента', { selector: 'button span, button' }))
    expect(getByText(/Заполните обязательные поля/)).toBeTruthy()
  })
})
```
NOTE: the footer submit button text equals the dialog title text pattern — if `getByText('Создать пациента')` is ambiguous (title vs button), use `getAllByText` and click the last, or `getByRole('button', { name: /Создать пациента/ })` (report which you used).

- [ ] **Step 5: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): new-patient form (3 sections, guardian for minors, photo, validation, persistent create)"`

---

### Task 3: Gate + screenshots
- [ ] `npm run verify && npm run build`; (controller) screenshots: the open form; the guardian block (minor dob); a created patient appearing in the base.

---

## Self-Review (plan author)

**Spec coverage:** Slice 2 of the Registration map, ported from `reg-base.jsx:198-501`: 3-section form (photo file/webcam/URL, auto-age from dob against REFERENCE_DAY, auto-category, sex/residency toggles, region→district cascade, Telegram invite chip), guardian block for minors (<16; base-search over adult patients or new-guardian fields), REAL required-field validation (the prototype's was vestigial), and REAL persistence (`createRegPatient` overlay — created patients appear in the table and survive reload; sequential pid/id, TDD). Simplifications noted: plain phone inputs (no-emoji rule vs the prototype's flag PhoneInput); edit-mode deferred to the card slice.

**Placeholder scan:** none — full code; the guardian "Паспорт опекуна" input is intentionally uncontrolled cosmetic (as in the prototype). Test-ambiguity contingencies stated explicitly.

**Type consistency:** `NewPatientInput`/`createRegPatient` (service) match the modal's save; `calcAge`/`isoToDMY` in domain (TDD) used by the modal; `capWords`/`initials`/`avatarColor` exist; `Toast` reuse noted; overlay merge keeps `getRegPatients` signature. Existing 12-length test gets `beforeEach` cleanup (explicit instruction).

**Scope:** One feature (create patient) end-to-end: form → validate → persist → visible in base; logic TDD'd, UI smoke-tested, visually verified.
