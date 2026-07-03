# Aurora Redesign — Plan 14: Doctor dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Build the worklist's "Дашборд" tab (currently a stub): KPI row (4 stat tiles with trend), doctor rail (ratings, review score, latest reviews), two revenue tables with totals, care-gaps worklist, and the analytics grid (efficiency, diagnosis mix, age chart, review trend, recommendations report, patient sources). Ported from prototype `dashboard.jsx` (L1–495).

**Architecture:** `src/data/dashboard.ts` (typed mock, verbatim numbers) behind `src/services/dashboard.ts` (`getDashboard()`, async seam). Components in `src/features/doctor/dashboard/`: `KpiCard`, `RevenueTable`, `DoctorRail` (rating+stars+reviews), `CareGaps`, `EfficiencyCard`, `DiagnosisMix`, `AgeChart`, `ReviewTrend`, `RecsReport`, `SourcesTable`, composed by `Dashboard.tsx`, rendered in `Worklist`'s dash tab. Charts are CSS bars per the dataviz method: **validated palette** — categorical pair `#2d76a8` (Муж.) / `#c05a4e` (Жен.) (validator: all checks PASS, ΔE 49.4 protan, contrast ≥3:1 on white); single-series bars use the one sequential hue `#2d76a8`; status tones (care gaps) use the theme's reserved `ok`/`warn`/`info`/`destructive` tokens **with visible text tags** (never color alone). Marks: thin bars, rounded data ends, 2px gaps between paired bars, legend for the 2-series age chart, selective direct labels, values/labels in ink tokens (not series colors), `title=` hover on marks. **Deferred (noted):** the "Гонорар доктора" DetailModal (L326–426) + its "Детальная информация" buttons.

**Tech Stack:** React 19, TS, design-system `Card`/`Table`/`Badge`/`Button`, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis.

## Chart constants (validated — do not substitute)
```ts
export const CHART_M = '#2d76a8'   // Муж. (categorical slot 1)
export const CHART_F = '#c05a4e'   // Жен. (categorical slot 2)
export const CHART_SEQ = '#2d76a8' // single-series magnitude bars
```

---

### Task 1: Dashboard data + service (TDD)

**Files:** `src/data/dashboard.ts`, `src/services/dashboard.ts`, `src/services/dashboard.test.ts`.

- [ ] **Step 1: Failing tests** `src/services/dashboard.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getDashboard } from './dashboard'

describe('dashboard service', () => {
  it('returns KPIs, revenue tables, and analytics blocks', async () => {
    const d = await getDashboard()
    expect(d.kpis).toHaveLength(4)
    expect(d.services.rows.length).toBeGreaterThan(1)
    expect(d.recs.rows.length).toBeGreaterThan(3)
    expect(d.ageGroups).toHaveLength(6)
    expect(d.careGaps.length).toBeGreaterThan(3)
    expect(d.reviews.length).toBeGreaterThan(1)
  })
  it('revenue totals equal the column sums', async () => {
    const d = await getDashboard()
    for (const t of [d.services, d.recs]) {
      expect(t.total.qty).toBe(t.rows.reduce((s, r) => s + r.qty, 0))
      expect(t.total.gross).toBe(t.rows.reduce((s, r) => s + r.gross, 0))
      expect(t.total.fee).toBe(t.rows.reduce((s, r) => s + r.fee, 0))
    }
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- dashboard`

- [ ] **Step 3: Implement** `src/data/dashboard.ts` (numbers verbatim from prototype `dashboard.jsx`):
```ts
export interface Kpi { label: string; value: string; prev: string; cur: string; trend: number | null; icon: 'users' | 'check' | 'flag' | 'clock' }
export interface RevenueRow { name: string; qty: number; bonus: number; gross: number; net: number; fee: number }
export interface RevenueTableData { title: string; rows: RevenueRow[]; total: RevenueRow & { name: 'Итого' } }
export interface AgeGroup { g: string; m: number; f: number }
export interface CareGap { patient: string; kind: string; detail: string; due: string; tone: 'danger' | 'warn' | 'info' | 'ok' }
export interface Review { author: string; date: string; rating: number; text: string }

export const KPIS: Kpi[] = [
  { label: 'Всего пациентов', value: '117', prev: '16', cur: '13%', trend: 13, icon: 'users' },
  { label: 'ФОТ за услуги (сум)', value: '1.6М', prev: '1 375К', cur: '1 635К', trend: 19, icon: 'check' },
  { label: 'ФОТ за рекомендации (сум)', value: '661К', prev: '0', cur: '661К', trend: null, icon: 'flag' },
  { label: 'Средняя длит. приёма (мин)', value: '13', prev: '17', cur: '13', trend: -4, icon: 'clock' },
]

export const SERVICES_TABLE: RevenueTableData = {
  title: 'Выручка от выполненных услуг',
  rows: [
    { name: 'Инструментальная диагностика', qty: 11, bonus: 11, gross: 972000, net: 867857, fee: 260357 },
    { name: 'Консультация', qty: 11, bonus: 11, gross: 3080000, net: 2750000, fee: 1375000 },
  ],
  total: { name: 'Итого', qty: 22, bonus: 22, gross: 4052000, net: 3617857, fee: 1635357 },
}
export const RECS_TABLE: RevenueTableData = {
  title: 'Выручка от рекомендованных услуг',
  rows: [
    { name: 'Консультация', qty: 9, bonus: 1, gross: 2620000, net: 2339285, fee: 40714 },
    { name: 'Лабораторная диагностика', qty: 19, bonus: 19, gross: 1965500, net: 1754910, fee: 263236 },
    { name: 'Лучевая диагностика (радиология)', qty: 6, bonus: 4, gross: 1692000, net: 1510714, fee: 160000 },
    { name: 'Инструментальная диагностика', qty: 11, bonus: 5, gross: 2075000, net: 1852678, fee: 183750 },
    { name: 'Процедуры и лечение', qty: 2, bonus: 2, gross: 125000, net: 111607, fee: 13392 },
  ],
  total: { name: 'Итого', qty: 47, bonus: 31, gross: 8477500, net: 7569196, fee: 661093 },
}

export const RATINGS = [
  { label: 'По количеству пациентов', place: 8, of: 51 },
  { label: 'По выручке', place: 18, of: 53 },
  { label: 'По выполняемости рекомендаций', place: 8, of: 92 },
]
export const REVIEW_SCORE = { avg: 4.8, count: 36 }
export const REVIEWS: Review[] = [
  { author: 'Дилноза А.', date: '02.06.2026', rating: 5, text: 'Очень внимательный врач, всё подробно объяснила и успокоила. Назначения помогли быстро.' },
  { author: 'Рустам К.', date: '28.05.2026', rating: 5, text: 'Приём прошёл по делу, без лишнего ожидания. Рекомендую.' },
  { author: 'Аноним', date: '21.05.2026', rating: 4, text: 'Хороший специалист, профессионально. Немного задержали по времени.' },
]

export const AGE_GROUPS: AgeGroup[] = [
  { g: '0–7', m: 0, f: 1 }, { g: '8–17', m: 0, f: 0 }, { g: '18–31', m: 1, f: 4 },
  { g: '32–45', m: 4, f: 2 }, { g: '46–60', m: 1, f: 3 }, { g: '60+', m: 0, f: 1 },
]

export const EFFICIENCY = [
  { l: 'Средняя длительность приёма', v: '13 мин', sub: 'норматив 20 мин', pct: 65, tone: 'ok' },
  { l: 'Пунктуальность (начато вовремя)', v: '82%', sub: '', pct: 82, tone: 'ok' },
  { l: 'Неявки за период', v: '3', sub: 'из 19 записей', pct: 16, tone: 'warn' },
  { l: 'Отмены / переносы', v: '2', sub: '', pct: 10, tone: 'warn' },
  { l: 'Загруженность графика', v: '38%', sub: '', pct: 38, tone: '' },
  { l: 'Приёмов за период', v: '16', sub: '+4 к прошлому', pct: null, tone: '' },
] as { l: string; v: string; sub: string; pct: number | null; tone: '' | 'ok' | 'warn' }[]

export const DX_MIX = [
  { code: 'J06.9', name: 'ОРВИ', n: 8 },
  { code: 'K62.5', name: 'Кровотечение из прямой кишки', n: 4 },
  { code: 'I10', name: 'Артериальная гипертензия', n: 3 },
  { code: 'K64.9', name: 'Геморрой', n: 3 },
  { code: 'E11.9', name: 'Сахарный диабет 2 типа', n: 2 },
  { code: 'M54.5', name: 'Боль внизу спины', n: 2 },
]

export const REVIEW_TREND = [
  { w: '5 нед', r: 4.6 }, { w: '4 нед', r: 4.7 }, { w: '3 нед', r: 4.7 }, { w: '2 нед', r: 4.8 }, { w: '1 нед', r: 4.9 },
]
export const REVIEW_DIST = [
  { s: 5, n: 28 }, { s: 4, n: 6 }, { s: 3, n: 2 }, { s: 2, n: 0 }, { s: 1, n: 0 },
]

export const CARE_GAPS: CareGap[] = [
  { patient: 'Пинхасова Ларина Л.', kind: 'Повторный визит', detail: 'Просрочен повторный осмотр после K62.5', due: '−5 дн', tone: 'danger' },
  { patient: 'Юлдашев Бекзод А.', kind: 'Рекомендация', detail: 'Не выполнено: МРТ малого таза', due: '−3 дн', tone: 'danger' },
  { patient: 'Хасанова Малика Б.', kind: 'Рекомендация', detail: 'Не выполнено: общий анализ крови', due: '−1 дн', tone: 'warn' },
  { patient: 'Арзибаева Дилрабо Р.', kind: 'Аллергия', detail: 'Аллергия: пенициллин — учитывать при назначениях', due: '—', tone: 'info' },
  { patient: 'Каримов Дониёр Ш.', kind: 'Контроль', detail: 'Плановый контроль через 2 дня', due: '+2 дн', tone: 'ok' },
]

export const RECS_REPORT = [
  { l: 'Всего пациентов', n: 23, pct: 100 },
  { l: 'Пациентов с рекомендациями', n: 16, pct: 70 },
  { l: 'Рекомендовано услуг', n: 31, pct: 100 },
  { l: 'Выполнено рекомендованных услуг', n: 9, pct: 29 },
]

export const SOURCES = [
  { n: '05. Сотрудники', q: 18, income: 3502000, pct: 86.43 },
  { n: '04. Внешние врачи', q: 1, income: 90000, pct: 2.22 },
  { n: '09. Реклама в поисковиках', q: 1, income: 90000, pct: 2.22 },
  { n: 'Другое', q: 2, income: 370000, pct: 9.13 },
]

export const DOCTOR_NAME = 'Казанцева Наталья Владимировна'

// validated chart palette (dataviz validator: all checks PASS on light surface)
export const CHART_M = '#2d76a8'
export const CHART_F = '#c05a4e'
export const CHART_SEQ = '#2d76a8'
```
Then `src/services/dashboard.ts`:
```ts
import { KPIS, SERVICES_TABLE, RECS_TABLE, RATINGS, REVIEW_SCORE, REVIEWS, AGE_GROUPS, EFFICIENCY, DX_MIX, REVIEW_TREND, REVIEW_DIST, CARE_GAPS, RECS_REPORT, SOURCES, DOCTOR_NAME } from '@/data/dashboard'

// Async on purpose: a real backend computes these analytics later.
export async function getDashboard() {
  return {
    kpis: KPIS, services: SERVICES_TABLE, recs: RECS_TABLE,
    ratings: RATINGS, reviewScore: REVIEW_SCORE, reviews: REVIEWS,
    ageGroups: AGE_GROUPS, efficiency: EFFICIENCY, dxMix: DX_MIX,
    reviewTrend: REVIEW_TREND, reviewDist: REVIEW_DIST,
    careGaps: CARE_GAPS, recsReport: RECS_REPORT, sources: SOURCES,
    doctor: DOCTOR_NAME,
  }
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>
```

- [ ] **Step 4: Run — PASS**, then `npm run verify` green.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): dashboard data + service seam (TDD)"`

---

### Task 2: Dashboard components + composition + wiring

**Files:** all in `src/features/doctor/dashboard/`: `Dashboard.tsx`, `KpiCard.tsx`, `RevenueTable.tsx`, `DoctorRail.tsx`, `CareGaps.tsx`, `AnalyticsGrid.tsx`, `Dashboard.test.tsx`. Modify `src/features/doctor/Worklist.tsx`.

Build compact, single-responsibility components. Shared rules (dataviz): value/label text uses ink tokens (`text-foreground`/`text-muted-foreground`), never the series color; bars get `title=` hover; rounded data ends; 2px gaps between paired bars; the age chart shows a Муж./Жен. legend.

- [ ] **Step 1: `KpiCard.tsx`**
```tsx
import { Users, CheckCircle2, Flag, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Kpi } from '@/data/dashboard'

const ICONS = { users: Users, check: CheckCircle2, flag: Flag, clock: Clock }

export function KpiCard({ k }: { k: Kpi }) {
  const Icon = ICONS[k.icon]
  const Trend = (k.trend ?? 0) >= 0 ? TrendingUp : TrendingDown
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-semibold tabular-nums leading-tight">{k.value}</div>
          <div className="truncate text-xs text-muted-foreground">{k.label}</div>
          <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground"><span>Пред.: <b className="tabular-nums text-foreground/80">{k.prev}</b></span><span>Тек.: <b className="tabular-nums text-foreground">{k.cur}</b></span></div>
        </div>
        {k.trend != null && <span className="flex items-center gap-0.5 text-xs font-medium tabular-nums text-muted-foreground"><Trend className="size-3.5" />{k.trend >= 0 ? '+' : ''}{k.trend}%</span>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: `RevenueTable.tsx`** — design-system Table; totals row bold; money via `moneyFmt`:
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { RevenueTableData } from '@/data/dashboard'
import { moneyFmt } from '@/domain/format'

export function RevenueTable({ data }: { data: RevenueTableData }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{data.title}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Услуга</TableHead><TableHead className="text-right">Кол-во</TableHead><TableHead className="text-right">Бонусных</TableHead>
              <TableHead className="text-right">Выручка с НДС</TableHead><TableHead className="text-right">Без НДС</TableHead><TableHead className="text-right">Гонорар</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(r => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{r.qty}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.bonus}</TableCell>
                <TableCell className="text-right tabular-nums">{moneyFmt(r.gross)}</TableCell>
                <TableCell className="text-right tabular-nums">{moneyFmt(r.net)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{moneyFmt(r.fee)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Итого</TableCell>
              <TableCell className="text-right tabular-nums">{data.total.qty}</TableCell>
              <TableCell className="text-right tabular-nums">{data.total.bonus}</TableCell>
              <TableCell className="text-right tabular-nums">{moneyFmt(data.total.gross)}</TableCell>
              <TableCell className="text-right tabular-nums">{moneyFmt(data.total.net)}</TableCell>
              <TableCell className="text-right tabular-nums">{moneyFmt(data.total.fee)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: `DoctorRail.tsx`** (doctor, ratings, score, reviews; lucide `Star` with fill; stars carry `aria-label`):
```tsx
import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardData } from '@/services/dashboard'

function Stars({ n, className = 'size-3.5' }: { n: number; className?: string }) {
  return (
    <span role="img" aria-label={`Оценка ${n} из 5`} className="inline-flex gap-0.5 text-foreground/70">
      {[1, 2, 3, 4, 5].map(i => <Star key={i} className={className} fill={i <= n ? 'currentColor' : 'none'} />)}
    </span>
  )
}

export function DoctorRail({ d }: { d: DashboardData }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <div className="text-xs text-muted-foreground">Врач</div>
          <div className="font-semibold">{d.doctor}</div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Рейтинг</div>
          <div className="space-y-2">
            {d.ratings.map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{r.label}</div>
                  <div className="text-xs text-muted-foreground">место {r.place} из {r.of}</div>
                </div>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold tabular-nums">{r.place}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Отзывы</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{d.reviewScore.avg}</span>
            <Stars n={5} className="size-4" />
            <span className="text-xs text-muted-foreground">по {d.reviewScore.count} отзывам</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Последние отзывы</div>
          {d.reviews.map((r, i) => (
            <div key={i} className="rounded-md border p-2">
              <div className="flex items-center justify-between"><Stars n={r.rating} /><span className="text-xs text-muted-foreground">{r.date}</span></div>
              <p className="mt-1 text-xs">{r.text}</p>
              <div className="mt-1 text-xs text-muted-foreground">— {r.author}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: `CareGaps.tsx`** (status tags via theme tokens, text label always present):
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CareGap } from '@/data/dashboard'

const TONE: Record<CareGap['tone'], string> = {
  danger: 'bg-destructive/10 text-destructive',
  warn: 'bg-warn/15 text-warn-foreground',
  info: 'bg-info/10 text-info',
  ok: 'bg-ok/10 text-ok',
}

export function CareGaps({ items }: { items: CareGap[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Разрывы заботы и контроль</CardTitle>
        <span className="text-xs text-muted-foreground">{items.length} требуют внимания</span>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium', TONE[it.tone])}>{it.kind}</span>
            <span className="shrink-0 font-medium">{it.patient}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{it.detail}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{it.due}</span>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">Открыть</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```
NOTE: `bg-warn/15 text-warn-foreground` — the theme defines `--color-warn`/`--color-warn-foreground`, `--color-info`, `--color-ok` (Plan-1 `@theme` block). `text-warn-foreground` on a light warn bg may be low-contrast — if it looks wrong, use `text-foreground` for the warn tag; the visible text label carries the meaning either way.

- [ ] **Step 5: `AnalyticsGrid.tsx`** — the six analytic cards in one file (each a small internal component; they share tiny bar primitives):
```tsx
import { Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { DashboardData } from '@/services/dashboard'
import { moneyFmt } from '@/domain/format'
import { CHART_M, CHART_F, CHART_SEQ } from '@/data/dashboard'

function BarTrack({ pct, color = CHART_SEQ, title }: { pct: number; color?: string; title?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" title={title}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function SectionCard({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{title}</CardTitle>{extra}</CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function Efficiency({ d }: { d: DashboardData }) {
  return (
    <SectionCard title="Эффективность приёма">
      <div className="space-y-2.5">
        {d.efficiency.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.l}{r.sub && <span className="ml-1 text-xs text-muted-foreground">· {r.sub}</span>}</span>
            {r.pct != null && <div className="w-20 shrink-0"><BarTrack pct={r.pct} title={`${r.pct}%`} /></div>}
            <b className="w-14 shrink-0 text-right tabular-nums">{r.v}</b>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function DiagnosisMix({ d }: { d: DashboardData }) {
  const total = d.dxMix.reduce((s, r) => s + r.n, 0)
  const max = Math.max(...d.dxMix.map(r => r.n))
  return (
    <SectionCard title="Структура диагнозов (МКБ-10)" extra={<span className="text-xs text-muted-foreground">{total} за период</span>}>
      <div className="space-y-2">
        {d.dxMix.map(r => (
          <div key={r.code} className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{r.code}</span>
            <span className="min-w-0 flex-1 truncate" title={r.name}>{r.name}</span>
            <div className="w-24 shrink-0"><BarTrack pct={(r.n / max) * 100} title={`${r.n} (${Math.round((r.n / total) * 100)}%)`} /></div>
            <b className="w-6 shrink-0 text-right tabular-nums">{r.n}</b>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round((r.n / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function AgeChart({ d }: { d: DashboardData }) {
  const max = Math.max(1, ...d.ageGroups.flatMap(g => [g.m, g.f]))
  return (
    <SectionCard title="Информация по пациентам" extra={
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_M }} />Муж.</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_F }} />Жен.</span>
      </span>
    }>
      <div className="flex h-32 items-end justify-between gap-2 pt-4">
        {d.ageGroups.map(g => (
          <div key={g.g} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              {[{ v: g.m, c: CHART_M, s: 'муж.' }, { v: g.f, c: CHART_F, s: 'жен.' }].map((b, i) => (
                <div key={i} className="relative flex w-4 flex-col items-center justify-end" style={{ height: '100%' }} title={`${g.g}: ${b.v} ${b.s}`}>
                  {b.v > 0 && <span className="mb-0.5 text-[10px] tabular-nums text-muted-foreground">{b.v}</span>}
                  <div className="w-full rounded-t" style={{ height: `${(b.v / max) * 80}%`, background: b.c, minHeight: b.v > 0 ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">{g.g}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ReviewTrend({ d }: { d: DashboardData }) {
  const maxN = Math.max(...d.reviewDist.map(x => x.n), 1)
  return (
    <SectionCard title="Динамика отзывов" extra={<span className="text-xs text-muted-foreground">{d.reviewScore.avg} · {d.reviewScore.count} отзывов</span>}>
      <div className="flex h-20 items-end justify-between gap-3 pb-1">
        {d.reviewTrend.map((w, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${w.w}: ${w.r}`}>
            <span className="text-[10px] tabular-nums text-muted-foreground">{w.r}</span>
            <div className="w-5 rounded-t" style={{ height: `${((w.r - 4.0) / 1.0) * 48 + 6}px`, background: CHART_SEQ }} />
            <span className="text-[10px] text-muted-foreground">{w.w}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {d.reviewDist.map(x => (
          <div key={x.s} className="flex items-center gap-2 text-xs">
            <span className="flex w-7 shrink-0 items-center gap-0.5 tabular-nums">{x.s}<Star className="size-2.5" fill="currentColor" /></span>
            <div className="flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted" title={`${x.n}`}><div className="h-full rounded-full" style={{ width: `${(x.n / maxN) * 100}%`, background: CHART_SEQ }} /></div></div>
            <b className="w-6 shrink-0 text-right tabular-nums">{x.n}</b>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function RecsReport({ d }: { d: DashboardData }) {
  return (
    <SectionCard title="Отчёт по рекомендациям">
      <div className="space-y-2.5">
        {d.recsReport.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.l}</span>
            <b className="w-8 shrink-0 text-right tabular-nums">{r.n}</b>
            <div className="w-24 shrink-0"><BarTrack pct={r.pct} title={`${r.pct}%`} /></div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.pct}%</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function Sources({ d }: { d: DashboardData }) {
  return (
    <SectionCard title="Источники пациентов">
      <Table>
        <TableHeader><TableRow><TableHead>Источник</TableHead><TableHead className="text-right">Кол-во</TableHead><TableHead className="text-right">Доход</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
        <TableBody>
          {d.sources.map(r => (
            <TableRow key={r.n}>
              <TableCell className="font-medium">{r.n}</TableCell>
              <TableCell className="text-right tabular-nums">{r.q}</TableCell>
              <TableCell className="text-right tabular-nums">{moneyFmt(r.income)}</TableCell>
              <TableCell><div className="flex items-center justify-end gap-2"><div className="w-16"><BarTrack pct={r.pct} title={`${r.pct}%`} /></div><span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{r.pct}%</span></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}

export function AnalyticsGrid({ d }: { d: DashboardData }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <Efficiency d={d} />
      <DiagnosisMix d={d} />
      <AgeChart d={d} />
      <ReviewTrend d={d} />
      <RecsReport d={d} />
      <Sources d={d} />
    </div>
  )
}
```

- [ ] **Step 6: `Dashboard.tsx`** (container: loads data, composes):
```tsx
import { useEffect, useState } from 'react'
import { getDashboard, type DashboardData } from '@/services/dashboard'
import { KpiCard } from './KpiCard'
import { RevenueTable } from './RevenueTable'
import { DoctorRail } from './DoctorRail'
import { CareGaps } from './CareGaps'
import { AnalyticsGrid } from './AnalyticsGrid'

export function Dashboard() {
  const [d, setD] = useState<DashboardData | null>(null)
  useEffect(() => {
    let alive = true
    getDashboard().then(x => { if (alive) setD(x) })
    return () => { alive = false }
  }, [])
  if (!d) return null
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{d.kpis.map(k => <KpiCard key={k.label} k={k} />)}</div>
      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <DoctorRail d={d} />
        <div className="space-y-3">
          <RevenueTable data={d.services} />
          <RevenueTable data={d.recs} />
          <CareGaps items={d.careGaps} />
        </div>
      </div>
      <AnalyticsGrid d={d} />
    </div>
  )
}
```

- [ ] **Step 7: Wire into `Worklist.tsx`** — replace the dash-tab stub (`<div className="rounded-lg border p-8 ...">Дашборд — в следующем плане.</div>`) with `<Dashboard />` (import from `./dashboard/Dashboard`).

- [ ] **Step 8: Smoke test** `Dashboard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Dashboard } from './Dashboard'

describe('Dashboard (smoke)', () => {
  it('renders KPIs, tables and analytics with no axe violations', async () => {
    const { container, findByText } = render(<Dashboard />)
    expect(await findByText('Всего пациентов')).toBeTruthy()
    expect(await findByText('Выручка от выполненных услуг')).toBeTruthy()
    expect(await findByText('Разрывы заботы и контроль')).toBeTruthy()
    expect(await findByText('Структура диагнозов (МКБ-10)')).toBeTruthy()
    await waitFor(() => expect(container.querySelectorAll('table').length).toBeGreaterThan(1))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 9: Gate + commit** — `npm run verify && npm run build` green (Worklist smoke still passes; dashboard smoke new). Commit: `git add -A && git commit -m "feat(doctor): dashboard tab (KPIs, revenue, care gaps, analytics)"`

---

### Task 3: Gate + screenshot
- [ ] `npm run verify && npm run build`; (controller) screenshot the Дашборд tab; render check per dataviz step 7 (label collisions/overflow).

---

## Self-Review (plan author)

**Spec coverage:** Full port of prototype `dashboard.jsx` minus the explicitly deferred DetailModal: KPI row, doctor rail (ratings/score/reviews), both revenue tables with verifiable totals (TDD), care gaps, efficiency, dx mix, age chart, review trend+distribution, recs report, sources. Dataviz method applied: form per block (stat tiles / tables / bars), **validator-passed** categorical pair + single sequential hue, status tokens with text tags, legend on the 2-series chart, ink-colored text, title-hover on marks, thin rounded marks with gaps.

**Placeholder scan:** none — data verbatim, all component code complete. The `text-warn-foreground` contrast note is an explicit conditional with a stated fallback.

**Type consistency:** `DashboardData` derived from the service; components take `d`/typed slices; `Kpi`/`RevenueTableData`/`CareGap` exported from `data/dashboard.ts`; `moneyFmt` exists; chart constants exported once and imported. `Dashboard` replaces the Worklist stub — Worklist's existing Tabs structure unchanged.

**Scope:** One screen (the dashboard tab), data-tested, smoke-tested, visually verified.
