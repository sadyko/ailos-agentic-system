# Aurora Redesign — Plan 19: Patient card — Счета, Кошелёк, ДМС&B2B

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace three more card-tab stubs. **ДМС&B2B**: insurance policy cards (kind badge, policy/validity, used-limit progress bar, guarantee-letter action; unbound ОМС slot with «Привязать полис»). **Кошелёк**: wallet ledger (Поступления/Списания/Баланс summary cards that filter on click, the «Сверка» reconciliation line with an auto opening balance, period filter, sortable+filterable table with Приход/Расход chips and signed colored amounts, print + Excel). **Счета**: the invoices table (11 sortable+filterable columns of money math, status/pay chips, row → **InvoiceModal** with the items table + totals cascade — gross → скидка → после скидки → покрытие → оплачено → остаток — and cancellation warnings) + **RegInvCancelModal** (audit reason buttons + comment; marks the invoice cancelled — done-item invoices are uncancellable because the services are accrued to the doctor).

**Architecture:** `src/domain/invoiceMath.ts` — the pure invoice money math (`invGross/invDiscAmt/invAfter/invCov/invCash/invPaid/invDue/invDiscLabel`, TDD; cancelled invoices zero out). `src/data/patientCard.ts` gains `CARD_INVOICES` (6, verbatim) + `CARD_LEDGER` (7, verbatim) with types; `getPatientCard()` bundles them. Tabs in `src/features/registration/card/`: `InsuranceTab.tsx`, `AccountTab.tsx`, `InvoicesTab.tsx` (with `InvoiceModal` + `RegInvCancelModal` in-file). Invoices state lives in `InvoicesTab` (local, seeded from data; cancel updates it). Print via the shared `printHtml` (the prototype's `invoicePrint`/`accPrint` generators are simplified to it — noted). Ported from `reg-card2.jsx:4-171` (Insurance/Account), `:796-1002` (invoice chips/helpers/modals/tab), `reg-data.jsx:46-62,118-126` (data).

**Tech Stack:** React 19, TS, design-system `Dialog`/`Card`/`Button`/`Input`/`Textarea`/`Badge`, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis (▲/▼/↕/−/+ are glyphs); lucide icons.

---

### Task 1: Invoice/ledger data + invoice math (TDD)

**Files:** `src/data/patientCard.ts` (extend), `src/domain/invoiceMath.ts`, `src/domain/invoiceMath.test.ts`, `src/services/patientCard.ts` (extend), `src/services/patientCard.test.ts` (extend).

- [ ] **Step 1: Extend `src/data/patientCard.ts`** — append types + data (verbatim from `reg-data.jsx:46-62,118-126`):
```ts
export type InvDiscount = { type: 'none' } | { type: 'fix'; amount: number } | { type: 'list'; name: string; amount: number } | { type: 'pct'; pct: number }
export interface InvoiceItem { name: string; doctor: string; sdate: string; qty: number; price: number; status: 'done' | 'planned' | 'cancelled' | 'returned' }
export interface CardInvoice {
  no: string; date: string; state: 'issued' | 'draft' | 'cancelled'; pay: 'paid' | 'partial' | 'unpaid'
  disc: InvDiscount; paid?: number; cov?: { payer: string; amount: number }; items: InvoiceItem[]
  cancelReason?: string; cancelComment?: string
}
export interface LedgerRow { date: string; type: 'in' | 'out'; doc: string; amount: number; note: string }

export const CARD_INVOICES: CardInvoice[] = [
  { no: '№00190', date: '04.06.2026', state: 'issued', pay: 'unpaid', disc: { type: 'none' },
    items: [ { name: 'УЗИ органов брюшной полости', doctor: 'Ибрагимов А. К.', sdate: '', qty: 1, price: 240000, status: 'planned' },
             { name: 'Консультация кардиолога', doctor: 'Бакиева М. А.', sdate: '', qty: 1, price: 280000, status: 'planned' } ] },
  { no: '№00191', date: '04.06.2026', state: 'draft', pay: 'unpaid', disc: { type: 'list', name: 'Сотрудник', amount: 18000 },
    items: [ { name: 'Консультация диетолога', doctor: 'Юсупова Д. М.', sdate: '', qty: 1, price: 180000, status: 'planned' } ] },
  { no: '№00184', date: '02.06.2026', state: 'issued', pay: 'paid', disc: { type: 'pct', pct: 7 }, cov: { payer: 'ДМС · Gross Insurance', amount: 372000 },
    items: [ { name: 'Приём (осмотр, консультация) онкопроктолога', doctor: 'Казанцева Н. В.', sdate: '02.06.2026', qty: 1, price: 280000, status: 'done' },
             { name: 'Аноскопия', doctor: 'Казанцева Н. В.', sdate: '02.06.2026', qty: 1, price: 120000, status: 'done' } ] },
  { no: '№00171', date: '27.05.2026', state: 'issued', pay: 'paid', disc: { type: 'fix', amount: 75000 }, cov: { payer: 'B2B · ООО «Artel»', amount: 700000 },
    items: [ { name: 'МРТ малого таза', doctor: 'Ибрагимов А. К.', sdate: '28.05.2026', qty: 1, price: 680000, status: 'done' },
             { name: 'Общий анализ крови', doctor: 'Лаборатория', sdate: '28.05.2026', qty: 1, price: 95000, status: 'done' } ] },
  { no: '№00159', date: '20.05.2026', state: 'issued', pay: 'partial', paid: 120000, disc: { type: 'none' },
    items: [ { name: 'Приём (осмотр, консультация) терапевта', doctor: 'Юсупова Д. М.', sdate: '20.05.2026', qty: 1, price: 200000, status: 'done' } ] },
  { no: '№00150', date: '12.05.2026', state: 'cancelled', pay: 'unpaid', disc: { type: 'none' },
    items: [ { name: 'Консультация невролога', doctor: '—', sdate: '', qty: 1, price: 220000, status: 'cancelled' } ] },
]

export const CARD_LEDGER: LedgerRow[] = [
  { date: '02.06.2026', type: 'in', doc: 'Пополнение счёта · Карта', amount: 400000, note: 'Оплата картой Uzcard' },
  { date: '02.06.2026', type: 'out', doc: 'Счёт №00184 · Приём онкопроктолога', amount: 280000, note: '' },
  { date: '02.06.2026', type: 'out', doc: 'Счёт №00185 · Аноскопия', amount: 120000, note: '' },
  { date: '28.05.2026', type: 'in', doc: 'Пополнение счёта · Наличные', amount: 780000, note: '' },
  { date: '28.05.2026', type: 'out', doc: 'Счёт №00171 · МРТ малого таза', amount: 680000, note: '' },
  { date: '28.05.2026', type: 'out', doc: 'Счёт №00172 · Общий анализ крови', amount: 95000, note: '' },
  { date: '20.05.2026', type: 'in', doc: 'Пополнение счёта · Карта', amount: 100000, note: 'Частичная оплата' },
]
```

- [ ] **Step 2: Failing math tests** `src/domain/invoiceMath.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { invGross, invDiscAmt, invAfter, invCov, invCash, invPaid, invDue, invDiscLabel } from './invoiceMath'
import { CARD_INVOICES } from '@/data/patientCard'

const by = (no: string) => CARD_INVOICES.find(i => i.no === no)!

describe('invoice math', () => {
  it('№00184: pct discount, full DMS coverage → paid in full, no due', () => {
    const iv = by('№00184')
    expect(invGross(iv)).toBe(400000)
    expect(invDiscAmt(iv)).toBe(28000)     // 7% of 400 000
    expect(invAfter(iv)).toBe(372000)
    expect(invCov(iv)).toBe(372000)        // clamped to after-discount
    expect(invCash(iv)).toBe(0)
    expect(invPaid(iv)).toBe(372000)
    expect(invDue(iv)).toBe(0)
    expect(invDiscLabel(iv)).toBe('7%')
  })
  it('№00159: partial payment leaves a due', () => {
    const iv = by('№00159')
    expect(invAfter(iv)).toBe(200000)
    expect(invPaid(iv)).toBe(120000)
    expect(invDue(iv)).toBe(80000)
    expect(invDiscLabel(iv)).toBe('—')
  })
  it('№00191: list discount label + amount', () => {
    const iv = by('№00191')
    expect(invDiscAmt(iv)).toBe(18000)
    expect(invDiscLabel(iv)).toBe('Сотрудник')
    expect(invDue(iv)).toBe(162000)
  })
  it('№00171: fix discount label', () => {
    expect(invDiscLabel(by('№00171'))).toBe('Фикс.')
    expect(invDue(by('№00171'))).toBe(0)
  })
  it('cancelled invoice zeroes coverage/paid/due', () => {
    const iv = by('№00150')
    expect(invCov(iv)).toBe(0); expect(invCash(iv)).toBe(0); expect(invPaid(iv)).toBe(0); expect(invDue(iv)).toBe(0)
  })
})
```

- [ ] **Step 3: Run — FAIL**, then implement `src/domain/invoiceMath.ts` (verbatim port of `reg-card2.jsx:866-875`):
```ts
import type { CardInvoice } from '@/data/patientCard'

export const invGross = (iv: CardInvoice): number => iv.items.reduce((a, it) => a + it.qty * it.price, 0)
export const invDiscAmt = (iv: CardInvoice): number => {
  const d = iv.disc ?? { type: 'none' as const }
  if (d.type === 'pct') return Math.round(invGross(iv) * (d.pct || 0) / 100)
  return 'amount' in d ? d.amount || 0 : 0
}
export const invAfter = (iv: CardInvoice): number => Math.max(0, invGross(iv) - invDiscAmt(iv))
export const invCov = (iv: CardInvoice): number => (iv.state === 'cancelled' ? 0 : Math.min(invAfter(iv), iv.cov?.amount ?? 0))
export const invCash = (iv: CardInvoice): number => (iv.state === 'cancelled' ? 0 : iv.pay === 'paid' ? Math.max(0, invAfter(iv) - invCov(iv)) : (iv.paid ?? 0))
export const invPaid = (iv: CardInvoice): number => (iv.state === 'cancelled' ? 0 : Math.min(invAfter(iv), invCov(iv) + invCash(iv)))
export const invDue = (iv: CardInvoice): number => (iv.state === 'cancelled' ? 0 : Math.max(0, invAfter(iv) - invPaid(iv)))
export const invDiscLabel = (iv: CardInvoice): string => {
  const d = iv.disc
  if (!d || d.type === 'none' || !invDiscAmt(iv)) return '—'
  if (d.type === 'fix') return 'Фикс.'
  if (d.type === 'list') return d.name || 'Из списка'
  if (d.type === 'pct') return `${d.pct || 0}%`
  return '—'
}
export const INV_CANCEL_REASONS = ['Ошибка в счёте', 'Изменение состава услуг', 'Дубликат счёта', 'Смена плательщика / покрытия', 'Возврат / отказ пациента']
```

- [ ] **Step 4: Run — PASS.** Extend `src/services/patientCard.ts` bundle with `invoices: CARD_INVOICES, ledger: CARD_LEDGER` (+imports) and extend the existing service test: `expect(c.invoices).toHaveLength(6)` / `expect(c.ledger).toHaveLength(7)` in the bundle test.
- [ ] **Step 5:** `npm run verify` green. Commit: `git add -A && git commit -m "feat(registration): invoice/ledger data + invoice money math (TDD)"`

---

### Task 2: InsuranceTab + AccountTab

**Files:** `src/features/registration/card/InsuranceTab.tsx`, `AccountTab.tsx`; wire both in `PatientCardPage.tsx` (`ins`, `acc`); extend the page test.

- [ ] **Step 1: `InsuranceTab.tsx`** (port `reg-card2.jsx:4-43`): a responsive grid of policy cards. Per policy: kind badge (ДМС=info tint, B2B=destructive tint, ОМС=muted), «Активен» chip, company, rows «Полис №»/«Действует», «Использовано лимита X / Y сум» + a progress bar (width = used/limit %, bar color = badge accent via inline style on a rounded track), footer «Гарантийное письмо» (notify «Гарантийное письмо сформировано») + a dots menu (notify). `status==='none'` renders the empty card: badge, «Полис не привязан», «Привязать полис» ghost button (notify). Props `{ card, notify }`.

- [ ] **Step 2: `AccountTab.tsx`** (port `reg-card2.jsx:67-171`): props `{ patient, card, notify }`.
  - Totals: `totalIn/totalOut` from `card.ledger`; `balance = patient.balance`; `opening = balance - (totalIn - totalOut)`.
  - Three summary cards: Поступления (+X, ok) and Списания (−Y, destructive) are BUTTONS toggling a `flow` filter (all/in/out; active ring/border), third card = Депозит на счету / Задолженность with signed colored balance.
  - «Сверка» line: `входящий остаток ±X + поступления +A − списания −B = баланс ±C` (opening term hidden when 0), plus right-aligned: period (two native date inputs с/по + clear), «Печать» → `printHtml('Кошелёк пациента — {name}', 'Сеть клиник Medion · строк: N', tableHtml, notify)`, «Excel» → the Blob `.xls` pattern (filename `Кошелёк_пациента.xls`) + notify («Экспортировано строк: N»). Table HTML: Дата/Операция/Тип/Сумма with +/− amounts (use `escHtml`).
  - Flow-note banner when filtered («Показаны только поступления/списания · N» + «Показать все»).
  - Table: sortable Дата (no filter) / Операция / Тип / Сумма headers (▲/▼/↕ + filter inputs with aria-labels; amount sort = signed value); rows: date tabular; doc bold + muted note; type chip (Приход ok / Расход warn-tinted with icons Download/CreditCard); amount bold colored `+`/`−` + `moneyFmt`. Period filter via `dateKey`. Empty state «Нет операций по выбранному фильтру».

- [ ] **Step 3: Wire** both in `PatientCardPage.tsx` (`<TabsContent value="ins"><InsuranceTab card={card} notify={notify} /></TabsContent>`, `acc` likewise with patient; exclude from stubs). Extend the page test: switch to Кошелёк (mouseDown+click) → `findByText('Пополнение счёта · Карта')`; switch to ДМС&B2B → `findByText('Gross Insurance')`.

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): card ДМС&B2B + Кошелёк tabs (policies, ledger, сверка, print/export)"`

---

### Task 3: InvoicesTab + InvoiceModal + RegInvCancelModal

**Files:** `src/features/registration/card/InvoicesTab.tsx` (all three components in-file); wire in `PatientCardPage.tsx` (`invoices`); extend the page test.

- [ ] **Step 1: chips + helpers** (in-file): `INV_STATE = { issued:['queue','Выставлен'], draft:['warn','Черновик'], cancelled:['muted','Отменён'] }`, `INV_PAY = { paid:['ok','Оплачен'], partial:['warn','Частично'], unpaid:['bad','Не оплачен'] }` (add `bad: 'bg-destructive/10 text-destructive'` to the local tone map, reusing `CHIP_TONE` for the rest), `INV_ITEM` per prototype; `InvChip` (cancelled → muted «—»).

- [ ] **Step 2: `InvoicesTab`** (port `reg-card2.jsx:909-1002`): local `list` state seeded from `card.invoices`. Summary cards: «Выставлено · N» (active count, `invAfter` sum), «Оплачено» (ok, `invPaid` sum), «К оплате» (destructive when >0, `invDue` sum) — active = non-cancelled. Table (horizontal scroll ok): sortable+filterable columns № счёта / Дата / Позиций / Сумма счёта / Скидка / Сумма скидки / Сумма после скидки / Оплачено / Остаток к оплате / Статус / Оплата + eye button + cancel button. Column filters match the DISPLAYED text (via a `colText` map like the prototype). Sorting per `sval` (dates via `dateKey`, money numeric). Row: bold «Счёт №…» (+ muted cancelReason line when cancelled), discount chip or «—», −discount colored, paid green/muted, due red bold or «—» for cancelled, state/pay chips; row click opens the modal; cancel button disabled (with the accrual title) when any item is `done`, hidden when already cancelled. `canCancel(iv) = iv.state!=='cancelled' && !iv.items.some(it => it.status==='done')`. Cancel applies `{state:'cancelled', cancelReason, cancelComment}` + warn notify «Счёт №… отменён».

- [ ] **Step 3: `InvoiceModal`** (port `:802-864`): design-system Dialog `max-w-3xl`. Header: «Счёт-фактура №…» + «от {date}» + state/pay chips. Patient strip (avatar, name, pid · phone, coverage chip). «Состав счёта · N» items table (Услуга/Врач/Дата услуги/Кол-во/Цена/Сумма/Статус услуги with `INV_ITEM` chips). Totals cascade rows: Сумма счёта; Скидка · label (−X, when >0); Сумма после скидки; Покрытие · payer (−X, when >0); «Оплачено (пациентом)» ; Остаток к оплате (red-bold when due>0 and not cancelled, «—» when cancelled). Warnings: uncancellable notice (verbatim) when `!canCancel && !cancelled`; cancelled banner with reason. Footer: «Отменить счёт» destructive (disabled per canCancel; opens the cancel modal via `onCancel`), «Закрыть», «Печать» → `printHtml('Счёт-фактура ' + iv.no, patientSubtitle, itemsTableHtml + totalsTableHtml, notify)` (simplification of `invoicePrint` — noted).

- [ ] **Step 4: `RegInvCancelModal`** (port `:879-907`): Dialog; target line «Счёт №… от … · X сум»; audit hint (verbatim, + the refund warning when `invPaid(iv) > 0`); reason toggle-buttons from `INV_CANCEL_REASONS`; comment Textarea; confirm disabled until a reason or comment; «Отменить счёт» destructive → `onConfirm({reason: reason || 'Без указания причины', comment})`; «Нет, оставить».

- [ ] **Step 5: Wire** `invoices` in `PatientCardPage.tsx`; extend the page test: switch to Счета → `findByText('Счёт №00184')` and `findAllByText('Оплачен')` non-empty.

- [ ] **Step 6: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): card Счета tab (invoice math table, detail modal, audited cancel)"`

---

### Task 4: Gate + screenshots
- [ ] `npm run verify && npm run build`; (controller) screenshots: Счета table, the InvoiceModal (№00184 with discount + coverage cascade), Кошелёк with сверка, ДМС&B2B cards.

---

## Self-Review (plan author)

**Spec coverage:** Slice 3c-finance: all three financial tabs ported with their full behaviours — insurance limit bars + empty-slot bind, wallet ledger with click-to-filter summary cards + reconciliation line + period + print/export, invoices with the complete money cascade (pure math TDD'd against hand-computed fixtures incl. pct rounding, coverage clamping, partial pay, cancelled zeroing), detail modal, and audited cancellation honoring the "done services are accrued" business rule. Print simplifications via shared `printHtml` noted (invoicePrint/accPrint generators).

**Placeholder scan:** Task 1 fully verbatim; Tasks 2–3 are complete behaviour enumerations with prototype line refs and all helpers/data/types defined in Task 1 or in-file — the established Plan-18 working mode. No TBDs.

**Type consistency:** `CardInvoice/InvoiceItem/InvDiscount/LedgerRow` in data; `invoiceMath` consumes `CardInvoice`; bundle extends `PatientCardData` (existing tests extended, not broken — lengths asserted); `CHIP_TONE` reused + local `bad` tone; `dateKey`/`moneyFmt`/`printHtml`/`escHtml` reused; tab keys `ins`/`acc`/`invoices` match the Plan-17 registry and metric-strip targets.

**Scope:** Three tabs, one slice; money math unit-tested, tabs page-tested, visually verified.
