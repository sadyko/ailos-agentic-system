# Aurora Redesign — Plan 18: Patient card — Услуги + Лаборатория tabs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace two card tab stubs with the real thing. **Услуги**: the service-history table (global search, type chips, period filter, sortable columns with per-column filters, row selection, lifecycle chips «Выполнена/Запланирована/Отменена» + invoice/pay chips, cancel-planned action with done-services locked, expandable attached-documents row, print list + Excel export). **Лаборатория**: the results table (sort + filter row incl. panel/flag selects, row selection, flagged values ↓/↑ with reference ranges, per-row trend **Sparkline**, click → **LabTrendModal** with the full SVG chart: reference band, hover crosshair + tooltip, history table, min/avg/max stats) + print of selected results.

**Architecture:** Pure logic TDD'd in `src/domain/labTrend.ts` (`labNum`, `labFlagOf`, `labSeries` — the deterministic 6-point history where the last point equals the current value). Shared card helpers in `src/features/registration/card/`: `serviceStatus.ts` (SRV/INV/PAY chip meta), `printHtml.ts` (open-window HTML print used by both tabs — replaces the prototype's `inpLabResultPrint` dependency; honest simplification, noted), `ServicesTab.tsx`, `LabsTab.tsx` (+ `Sparkline`/`LabTrendModal` inside LabsTab file — they're lab-only). `PatientCardPage` renders the real tabs for `services`/`labs` (stubs removed). Period filter uses two native date inputs (the prototype's custom range-calendar popover is deferred — noted). Chart colors use theme tokens (`var(--color-info)`/`var(--color-destructive)`/`var(--color-ok)` for low/high/ok; the trend line uses the validated `CHART_SEQ`). Ported from `reg-card.jsx:314-520` (ServicesTab), `:522-672` (lab helpers, Sparkline, LabTrendModal), `:813-905+` (LabsTab).

**Tech Stack:** React 19, TS, design-system `Dialog`/`Badge`/`Button`/`Input`/`Checkbox`, lucide-react, SVG, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis (↓/↑/▲/▼ are text glyphs); lucide icons.

---

### Task 1: Lab-trend domain (TDD) + chip meta + print helper

**Files:** `src/domain/labTrend.ts`, `src/domain/labTrend.test.ts`, `src/features/registration/card/serviceStatus.ts`, `src/features/registration/card/printHtml.ts`.

- [ ] **Step 1: Failing tests** `src/domain/labTrend.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { labNum, labFlagOf, labSeries } from './labTrend'
import { CARD_LABS } from '@/data/patientCard'

describe('lab trend', () => {
  it('labNum parses comma decimals', () => {
    expect(labNum('4,2')).toBe(4.2)
    expect(labNum('118')).toBe(118)
    expect(labNum('abc')).toBe(0)
  })
  it('labFlagOf flags against the reference range', () => {
    const hgb = CARD_LABS[0] // Гемоглобин 120–160
    expect(labFlagOf(hgb, 118)).toBe('low')
    expect(labFlagOf(hgb, 140)).toBe('ok')
    expect(labFlagOf(hgb, 170)).toBe('high')
  })
  it('labSeries is deterministic, 6 points, last equals the current value', () => {
    const hgb = CARD_LABS[0]
    const a = labSeries(hgb); const b = labSeries(hgb)
    expect(a).toHaveLength(6)
    expect(a[5].value).toBe(labNum(hgb.value))
    expect(a).toEqual(b)
    expect(a.every(p => /^\d{2}\.\d{2}\.\d{4}$/.test(p.date))).toBe(true)
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- labTrend`, then implement `src/domain/labTrend.ts` (ported verbatim from `reg-card.jsx:524-547`):
```ts
import type { CardLab } from '@/data/patientCard'

export interface LabPoint { date: string; value: number }

export function labNum(v: string): number {
  return parseFloat(String(v).replace(',', '.')) || 0
}

export function labFlagOf(lab: Pick<CardLab, 'min' | 'max'>, v: number): 'low' | 'high' | 'ok' {
  return v < lab.min ? 'low' : v > lab.max ? 'high' : 'ok'
}

// deterministic 6-point demo history ending at the current value (seeded by the analyte name)
export function labSeries(lab: CardLab): LabPoint[] {
  const s = String(lab.value)
  const cur = labNum(s)
  const dec = s.indexOf('.') >= 0 ? Math.min((s.split('.')[1] || '').length, 2) : 0
  const r = Math.pow(10, dec)
  const span = (lab.max - lab.min) || Math.abs(cur) * 0.5 || 1
  let seed = 9
  for (let i = 0; i < lab.name.length; i++) seed = (seed * 31 + lab.name.charCodeAt(i)) >>> 0
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return ((seed >>> 16) & 0xffff) / 65536 }
  const p = String(lab.date).split('.'); const dd = +p[0], mm = +p[1], yy = +p[2]
  const N = 6, pts: LabPoint[] = []
  for (let i = 0; i < N; i++) {
    const back = N - 1 - i
    const d = new Date(yy || 2026, (mm || 1) - 1 - back, dd || 1)
    const dstr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
    let v = i === N - 1 ? cur : cur + (rnd() - 0.5) * span * 0.7
    if (cur >= 0 && v < 0) v = Math.abs(v) * 0.4
    v = Math.round(v * r) / r
    pts.push({ date: dstr, value: v })
  }
  return pts
}
```

- [ ] **Step 3: Run — PASS.** Then `src/features/registration/card/serviceStatus.ts`:
```ts
export const SRV_STATUS: Record<string, [string, string]> = { done: ['ok', 'Выполнена'], planned: ['queue', 'Запланирована'], cancelled: ['muted', 'Отменена'] }
export const INV_STATUS: Record<string, [string, string]> = { issued: ['ok', 'Выставлен'], draft: ['warn', 'Черновик'], none: ['muted', 'Нет счёта'] }
export const PAY_STATUS: Record<string, [string, string]> = { paid: ['ok', 'Оплачено'], partial: ['warn', 'Частично'], unpaid: ['muted', 'Не оплачено'] }
export const CHIP_TONE: Record<string, string> = {
  ok: 'bg-ok/10 text-ok', queue: 'bg-info/10 text-info', warn: 'bg-warn/20 text-foreground', muted: 'bg-muted text-muted-foreground',
}
```
And `src/features/registration/card/printHtml.ts` (shared open-window print used by both tabs; simplification of the prototype's per-tab print documents — same visual outcome):
```ts
// Opens a print window with a simple branded table document (replaces prototype print generators).
export function printHtml(title: string, subtitle: string, tableHtml: string, notify: (m: string, t?: 'ok' | 'warn') => void): void {
  const css = `*{box-sizing:border-box;font-family:Arial,system-ui,sans-serif}body{margin:24px;color:#1c2531}h1{font-size:18px;margin:0 0 2px}
.sub{color:#5a6b82;font-size:12px;margin-bottom:14px}table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #cdd6e4;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eef3fb;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;color:#14508c}
td.c{text-align:center;color:#5a6b82;width:30px}td.r{text-align:right;white-space:nowrap}td.nm{font-weight:600}td.nw{white-space:nowrap}tfoot td{font-weight:700;background:#f6f8fc}
@media print{body{margin:0}}`
  const doc = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body><h1>${title}</h1><div class="sub">${subtitle}</div>${tableHtml}</body></html>`
  const w = window.open('', '_blank')
  if (!w) { notify('Разрешите всплывающие окна для печати', 'warn'); return }
  w.document.write(doc); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch { /* */ } }, 350)
}

export const escHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
```

- [ ] **Step 4:** `npm run verify` green. Commit: `git add -A && git commit -m "feat(registration): lab-trend domain (TDD) + card chip meta + shared print helper"`

---

### Task 2: ServicesTab

**Files:** `src/features/registration/card/ServicesTab.tsx`, wire in `PatientCardPage.tsx` (replace the `services` stub with `<ServicesTab patient={patient} card={card} notify={notify} />`), extend `PatientCardPage.test.tsx`.

- [ ] **Step 1: `ServicesTab.tsx`** — port of `reg-card.jsx:314-520`. Structure (write COMPLETE code; key requirements):
  - Local state: `rows` seeded once from `card.services` with `_id` index (so cancel mutates local state); search `q`; type chip filter (unique types + "Все"); period `fromISO/toISO` (two `<input type="date">`; filter compares via `dateKey(dmy)` after converting the ISO inputs with a small `isoToKey` = `Number(iso.replaceAll('-',''))`); per-column filter object `colF` (date/name/doctor/type/checkup/status/doneDate/invoice/pay/amount); sort `sortKey/sortDir` with the prototype's `sval` mapping (status order done<planned<cancelled); selection `sel` map + select-all; `open` row id for the docs expander.
  - Chips: `Chip({tone,label})` span using `CHIP_TONE` + a small dot; status via `SRV_STATUS`, invoice shows `invoiceNo` when issued else `INV_STATUS`, pay via `PAY_STATUS`. Чек-ап column: services with `checkupId` show a badge «Сердце под контролем» (short name), else «—».
  - Header cells: sort button (label + ▲/▼/↕ glyph) over a small filter `<Input>` (aria-label per column, e.g. `aria-label="Фильтр: Услуга"`).
  - Actions column: planned → «Отменить» button (`setRows` → status cancelled + notify warn «Запланированная услуга отменена»); done → locked label «Оказана» with the prototype's title (нельзя отменить — начислена врачу); cancelled → muted «Отменена».
  - Docs column: paperclip-count button (disabled when 0) toggling an expander row listing `docs` as pill-buttons (`notify('Документ «X» скачивается')`).
  - Toolbar: search input; type chips; Период (two date inputs + clear); right: «Распечатать (N)/список» via `printHtml('Список услуг', ...)` building the same table as the prototype (`#, Дата, Услуга, Врач, Тип, Статус, Выполнено, Сумма` + Итого row; selected rows or all filtered); «Выгрузить в Excel» via the prototype's Blob `.xls` approach (columns as in `exportExcel`; use `escHtml`) + notify.
  - Empty state row «Ничего не найдено по фильтру». Amounts via `moneyFmt`.

- [ ] **Step 2: Wire** — in `PatientCardPage.tsx`: `import { ServicesTab } from './ServicesTab'`; replace `<TabStub label="Услуги" />` usage by special-casing `services` in the tab render (keep the generic stub map for the rest):
```tsx
<TabsContent value="services"><ServicesTab card={card} patient={patient} notify={notify} /></TabsContent>
```
(and exclude `services` from the stub-mapped list.)

- [ ] **Step 3: Extend the page smoke test** — add a test that switches to Услуги and sees the table:
```tsx
import { fireEvent } from '@testing-library/react'
it('Услуги tab shows the service history table', async () => {
  const { findByText, getByRole, findAllByText } = render(
    <MemoryRouter initialEntries={['/registration/patient/195538']}>
      <Routes><Route path="/registration/patient/:patientId" element={<PatientCardPage />} /></Routes>
    </MemoryRouter>
  )
  await findByText('Баланс Кошелька')
  fireEvent.click(getByRole('tab', { name: 'Услуги' }))
  expect(await findByText('ЭКГ с расшифровкой')).toBeTruthy()
  expect((await findAllByText('Запланирована')).length).toBeGreaterThan(1)
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): card Услуги tab (filters, sort, chips, cancel, docs, print/export)"`

---

### Task 3: LabsTab + Sparkline + LabTrendModal

**Files:** `src/features/registration/card/LabsTab.tsx` (contains `Sparkline` + `LabTrendModal`), wire in `PatientCardPage.tsx`, extend the page test.

- [ ] **Step 1: `LabsTab.tsx`** — port of `reg-card.jsx:549-672 + 813-905`. Requirements (write COMPLETE code):
  - `FLAG_COLOR = { low: 'var(--color-info)', high: 'var(--color-destructive)', ok: 'var(--color-ok)' }`; flag arrows ↓/↑/✓ per prototype (`flagMeta`).
  - Table: select-all + row checkboxes; sortable headers (Дата забора, Панель, Показатель, Номер заявки, Дата выдачи, Результат, Референс — `sval` per prototype incl. numeric value sort); a filter row (date input, panel `<select>` over unique panels, name search, reqNo, issued, flag `<select>` Все/Норма/Повышен/Понижен) — native selects with aria-labels are fine.
  - Rows: date, panel, name (bold), reqNo, issued; **Динамика** cell renders `<button>` wrapping `<Sparkline series={labSeries(l)} color={FLAG_COLOR[l.flag]} />` opening the trend modal (title «Открыть динамику показателя»); Результат colored by flag with the arrow + unit; Референс `min – max`.
  - `Sparkline`: the 208×36 polyline + last-point dot (verbatim port, `stroke={color}`).
  - `LabTrendModal`: design-system Dialog (wide `max-w-4xl`); left = history table (reversed series, hover sets the highlighted index, flagged colored values); right = summary (big last value colored + badge понижен/повышен/в норме + delta ↑/↓) + stats (Мин/Среднее/Макс/Замеров) + the 660×348 SVG: 5 gridlines, green reference band (`fill="var(--color-ok)" fillOpacity="0.12"` + dashed band edges), area gradient under the line (defs linearGradient with `CHART_SEQ`), polyline `stroke` = `CHART_SEQ` (import from `@/data/dashboard`), per-point circles colored by flag with big invisible hover targets, hover vertical line + a floating tooltip (date, colored value+unit, flag word) positioned as in the prototype. Footer: «История результатов пациента в клинике» + Закрыть.
  - Print button: «Печать результата (N)» disabled when none selected → group chosen rows by panel and `printHtml('Результаты лабораторных исследований', ...)` with a table `Показатель, Результат, Ед., Референс` per panel section (h-style row) + notify.

- [ ] **Step 2: Wire** — special-case `labs` in `PatientCardPage.tsx`: `<TabsContent value="labs"><LabsTab patient={patient} card={card} notify={notify} /></TabsContent>` (exclude from stubs).

- [ ] **Step 3: Extend the page test**:
```tsx
it('Лаборатория tab shows flagged results with sparklines', async () => {
  const { findByText, getByRole, container } = render(
    <MemoryRouter initialEntries={['/registration/patient/195538']}>
      <Routes><Route path="/registration/patient/:patientId" element={<PatientCardPage />} /></Routes>
    </MemoryRouter>
  )
  await findByText('Баланс Кошелька')
  fireEvent.click(getByRole('tab', { name: 'Лаборатория' }))
  expect(await findByText('Гемоглобин (HGB)')).toBeTruthy()
  await waitFor(() => expect(container.querySelectorAll('svg.lab-spark').length).toBeGreaterThan(3))
})
```
(Give the Sparkline svg `className="lab-spark"`.)

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green (axe on the page test still passes; ensure filter inputs/selects and icon buttons carry aria-labels). Commit: `git add -A && git commit -m "feat(registration): card Лаборатория tab (flags, sparklines, trend modal, print)"`

---

### Task 4: Gate + screenshots
- [ ] `npm run verify && npm run build`; (controller) screenshots: Услуги tab (chips/filters/docs row) and the LabTrendModal open.

---

## Self-Review (plan author)

**Spec coverage:** Slice 3b: both heavy card tabs ported — services (all prototype behaviours: search/type/period/per-column filters, 10-column sort, selection, lifecycle+invoice+pay chips, checkup badge, cancel-planned with done-locked, docs expander, print + Excel export) and labs (sort + filter row, flagged results with reference ranges, deterministic trend series TDD'd, per-row sparkline, full trend modal with reference band/hover/stats, grouped print). Simplifications noted: shared `printHtml` window-print replaces prototype print generators; native date inputs replace the custom range calendar (defer); trend chart uses theme tokens + validated `CHART_SEQ`.

**Placeholder scan:** Tasks 2–3 specify complete behaviour lists with the prototype line references and all data/domain/status maps already in place (Plan 17 data + Task 1 here); the implementer writes the components against those exact requirements — every column, chip, action, and modal element enumerated. No TBDs.

**Type consistency:** `CardService`/`CardLab` from `@/data/patientCard`; `labNum/labFlagOf/labSeries` domain (TDD); `SRV/INV/PAY_STATUS` + `CHIP_TONE` shared; `printHtml/escHtml` shared; `dateKey` reused for dmy sorting; `moneyFmt` for amounts; `CHART_SEQ` from `@/data/dashboard`; tabs keyed `services`/`labs` matching the Plan-17 registry and the metric-strip `onTab('services')` target.

**Scope:** Two tabs, one slice; domain TDD'd, page tests extended (tab switching + content), visually verified.
