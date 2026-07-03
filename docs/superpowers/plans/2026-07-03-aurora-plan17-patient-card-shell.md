# Aurora Redesign — Plan 17: Patient card — shell, header, Обзор

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace the patient-card stub with the real card (Slice 3a): dashboard header (avatar/name/status + inpatient pill + meta pills + guardian link + tags/notes with a Marks modal + 6 clickable metric cards), a 13-tab strip (Обзор live now; the other 12 render "в следующем обновлении" stubs for later slices), and the **Обзор** tab (contacts/passport block, summary facts, family & linked patients, activity timeline).

**Architecture:** `src/data/patientCard.ts` — the card's demo datasets ported verbatim (services 9, labs 8, insurance 3, recs 5, rx 2, calls 4, messages 4, family 3, cashback meta, demographics, tag palette + seed tags/notes). NOTE (honest port): in the prototype these are **singleton demo datasets for whichever patient is opened** — same here, served via `getPatientCard()` (`src/services/patientCard.ts`); per-patient card data is future backend work. UI in `src/features/registration/card/`: `PatientCardPage` (loads patient + card bundle, tab state), `CardHeader` (+ `MetricStrip`), `MarksModal`, `OverviewTab`, `TabStub`. Router keeps `/registration/patient/:patientId` (page replaces the Plan-15 stub). «Новый визит» is disabled for inpatients (with the prototype's warning) and otherwise stubbed to a notify (registration flow = Slice 4). Ported from `reg-card.jsx:1-309` + `reg-card2.jsx:1282-1345` (tab keys/labels) + `reg-data.jsx` datasets.

**Tech Stack:** React 19, TS, design-system `Tabs`/`Card`/`Badge`/`Button`/`Avatar`/`Dialog`/`Textarea`/`Input`, lucide-react, Vitest + jest-axe. Toast reuse (`@/features/doctor/consultation/Toast`).

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## Tab registry (13 — keys/labels per prototype)
`overview` Обзор · `services` Услуги · `labs` Лаборатория · `checkup` Чек-ап · `ins` ДМС&B2B · `acc` Кошелёк · `invoices` Счета · `recs` Рекоменд. · `loyalty` Лояльность · `cashback` Кешбэк · `comms` Общение · `files` Файлы · `docs` Документы

---

### Task 1: Card data + service (TDD)

**Files:** `src/data/patientCard.ts`, `src/services/patientCard.ts`, `src/services/patientCard.test.ts`.

- [ ] **Step 1: Failing tests** `src/services/patientCard.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getPatientCard } from './patientCard'

describe('patient card service', () => {
  it('returns the card bundle with all datasets', async () => {
    const c = await getPatientCard()
    expect(c.services).toHaveLength(9)
    expect(c.labs).toHaveLength(8)
    expect(c.insurance).toHaveLength(3)
    expect(c.recs).toHaveLength(5)
    expect(c.calls).toHaveLength(4)
    expect(c.messages).toHaveLength(4)
    expect(c.family).toHaveLength(3)
    expect(c.cashbackPercent).toBe(3)
    expect(c.demographics.passport).toBe('AA 1234567')
  })
  it('services carry lifecycle fields', async () => {
    const c = await getPatientCard()
    const s = c.services[0]
    expect(s.status).toBe('done'); expect(s.invoice).toBe('issued'); expect(s.pay).toBe('paid')
    expect(s.checkupId).toBe('CK1')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- patientCard`

- [ ] **Step 3: Implement** `src/data/patientCard.ts` — types + datasets **verbatim** from prototype `reg-data.jsx` (all rows; the two long arrays shown in full below MUST be copied completely as given):
```ts
export interface CardService {
  date: string; doneDate: string; name: string; type: string; doctor: string; room: string; time: string
  addedBy: string; status: 'done' | 'planned' | 'cancelled'; invoice: 'issued' | 'draft' | 'none'; invoiceNo: string
  pay: 'paid' | 'partial' | 'unpaid'; qty: number; price: number; discount: number; pkgAlloc?: number; amount: number
  checkupId: string | null; docs: string[]
}
export interface CardLab { date: string; reqNo: string; issued: string; panel: string; name: string; value: string; unit: string; min: number; max: number; flag: 'low' | 'high' | 'ok' }
export interface CardInsurance { kind: string; company: string; policy: string; valid: string; limit: number; used: number; status: 'active' | 'none' }
export interface CardRec { name: string; cat: string; by: string; date: string; price: number; status: 'open' | 'sold' | 'cancelled' }
export interface CardRx { name: string; dose: string; by: string; date: string }
export interface CardCall { date: string; dir: 'in' | 'out'; who: string; dur: string; topic: string; result: string }
export interface CardMessage { date: string; ch: 'sms' | 'telegram' | 'whatsapp'; dir: 'in' | 'out'; text: string; status: string }
export interface CardFamily { pid: string; name: string; rel: string; sex: 'М' | 'Ж'; age: number; phone: string; roles: string[] }

export const CARD_SERVICES: CardService[] = [
  { date: '02.06.2026', doneDate: '03.06.2026', name: 'Приём (осмотр, консультация) кардиолога', type: 'Консультация', doctor: 'Бакиева М. А.', room: '1-06', time: '03.06.2026 10:00–10:20', addedBy: 'Кадыров Исломбек Х.', status: 'done', invoice: 'issued', invoiceNo: '№00190', pay: 'paid', qty: 1, price: 280000, discount: 25926, pkgAlloc: 25926, amount: 254074, checkupId: 'CK1', docs: ['Протокол осмотра', 'Заключение кардиолога'] },
  { date: '02.06.2026', doneDate: '03.06.2026', name: 'ЭКГ с расшифровкой', type: 'Инструментальная', doctor: 'Бакиева М. А.', room: '1-06', time: '03.06.2026 10:20–10:35', addedBy: 'Кадыров Исломбек Х.', status: 'done', invoice: 'issued', invoiceNo: '№00190', pay: 'paid', qty: 1, price: 90000, discount: 8333, pkgAlloc: 8333, amount: 81667, checkupId: 'CK1', docs: ['Лента ЭКГ', 'Заключение ЭКГ'] },
  { date: '02.06.2026', doneDate: '', name: 'ЭхоКГ (УЗИ сердца)', type: 'Инструментальная', doctor: 'Бакиева М. А.', room: '1-06', time: '05.06.2026 11:00–11:30', addedBy: 'Кадыров Исломбек Х.', status: 'planned', invoice: 'issued', invoiceNo: '№00190', pay: 'paid', qty: 1, price: 240000, discount: 22222, pkgAlloc: 22222, amount: 217778, checkupId: 'CK1', docs: [] },
  { date: '02.06.2026', doneDate: '', name: 'Холтер ЭКГ (суточный мониторинг)', type: 'Инструментальная', doctor: 'Бакиева М. А.', room: '1-06', time: '05.06.2026 · по записи', addedBy: 'Кадыров Исломбек Х.', status: 'planned', invoice: 'issued', invoiceNo: '№00190', pay: 'paid', qty: 1, price: 350000, discount: 32407, pkgAlloc: 32407, amount: 317593, checkupId: 'CK1', docs: [] },
  { date: '02.06.2026', doneDate: '', name: 'Липидограмма', type: 'Лаборатория', doctor: 'Лаборатория', room: 'Лаб.', time: 'забор 08:00–11:00', addedBy: 'Кадыров Исломбек Х.', status: 'planned', invoice: 'issued', invoiceNo: '№00190', pay: 'paid', qty: 1, price: 120000, discount: 11112, pkgAlloc: 11112, amount: 108888, checkupId: 'CK1', docs: [] },
  { date: '01.06.2026', doneDate: '02.06.2026', name: 'Приём (осмотр, консультация) онкопроктолога', type: 'Консультация', doctor: 'Казанцева Н. В.', room: '3-04', time: '02.06.2026 09:00–09:20', addedBy: 'Кадыров Исломбек Х.', status: 'done', invoice: 'issued', invoiceNo: '№00184', pay: 'paid', qty: 1, price: 280000, discount: 0, amount: 280000, checkupId: null, docs: ['Протокол осмотра', 'Заключение'] },
  { date: '04.06.2026', doneDate: '', name: 'УЗИ органов брюшной полости', type: 'Лучевая', doctor: 'Ибрагимов А. К.', room: '2-03', time: '06.06.2026 12:00–12:20', addedBy: 'Дилфуза Ш. (колл-центр)', status: 'planned', invoice: 'draft', invoiceNo: '', pay: 'unpaid', qty: 1, price: 240000, discount: 0, amount: 240000, checkupId: null, docs: [] },
  { date: '20.05.2026', doneDate: '20.05.2026', name: 'Приём (осмотр, консультация) терапевта', type: 'Консультация', doctor: 'Юсупова Д. М.', room: '1-02', time: '20.05.2026 14:00–14:20', addedBy: 'Кадыров Исломбек Х.', status: 'done', invoice: 'issued', invoiceNo: '№00159', pay: 'partial', qty: 1, price: 200000, discount: 0, amount: 200000, checkupId: null, docs: ['Протокол осмотра'] },
  { date: '12.05.2026', doneDate: '', name: 'Консультация невролога', type: 'Консультация', doctor: '—', room: '—', time: '', addedBy: 'Кадыров Исломбек Х.', status: 'cancelled', invoice: 'none', invoiceNo: '', pay: 'unpaid', qty: 1, price: 220000, discount: 0, amount: 220000, checkupId: null, docs: [] },
]

export const CARD_LABS: CardLab[] = [
  { date: '28.05.2026', reqNo: '№ 993210867702', issued: '28.05.2026', panel: 'Общий анализ крови', name: 'Гемоглобин (HGB)', value: '118', unit: 'г/л', min: 120, max: 160, flag: 'low' },
  { date: '28.05.2026', reqNo: '№ 993210867702', issued: '28.05.2026', panel: 'Общий анализ крови', name: 'Эритроциты (RBC)', value: '4.2', unit: '10¹²/л', min: 3.8, max: 5.1, flag: 'ok' },
  { date: '28.05.2026', reqNo: '№ 993210867702', issued: '28.05.2026', panel: 'Общий анализ крови', name: 'Лейкоциты (WBC)', value: '9.8', unit: '10⁹/л', min: 4.0, max: 9.0, flag: 'high' },
  { date: '28.05.2026', reqNo: '№ 993210867702', issued: '28.05.2026', panel: 'Общий анализ крови', name: 'Тромбоциты (PLT)', value: '265', unit: '10⁹/л', min: 150, max: 400, flag: 'ok' },
  { date: '20.05.2026', reqNo: '№ 993210865418', issued: '21.05.2026', panel: 'Биохимия', name: 'Глюкоза', value: '5.4', unit: 'ммоль/л', min: 3.9, max: 6.1, flag: 'ok' },
  { date: '20.05.2026', reqNo: '№ 993210865418', issued: '21.05.2026', panel: 'Биохимия', name: 'АЛТ', value: '42', unit: 'Ед/л', min: 0, max: 41, flag: 'high' },
  { date: '20.05.2026', reqNo: '№ 993210865418', issued: '21.05.2026', panel: 'Биохимия', name: 'Креатинин', value: '78', unit: 'мкмоль/л', min: 62, max: 106, flag: 'ok' },
  { date: '05.05.2026', reqNo: '№ 993210861077', issued: '06.05.2026', panel: 'Гормоны', name: 'ТТГ', value: '2.1', unit: 'мЕд/л', min: 0.4, max: 4.0, flag: 'ok' },
]

export const CARD_INSURANCE: CardInsurance[] = [
  { kind: 'ДМС', company: 'Gross Insurance', policy: 'DMS-2026-44120', valid: 'до 31.12.2026', limit: 15000000, used: 2860000, status: 'active' },
  { kind: 'B2B', company: 'ООО «Artel» (корпоративный договор)', policy: 'B2B-118/2025', valid: 'до 30.06.2026', limit: 5000000, used: 1240000, status: 'active' },
  { kind: 'ОМС', company: '—', policy: '—', valid: '—', limit: 0, used: 0, status: 'none' },
]

export const CARD_RECS: CardRec[] = [
  { name: 'КТ органов грудной клетки', cat: 'Лучевая диагностика', by: 'Казанцева Н. В.', date: '02.06.2026', price: 850000, status: 'open' },
  { name: 'Колоноскопия', cat: 'Эндоскопия', by: 'Казанцева Н. В.', date: '02.06.2026', price: 1200000, status: 'sold' },
  { name: 'Консультация диетолога', cat: 'Консультация', by: 'Юсупова Д. М.', date: '20.05.2026', price: 180000, status: 'open' },
  { name: 'МРТ малого таза', cat: 'Лучевая диагностика', by: 'Казанцева Н. В.', date: '02.06.2026', price: 680000, status: 'cancelled' },
  { name: 'Биохимия крови (расш.)', cat: 'Лаборатория', by: 'Юсупова Д. М.', date: '20.05.2026', price: 210000, status: 'cancelled' },
]

export const CARD_RX: CardRx[] = [
  { name: 'Детралекс 1000 мг', dose: '1 таб × 2 р/день, 7 дней', by: 'Казанцева Н. В.', date: '02.06.2026' },
  { name: 'Натальсид супп.', dose: '1 супп. × 2 р/день, 10 дней', by: 'Казанцева Н. В.', date: '02.06.2026' },
]

export const CARD_CALLS: CardCall[] = [
  { date: '03.06.2026 14:22', dir: 'out', who: 'Колл-центр · Дилфуза Ш.', dur: '2:14', topic: 'Напоминание о визите 04.06', result: 'Дозвонились' },
  { date: '01.06.2026 10:05', dir: 'in', who: 'Пациент', dur: '4:38', topic: 'Запись на приём к онкопроктологу', result: 'Записан' },
  { date: '28.05.2026 17:40', dir: 'out', who: 'Отдел продаж · Хилола А.', dur: '1:02', topic: 'Допродажа: КТ грудной клетки', result: 'Перезвонить' },
  { date: '19.05.2026 09:15', dir: 'out', who: 'Колл-центр · Дилфуза Ш.', dur: '0:00', topic: 'Подтверждение приёма терапевта', result: 'Не дозвонились' },
]

export const CARD_MESSAGES: CardMessage[] = [
  { date: '04.06.2026 09:00', ch: 'sms', dir: 'out', text: 'Напоминание: визит 04.06 в 14:00, онкопроктолог Казанцева Н. В.', status: 'Доставлено' },
  { date: '03.06.2026 18:20', ch: 'telegram', dir: 'out', text: 'Результаты ОАК готовы — доступны в боте клиники.', status: 'Прочитано' },
  { date: '01.06.2026 10:12', ch: 'whatsapp', dir: 'in', text: 'Спасибо, буду вовремя.', status: 'Прочитано' },
  { date: '28.05.2026 12:30', ch: 'sms', dir: 'out', text: 'Рекомендуем записаться на КТ грудной клетки. Звоните: 1142.', status: 'Доставлено' },
]

export const CARD_FAMILY: CardFamily[] = [
  { pid: 'P-25-00922', name: 'Пинхасова Ларина Левовна', rel: 'Мать', sex: 'Ж', age: 52, phone: '+998 50 009 64 87', roles: ['Опекун', 'Контактное лицо', 'Плательщик'] },
  { pid: 'P-19-00488', name: 'Тоиров Алишер Бахтиёрович', rel: 'Отец', sex: 'М', age: 41, phone: '+998 90 700 22 14', roles: ['Контактное лицо'] },
  { pid: 'P-24-01181', name: 'Тоирова Зухра Алишер кизи', rel: 'Сестра', sex: 'Ж', age: 6, phone: '—', roles: ['Несовершеннолетний'] },
]

export const CARD_CASHBACK_PERCENT = 3

export interface CardDemographics { passport: string; pinfl: string; email: string; phone2: string; region: string; district: string; mahalla: string; street: string; address: string; reg: string; nationality: string; lang: string }
export const CARD_DEMOGRAPHICS: CardDemographics = {
  passport: 'AA 1234567', pinfl: '504161730012', email: 'l.pinkhasova@mail.uz', phone2: '+998 71 200 11 22',
  region: 'г. Ташкент', district: 'Чиланзарский', mahalla: 'Чиланзар-7', street: 'ул. Чиланзар, кв. 1/67',
  address: 'г. Ташкент, Чиланзарский р-н, кв. 1/67', reg: '12.03.2025', nationality: 'Еврейка', lang: 'Русский',
}

export interface TagDef { id: string; label: string; tone: 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'muted' }
export const TAG_PALETTE: TagDef[] = [
  { id: 'vip', label: 'VIP', tone: 'brand' },
  { id: 'loyal', label: 'Постоянный пациент', tone: 'ok' },
  { id: 'benefit', label: 'Льготник', tone: 'info' },
  { id: 'attention', label: 'Требует внимания', tone: 'warn' },
  { id: 'conflict', label: 'Конфликтный', tone: 'danger' },
  { id: 'rude', label: 'Грубое поведение', tone: 'danger' },
  { id: 'debtor', label: 'Должник', tone: 'warn' },
  { id: 'nocall', label: 'Не беспокоить звонками', tone: 'muted' },
  { id: 'interpreter', label: 'Нужен переводчик', tone: 'info' },
  { id: 'insurance', label: 'Страховой случай', tone: 'info' },
]
const TAG_BY_ID = Object.fromEntries(TAG_PALETTE.map(t => [t.id, t]))
export function tagInfo(id: string): TagDef {
  return id.startsWith('c:') ? { id, label: id.slice(2), tone: 'muted' } : (TAG_BY_ID[id] ?? { id, label: id, tone: 'muted' })
}
export const MARKS_TAGS_INIT = ['loyal', 'benefit']
export interface CardNote { author: string; date: string; text: string }
export const MARKS_NOTES_INIT: CardNote[] = [
  { author: 'Дилфуза Ш.', date: '04.06.2026 10:20', text: 'Предпочитает связь по WhatsApp, на звонки отвечает неохотно.' },
  { author: 'Исломбек К.', date: '28.05.2026 14:05', text: 'Уточнить срок полиса ДМС при следующем визите — скоро заканчивается.' },
]
export const CUR_REG = 'Исломбек К.'
```
Then `src/services/patientCard.ts`:
```ts
import {
  CARD_SERVICES, CARD_LABS, CARD_INSURANCE, CARD_RECS, CARD_RX, CARD_CALLS, CARD_MESSAGES, CARD_FAMILY,
  CARD_CASHBACK_PERCENT, CARD_DEMOGRAPHICS,
} from '@/data/patientCard'

// Async seam. NOTE: like the prototype, the card detail is singleton demo data
// for whichever patient is opened; per-patient card data arrives with a real backend.
export async function getPatientCard() {
  return {
    services: CARD_SERVICES, labs: CARD_LABS, insurance: CARD_INSURANCE, recs: CARD_RECS, rx: CARD_RX,
    calls: CARD_CALLS, messages: CARD_MESSAGES, family: CARD_FAMILY,
    cashbackPercent: CARD_CASHBACK_PERCENT, demographics: CARD_DEMOGRAPHICS,
  }
}
export type PatientCardData = Awaited<ReturnType<typeof getPatientCard>>
```
(NOTE: the prototype's CARD_SERVICES has 8 visible rows + we add the cancelled «Консультация невролога» from invoice №00150's history as the 9th to carry a cancelled example — it exists in the prototype's invoice data. This keeps all three status chips demonstrable. It's the only intentional augmentation; flag it in the commit body.)

- [ ] **Step 4: Run — PASS**, full `npm run verify` green.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(registration): patient card datasets + service seam (TDD)" -m "9th service row (cancelled) synthesized from prototype invoice №00150 so all statuses render"`

---

### Task 2: Card UI — header, marks modal, tabs, Обзор

**Files (in `src/features/registration/card/`):** `MarksModal.tsx`, `CardHeader.tsx`, `OverviewTab.tsx`, `PatientCardPage.tsx`, `PatientCardPage.test.tsx`. Modify `src/app/router.tsx` (point the card route at the new page) and delete/replace `src/features/registration/RegPatientCardPage.tsx`.

- [ ] **Step 1: `MarksModal.tsx`** (tags palette + custom tags + notes feed; ported):
```tsx
import { useState } from 'react'
import { Flag, Plus, X, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { TAG_PALETTE, tagInfo, CUR_REG, type CardNote } from '@/data/patientCard'
import { initials, avatarColor } from '@/domain/format'

export const TONE_CLS: Record<string, string> = {
  brand: 'bg-primary/10 text-primary', ok: 'bg-ok/10 text-ok', info: 'bg-info/10 text-info',
  warn: 'bg-warn/20 text-foreground', danger: 'bg-destructive/10 text-destructive', muted: 'bg-muted text-muted-foreground',
}

export function MarksModal({ onClose, tags, setTags, notes, setNotes, notify }: {
  onClose: () => void
  tags: string[]; setTags: React.Dispatch<React.SetStateAction<string[]>>
  notes: CardNote[]; setNotes: React.Dispatch<React.SetStateAction<CardNote[]>>
  notify: (m: string, t?: 'ok' | 'warn') => void
}) {
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const toggle = (id: string) => setTags(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]))
  const addCustom = () => { const v = custom.trim(); if (!v) return; const id = `c:${v}`; setTags(t => (t.includes(id) ? t : [...t, id])); setCustom(''); notify('Отметка добавлена') }
  const addNote = () => { const v = note.trim(); if (!v) { notify('Введите текст заметки', 'warn'); return } setNotes(n => [{ author: CUR_REG, date: 'только что', text: v }, ...n]); setNote(''); notify('Заметка добавлена') }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag className="size-4" />Особые отметки и заметки</DialogTitle></DialogHeader>
        <section>
          <div className="text-sm font-medium">Особые отметки (теги)</div>
          <p className="mb-2 text-xs text-muted-foreground">Видны всем сотрудникам в шапке карты пациента.</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && <span className="text-sm text-muted-foreground">Отметок пока нет</span>}
            {tags.map(id => { const t = tagInfo(id); return (
              <span key={id} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', TONE_CLS[t.tone])}>
                {t.label}<button type="button" aria-label={`Убрать ${t.label}`} onClick={() => toggle(id)}><X className="size-3" /></button>
              </span>
            )})}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Быстрый выбор:</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TAG_PALETTE.map(t => (
              <button type="button" key={t.id} onClick={() => toggle(t.id)}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent', tags.includes(t.id) && 'border-primary text-primary')}>
                {tags.includes(t.id) ? <Check className="size-3" /> : <Plus className="size-3" />}{t.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Своя отметка…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} />
            <Button type="button" variant="secondary" onClick={addCustom}><Plus className="size-4" />Добавить</Button>
          </div>
        </section>
        <section>
          <div className="mb-2 text-sm font-medium">Заметки по пациенту</div>
          <div className="flex gap-2">
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Новая заметка о пациенте (предпочтения, договорённости, важное)…" />
            <Button type="button" className="self-end" onClick={addNote}><Plus className="size-4" />Добавить</Button>
          </div>
          <div className="mt-2 space-y-2">
            {notes.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Заметок пока нет</p>}
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border p-2">
                <Avatar className="size-7"><AvatarFallback style={{ background: avatarColor(n.author), color: '#fff' }}>{initials(n.author)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs"><b>{n.author}</b><span className="tabular-nums text-muted-foreground">{n.date}</span>
                    <button type="button" aria-label="Удалить заметку" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setNotes(list => list.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
                  </div>
                  <p className="text-sm">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <DialogFooter><Button onClick={onClose}><Check className="size-4" />Готово</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: `CardHeader.tsx`** (identity row + marks summary + actions + 6-metric strip; ported):
```tsx
import { useState } from 'react'
import { BedDouble, Calendar, Phone, UserRound, FileText, CreditCard, MoreHorizontal, Plus, Flag, TriangleAlert, MessageSquare, Stethoscope, Clock, Star, Wallet } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RegPatient } from '@/domain/registration'
import { regIsInpatient } from '@/domain/registration'
import type { PatientCardData } from '@/services/patientCard'
import { tagInfo, MARKS_TAGS_INIT, MARKS_NOTES_INIT, type CardNote } from '@/data/patientCard'
import { initials, avatarColor, moneyFmt } from '@/domain/format'
import { MarksModal, TONE_CLS } from './MarksModal'

function Metric({ icon, label, value, sub, onClick, valClass }: { icon: React.ReactNode; label: string; value: string; sub?: string; onClick?: () => void; valClass?: string }) {
  return (
    <Card className={cn(onClick && 'cursor-pointer transition-colors hover:bg-accent/50')} onClick={onClick}>
      <CardContent className="flex items-center gap-2.5 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{label}</div>
          <div className={cn('truncate text-sm font-semibold', valClass)}>{value}</div>
          {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export function CardHeader({ patient, card, onTab, notify }: {
  patient: RegPatient; card: PatientCardData; onTab: (k: string) => void; notify: (m: string, t?: 'ok' | 'warn') => void
}) {
  const [tags, setTags] = useState<string[]>(MARKS_TAGS_INIT)
  const [notes, setNotes] = useState<CardNote[]>(MARKS_NOTES_INIT)
  const [marks, setMarks] = useState(false)
  const hasAlert = tags.some(id => tagInfo(id).tone === 'danger')
  const inpat = regIsInpatient(patient)
  const ins = card.insurance.find(i => i.status === 'active')
  const guardian = card.family.find(f => f.roles.includes('Опекун'))
  const isMinor = patient.age < 18
  return (
    <>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar className="size-14"><AvatarFallback style={{ background: avatarColor(patient.name), color: '#fff' }}>{initials(patient.name)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{patient.name}</h1>
              <Badge variant="secondary">Активен</Badge>
              {inpat && patient.inpatient && <Badge variant="outline" className="gap-1" title={`В стационаре: ${patient.inpatient.dept} · с ${patient.inpatient.since} · история ${patient.inpatient.histNo}`}><BedDouble className="size-3" />В стационаре · {patient.inpatient.dept}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{patient.pid}</span>
              <span>{patient.sex === 'М' ? 'Муж.' : 'Жен.'}, {patient.age} лет</span>
              <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{patient.dob}</span>
              <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="size-3.5" />{patient.phone}</span>
              {isMinor && guardian && <button type="button" className="inline-flex items-center gap-1 text-primary" title={`Опекун: ${guardian.name} (${guardian.rel}) · ${guardian.phone}`} onClick={() => notify(`Карта опекуна: ${guardian.name}`)}><UserRound className="size-3.5" />Опекун: {guardian.name.split(' ').slice(0, 2).join(' ')}</button>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" title="Изменить данные" onClick={() => notify('Редактирование данных — в следующем обновлении')}><FileText className="size-4" /></Button>
            <Button variant="outline" size="icon" title="Документ · ID-карта" onClick={() => notify('Документ пациента — в следующем обновлении')}><CreditCard className="size-4" /></Button>
            <Button variant="outline" size="icon" title="Ещё" onClick={() => notify('Меню действий по пациенту')}><MoreHorizontal className="size-4" /></Button>
            <Button disabled={inpat} title={inpat ? 'Пациент в стационаре — амбулаторный визит недоступен' : 'Новый визит'}
              onClick={() => { if (inpat) { notify('Пациент в стационаре — амбулаторный визит недоступен. Назначения ведутся в истории болезни.', 'warn'); return } notify('Запись на услуги — в следующем обновлении') }}>
              <Plus className="size-4" />Новый визит
            </Button>
          </div>
        </div>

        <div className={cn('flex flex-wrap items-center gap-2 rounded-md border p-2', hasAlert && 'border-destructive/40 bg-destructive/5')}>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">{hasAlert ? <TriangleAlert className="size-3.5 text-destructive" /> : <Flag className="size-3.5" />}Отметки</span>
          {tags.length === 0
            ? <span className="text-xs text-muted-foreground">нет особых отметок</span>
            : tags.map(id => { const t = tagInfo(id); return <span key={id} className={cn('rounded-full px-2 py-0.5 text-xs', TONE_CLS[t.tone])}>{t.label}</span> })}
          {notes.length > 0 && (
            <button type="button" onClick={() => setMarks(true)} className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" title="Открыть заметки по пациенту">
              <MessageSquare className="size-3.5 shrink-0" /><span className="truncate">«{notes[0].text}»</span>
              <span className="shrink-0">{notes[0].author} · {notes[0].date}{notes.length > 1 ? ` · ещё ${notes.length - 1}` : ''}</span>
            </button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMarks(true)}><Flag className="size-3.5" />Заметки и отметки{notes.length ? ` · ${notes.length}` : ''}</Button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Metric icon={<CreditCard className="size-4" />} label="Страховка" value={ins ? ins.kind : '—'} sub={ins ? ins.company : 'нет полиса'} onClick={() => onTab('ins')} />
          <Metric icon={<Stethoscope className="size-4" />} label="Лечащий врач" value="Казанцева Н.В." sub="онкопроктолог" />
          <Metric icon={<Clock className="size-4" />} label="Последний визит" value={patient.last || '—'} sub="3 дня назад" onClick={() => onTab('services')} />
          <Metric icon={<TriangleAlert className="size-4" />} label="Аллергии" value="Пенициллин" sub="1 отметка" valClass="text-destructive" />
          <Metric icon={<Star className="size-4" />} label="Кэшбэк" value={`${moneyFmt(patient.cashback)} сум`} sub={`${card.cashbackPercent}% начисление`} onClick={() => onTab('cashback')} />
          <Metric icon={<Wallet className="size-4" />} label="Баланс Кошелька" value={`${patient.balance < 0 ? '−' : ''}${moneyFmt(Math.abs(patient.balance))} сум`} sub={patient.balance > 0 ? 'депозит' : patient.balance < 0 ? 'задолженность' : 'оплачено'} valClass={patient.balance < 0 ? 'text-destructive' : patient.balance > 0 ? 'text-ok' : undefined} onClick={() => onTab('acc')} />
        </div>
      </div>
      {marks && <MarksModal onClose={() => setMarks(false)} tags={tags} setTags={setTags} notes={notes} setNotes={setNotes} notify={notify} />}
    </>
  )
}
```

- [ ] **Step 3: `OverviewTab.tsx`** (contacts / facts / family / timeline; ported):
```tsx
import { TriangleAlert, Plus, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { RegPatient } from '@/domain/registration'
import type { PatientCardData } from '@/services/patientCard'
import { initials, avatarColor, moneyFmt } from '@/domain/format'

export function OverviewTab({ patient, card, notify, onOpenCard }: {
  patient: RegPatient; card: PatientCardData; notify: (m: string, t?: 'ok' | 'warn') => void; onOpenCard: (id: number) => void
}) {
  const dm = card.demographics
  const contacts: [string, string][] = [
    ['Паспорт / ID', dm.passport], ['Адрес', dm.address], ['Телефон', patient.phone],
    ['Доп. телефон', dm.phone2], ['Email', dm.email], ['Дата регистрации', dm.reg],
  ]
  const facts: [string, number][] = [
    ['Всего визитов', patient.visits],
    ['Услуг в истории', card.services.length],
    ['Анализов', card.labs.length],
    ['Открытых рекоменд.', card.recs.filter(r => r.status !== 'sold').length],
    ['Звонков и СМС', card.calls.length + card.messages.length],
    ['Активных полисов', card.insurance.filter(i => i.status === 'active').length],
  ]
  const tl = card.services.slice(0, 6)
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card><CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Контактные и паспортные данные</div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => notify('Редактирование данных — в следующем обновлении')}>Изменить данные</Button>
            <Button variant="ghost" size="sm" onClick={() => notify('Документ пациента — в следующем обновлении')}>Документ</Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {contacts.map(([l, v]) => <div key={l} className="flex gap-3 text-sm"><span className="w-40 shrink-0 text-muted-foreground">{l}</span><span className="min-w-0">{v}</span></div>)}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="mb-3 text-sm font-medium">Сводка</div>
        <div className="grid grid-cols-3 gap-2">
          {facts.map(([l, v]) => <div key={l} className="rounded-md border p-2 text-center"><div className="text-xl font-semibold tabular-nums">{v}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>)}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"><TriangleAlert className="size-4 shrink-0 text-destructive" />Аллергия: пенициллин — учитывать при назначениях.</div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Семья и связанные пациенты <span className="text-muted-foreground">· {card.family.length}</span></div>
          <Button variant="ghost" size="sm" onClick={() => notify('Привязка связанного пациента / опекуна')}><Plus className="size-3.5" />Связать пациента</Button>
        </div>
        <div className="space-y-2">
          {card.family.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md border p-2">
              <Avatar className="size-9"><AvatarFallback style={{ background: avatarColor(f.name), color: '#fff' }}>{initials(f.name)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><b className="truncate text-sm">{f.name}</b><span className="text-xs text-muted-foreground">{f.rel}</span></div>
                <div className="text-xs text-muted-foreground"><span className="tabular-nums">{f.pid}</span> · {f.sex === 'М' ? 'Муж.' : 'Жен.'}, {f.age} лет · <span className="tabular-nums">{f.phone}</span></div>
                {f.roles.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{f.roles.map(r => <span key={r} className={cn('rounded-full bg-muted px-1.5 py-0.5 text-[10px]', r === 'Опекун' && 'bg-info/10 text-info')}>{r}</span>)}</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => notify(`Карта «${f.name}» — открытие связанных карт в следующем обновлении`)}>Открыть<ArrowRight className="size-3.5" /></Button>
            </div>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Лента активности</div>
          <Button variant="ghost" size="sm" onClick={() => notify('Открыта полная история услуг')}>Вся история</Button>
        </div>
        <div className="space-y-2.5">
          {tl.map((s, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2"><b className="truncate text-sm">{s.name}</b><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.date}</span></div>
                <div className="text-xs text-muted-foreground">{s.type} · {s.doctor} · <b className="tabular-nums">{moneyFmt(s.amount)} сум</b></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  )
}
```
(`onOpenCard` is accepted for the future family-navigation wiring; unused for now — prefix with `_` if tsc complains about unused, or use it in place of the notify in the family "Открыть" button when the pid maps to a real base patient: `const real = ...` — DO implement the real-patient check: import `getRegPatients` is overkill here; keep notify, prefix param `_onOpenCard`, and note it.)

- [ ] **Step 4: `PatientCardPage.tsx`** (loads patient + bundle; header + tabs; Обзор live, 12 stubs):
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { RegPatient } from '@/domain/registration'
import { getRegPatient } from '@/services/registration'
import { getPatientCard, type PatientCardData } from '@/services/patientCard'
import { Toast, type ToastMsg } from '@/features/doctor/consultation/Toast'
import { CardHeader } from './CardHeader'
import { OverviewTab } from './OverviewTab'

const TABS: { key: string; label: string }[] = [
  { key: 'overview', label: 'Обзор' }, { key: 'services', label: 'Услуги' }, { key: 'labs', label: 'Лаборатория' },
  { key: 'checkup', label: 'Чек-ап' }, { key: 'ins', label: 'ДМС&B2B' }, { key: 'acc', label: 'Кошелёк' },
  { key: 'invoices', label: 'Счета' }, { key: 'recs', label: 'Рекоменд.' }, { key: 'loyalty', label: 'Лояльность' },
  { key: 'cashback', label: 'Кешбэк' }, { key: 'comms', label: 'Общение' }, { key: 'files', label: 'Файлы' }, { key: 'docs', label: 'Документы' },
]

function TabStub({ label }: { label: string }) {
  return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Вкладка «{label}» — в следующем обновлении.</div>
}

export function PatientCardPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<RegPatient | undefined>()
  const [card, setCard] = useState<PatientCardData | null>(null)
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState<ToastMsg>(null)
  const notify = (msg: string, tone: 'ok' | 'warn' = 'ok') => setToast({ msg, tone })
  useEffect(() => {
    let alive = true
    Promise.all([getRegPatient(Number(patientId)), getPatientCard()]).then(([p, c]) => { if (alive) { setPatient(p); setCard(c) } })
    return () => { alive = false }
  }, [patientId])
  if (!patient || !card) return <div className="p-8 text-sm text-muted-foreground">Пациент не найден.</div>
  return (
    <div className="mx-auto max-w-7xl space-y-3 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/registration')}><ArrowLeft className="size-4" />К базе пациентов</Button>
      <CardHeader patient={patient} card={card} onTab={setTab} notify={notify} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><OverviewTab patient={patient} card={card} notify={notify} onOpenCard={(id) => navigate(`/registration/patient/${id}`)} /></TabsContent>
        {TABS.filter(t => t.key !== 'overview').map(t => (
          <TabsContent key={t.key} value={t.key}><TabStub label={t.label} /></TabsContent>
        ))}
      </Tabs>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
```

- [ ] **Step 5: Router + cleanup** — in `src/app/router.tsx`, change the card route to `{ path: 'registration/patient/:patientId', element: <PatientCardPage /> }` (import from `@/features/registration/card/PatientCardPage`). Delete `src/features/registration/RegPatientCardPage.tsx` (superseded).

- [ ] **Step 6: Smoke test** `PatientCardPage.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { axe } from 'jest-axe'
import { PatientCardPage } from './PatientCardPage'

describe('PatientCardPage (smoke)', () => {
  it('renders header, metric strip, tabs and Обзор with no axe violations', async () => {
    const { container, findByText, getAllByText } = render(
      <MemoryRouter initialEntries={['/registration/patient/195538']}>
        <Routes><Route path="/registration/patient/:patientId" element={<PatientCardPage />} /></Routes>
      </MemoryRouter>
    )
    expect(await findByText('Пинхасова Ларина Левовна')).toBeTruthy()
    expect(await findByText('Баланс Кошелька')).toBeTruthy()
    expect(await findByText('Контактные и паспортные данные')).toBeTruthy()
    expect(getAllByText(/Обзор/).length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(container.querySelectorAll('[role="tab"]').length).toBe(13))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
(Patient 195538 = Пинхасова — has a negative balance so the metric strip shows задолженность.)

- [ ] **Step 7: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): patient card shell (header, marks, metric strip, 13 tabs, Обзор)"`

---

### Task 3: Gate + screenshots
- [ ] `npm run verify && npm run build`; (controller) screenshots: the card top (header + metrics + tabs + Обзор) and the Marks modal open.

---

## Self-Review (plan author)

**Spec coverage:** Slice 3a scope (shell+header+Обзор; Услуги/Лаборатория move to the next plan to keep size consistent): card datasets verbatim (+1 flagged synthesized cancelled row) behind `getPatientCard` with the singleton-demo caveat stated; CardHeader with identity row, inpatient pill + disabled «Новый визит» for inpatients (prototype behaviour), guardian pill for minors, tags/notes summary + full MarksModal (palette/custom/notes CRUD), 6 clickable metric cards routed to tabs; 13-tab strip with Обзор live (contacts, facts computed from data, family with roles, activity timeline) and 12 explicit stubs.

**Placeholder scan:** stubs are named next-slice deferrals (established pattern). The `onOpenCard` note gives an explicit either/or with instruction. No TODOs.

**Type consistency:** `PatientCardData` from the service; `CardService`/`CardLab`/etc. exported types; `TONE_CLS` shared from MarksModal to CardHeader; `tagInfo`/`MARKS_*`/`CUR_REG` from data; `regIsInpatient`/`RegPatient` domain; `moneyFmt/initials/avatarColor` format; Toast reuse as in Plan 16. Tab keys match the metric-strip onTab targets (`ins`/`services`/`cashback`/`acc`).

**Scope:** One coherent screen slice, data TDD'd, page smoke-tested (13 tabs, header, Обзор), visually verified.
