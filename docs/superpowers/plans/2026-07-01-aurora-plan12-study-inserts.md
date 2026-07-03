# Aurora Redesign — Plan 12: Past-results inserts (study history → document)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Let the doctor insert the patient's previous studies into the document: three toolbar buttons (Функц. иссл. / Лучевая / Лаборатория) open a study-history browser (list + search + preview; labs with per-row checkboxes and ↑/↓ flags); "Вставить в документ" appends the formatted study into the right section (labs → ЛАБОРАТОРНЫЕ, functional/radiology → ИНСТРУМЕНТАЛЬНЫЕ, fallback: first section).

**Architecture:** `src/domain/studies.ts` holds the ported `STUDY_HISTORY` (func/rad/lab), titles, target-section map, and `studyInsertHtml(kind, study, rowIdx?)` — a pure, HTML-escaping formatter (TDD). `StudyHistoryModal` (design-system Dialog): left = searchable study list; right = preview (desc + Заключение, or a lab table with flag-colored values and row checkboxes); insert emits the formatted HTML. `RichTextToolbar` gains the three buttons + an `insertStudy` handler that appends the HTML into the target `[data-section-tag]` element (`<br>`-joined) and dispatches an `input` event so `PagedSheet` reflows. Ported from prototype `consultation.jsx` (STUDY_HISTORY L155–197, STUDY_META/LAB_FLAG L198–203, FmtToolbar modal buttons L50–58). **Deferred (noted):** the date-range calendar filter (StudyRangeCal) + lab-sheet print.

**Tech Stack:** React 19, TS, design-system `Dialog`/`Button`/`Checkbox`/`ScrollArea`, lucide-react, Vitest + jest-axe.

**Testability:** `studyInsertHtml` + catalog shape → TDD. Modal → render+axe smoke. Append/`input`-dispatch is DOM-glue verified visually.

**Reference:** prototype `consultation.jsx`. Prior: Plans 1–11.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis (the ↑/↓ lab flags are text arrows from the prototype, not emojis); lucide icons.

## File Structure (this plan)
```
src/domain/studies.ts               # StudyKind, Study, LabRow, STUDY_HISTORY, STUDY_TITLES, STUDY_TARGET, studyInsertHtml
src/domain/studies.test.ts          # TDD
src/features/doctor/consultation/
  StudyHistoryModal.tsx             # browser: list + search + preview + lab row checkboxes
  StudyHistoryModal.test.tsx        # smoke
  RichTextToolbar.tsx               # + 3 buttons + insertStudy append
```

---

### Task 1: Studies domain (TDD)

**Files:** `src/domain/studies.ts`, `src/domain/studies.test.ts`.

- [ ] **Step 1: Failing tests** `src/domain/studies.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { STUDY_HISTORY, STUDY_TARGET, studyInsertHtml } from './studies'

describe('studies domain', () => {
  it('STUDY_HISTORY has func/rad/lab entries', () => {
    expect(STUDY_HISTORY.func.length).toBeGreaterThan(1)
    expect(STUDY_HISTORY.rad.length).toBeGreaterThan(1)
    expect(STUDY_HISTORY.lab.length).toBeGreaterThan(1)
    expect(STUDY_HISTORY.lab[0].rows!.length).toBeGreaterThan(2)
  })
  it('targets labs to ЛАБОРАТОРНЫЕ and func/rad to ИНСТРУМЕНТАЛЬНЫЕ', () => {
    expect(STUDY_TARGET.lab).toBe('ЛАБОРАТОРНЫЕ')
    expect(STUDY_TARGET.func).toBe('ИНСТРУМЕНТАЛЬНЫЕ')
    expect(STUDY_TARGET.rad).toBe('ИНСТРУМЕНТАЛЬНЫЕ')
  })
  it('formats a functional study with description + conclusion', () => {
    const html = studyInsertHtml('func', STUDY_HISTORY.func[0])
    expect(html.startsWith('ЭКГ с расшифровкой (12.04.2026, Бакиева М. А.):<br>')).toBe(true)
    expect(html).toContain('<br>Заключение: Синусовый ритм')
  })
  it('formats selected lab rows with flags and reference ranges', () => {
    const html = studyInsertHtml('lab', STUDY_HISTORY.lab[0], [0])
    expect(html).toBe('Общий анализ крови (28.05.2026):<br>— Гемоглобин (HGB): 118 г/л ↓ (норма 120–160)')
  })
  it('escapes HTML in study fields', () => {
    const html = studyInsertHtml('rad', { name: '<b>x</b>', date: '01.01.2026', by: 'Y', desc: 'a<b', concl: 'c>d' })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('a&lt;b')
    expect(html).toContain('c&gt;d')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- studies`

- [ ] **Step 3: Implement** `src/domain/studies.ts` (STUDY_HISTORY ported verbatim from the prototype — all 3 func, 3 rad, 3 lab entries with their full Russian texts and lab rows; the two shown below in full, the implementer copies ALL entries exactly as listed here):
```ts
export type StudyKind = 'func' | 'rad' | 'lab'
export interface LabRow { n: string; v: string; u: string; ref: string; flag: 'low' | 'high' | 'ok' }
export interface Study { name: string; date: string; by: string; desc?: string; concl?: string; rows?: LabRow[] }

export const STUDY_TITLES: Record<StudyKind, string> = {
  func: 'Функциональные исследования',
  rad: 'Лучевая диагностика',
  lab: 'Лабораторные исследования',
}
export const STUDY_TARGET: Record<StudyKind, string> = { func: 'ИНСТРУМЕНТАЛЬНЫЕ', rad: 'ИНСТРУМЕНТАЛЬНЫЕ', lab: 'ЛАБОРАТОРНЫЕ' }

export const STUDY_HISTORY: Record<StudyKind, Study[]> = {
  func: [
    { name: 'ЭКГ с расшифровкой', date: '12.04.2026', by: 'Бакиева М. А.',
      desc: 'Ритм синусовый, ЧСС 78 уд/мин. ЭОС не отклонена. PQ 0.16 c, QRS 0.09 c, QT 0.38 c. Нарушений внутрижелудочковой проводимости и очаговых изменений миокарда не выявлено.',
      concl: 'Синусовый ритм с ЧСС 78/мин. Вариант возрастной нормы.' },
    { name: 'Холтер-мониторинг ЭКГ', date: '20.03.2026', by: 'Сафаров Р. И.',
      desc: 'За 24 ч зарегистрировано 98 540 комплексов QRS. ЧСС средняя 72/мин, минимальная 54 (во сне), максимальная 131 (при нагрузке). Одиночная наджелудочковая экстрасистолия — 312 за сутки. Ишемических изменений сегмента ST не зарегистрировано.',
      concl: 'Значимых для гемодинамики нарушений ритма и ишемии миокарда не выявлено.' },
    { name: 'ЭхоКГ (УЗИ сердца)', date: '05.02.2026', by: 'Бакиева М. А.',
      desc: 'Полости сердца не расширены. Фракция выброса ЛЖ 62%. Зон нарушения локальной сократимости нет. Клапанный аппарат без значимой патологии. Перикард не изменён.',
      concl: 'Сократительная функция миокарда сохранена. Эхо-признаков патологии не выявлено.' },
  ],
  rad: [
    { name: 'УЗИ органов малого таза', date: '18.05.2026', by: 'Ибрагимов А. К.',
      desc: 'Матка и придатки без структурных изменений. Свободной жидкости в малом тазу не определяется. Регионарные лимфоузлы не увеличены.',
      concl: 'Эхо-признаков патологии органов малого таза не выявлено.' },
    { name: 'МРТ малого таза', date: '25.04.2026', by: 'Закиров Т. М.',
      desc: 'Стенки прямой кишки не утолщены, дифференцировка слоёв сохранена. Параректальная клетчатка без признаков инфильтрации. Патологических объёмных образований и увеличенных лимфоузлов не выявлено.',
      concl: 'МР-данных за объёмное образование органов малого таза не получено.' },
    { name: 'Рентгенография органов грудной клетки', date: '10.03.2026', by: 'Закиров Т. М.',
      desc: 'Лёгочные поля без очаговых и инфильтративных теней. Корни структурны, не расширены. Синусы свободны. Тень сердца в пределах нормы.',
      concl: 'Патологических изменений в органах грудной клетки не выявлено.' },
  ],
  lab: [
    { name: 'Общий анализ крови', date: '28.05.2026', by: 'Лаборатория Medion',
      rows: [
        { n: 'Гемоглобин (HGB)', v: '118', u: 'г/л', ref: '120–160', flag: 'low' },
        { n: 'Эритроциты (RBC)', v: '4.2', u: '10¹²/л', ref: '3.8–5.1', flag: 'ok' },
        { n: 'Лейкоциты (WBC)', v: '9.8', u: '10⁹/л', ref: '4.0–9.0', flag: 'high' },
        { n: 'Тромбоциты (PLT)', v: '265', u: '10⁹/л', ref: '150–400', flag: 'ok' },
        { n: 'СОЭ', v: '18', u: 'мм/ч', ref: '2–15', flag: 'high' },
      ] },
    { name: 'Биохимия крови', date: '20.05.2026', by: 'Лаборатория Medion',
      rows: [
        { n: 'Глюкоза', v: '5.4', u: 'ммоль/л', ref: '3.9–6.1', flag: 'ok' },
        { n: 'АЛТ', v: '42', u: 'Ед/л', ref: '0–41', flag: 'high' },
        { n: 'АСТ', v: '30', u: 'Ед/л', ref: '0–40', flag: 'ok' },
        { n: 'Креатинин', v: '86', u: 'мкмоль/л', ref: '62–106', flag: 'ok' },
        { n: 'Билирубин общий', v: '14.2', u: 'мкмоль/л', ref: '3.4–20.5', flag: 'ok' },
      ] },
    { name: 'Общий анализ мочи', date: '05.05.2026', by: 'Лаборатория Medion',
      rows: [
        { n: 'Цвет', v: 'сол.-жёлтый', u: '', ref: 'сол.-жёлтый', flag: 'ok' },
        { n: 'Белок', v: 'не обнаружен', u: '', ref: 'отсутствует', flag: 'ok' },
        { n: 'Лейкоциты', v: '2–3', u: 'в п/з', ref: '0–5', flag: 'ok' },
        { n: 'Эритроциты', v: '1–2', u: 'в п/з', ref: '0–2', flag: 'ok' },
      ] },
  ],
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const FLAG_MARK: Record<LabRow['flag'], string> = { low: ' ↓', high: ' ↑', ok: '' }

export function studyInsertHtml(kind: StudyKind, s: Study, rowIdx?: number[]): string {
  if (kind === 'lab') {
    const rows = (s.rows ?? []).filter((_, i) => !rowIdx || rowIdx.includes(i))
    return `${esc(s.name)} (${esc(s.date)}):` + rows.map(r =>
      `<br>— ${esc(r.n)}: ${esc(r.v)}${r.u ? ` ${esc(r.u)}` : ''}${FLAG_MARK[r.flag]}${r.ref ? ` (норма ${esc(r.ref)})` : ''}`).join('')
  }
  return `${esc(s.name)} (${esc(s.date)}, ${esc(s.by)}):<br>${esc(s.desc ?? '')}<br>Заключение: ${esc(s.concl ?? '')}`
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- studies`
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): studies domain (history catalog + insert formatter) (TDD)"`

---

### Task 2: StudyHistoryModal + toolbar buttons + append-to-section

**Files:** `StudyHistoryModal.tsx`, `StudyHistoryModal.test.tsx`, `RichTextToolbar.tsx`.

- [ ] **Step 1: `src/features/doctor/consultation/StudyHistoryModal.tsx`**:
```tsx
import { useState } from 'react'
import { Search, FileDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { STUDY_HISTORY, STUDY_TITLES, studyInsertHtml, type StudyKind } from '@/domain/studies'

const FLAG_CLS = { low: 'text-info', high: 'text-destructive', ok: 'text-muted-foreground' } as const
const FLAG_MARK = { low: '↓', high: '↑', ok: '' } as const

export function StudyHistoryModal({ kind, onInsert, onClose }: { kind: StudyKind; onInsert: (html: string) => void; onClose: () => void }) {
  const studies = STUDY_HISTORY[kind]
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [checked, setChecked] = useState<number[]>(() => (studies[0]?.rows ?? []).map((_, i) => i))
  const list = studies.filter(s => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()))
  const sel = list[Math.min(idx, Math.max(0, list.length - 1))]
  const pick = (i: number) => { setIdx(i); setChecked((list[i]?.rows ?? []).map((_, j) => j)) }
  const canInsert = !!sel && (kind !== 'lab' || checked.length > 0)
  const insert = () => { if (!sel) return; onInsert(studyInsertHtml(kind, sel, kind === 'lab' ? checked : undefined)); onClose() }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{STUDY_TITLES[kind]}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 rounded-md border px-2">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={e => { setQ(e.target.value); setIdx(0) }} placeholder="Поиск исследования…" aria-label="Поиск исследования" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="grid h-80 grid-cols-[1.1fr_1.6fr] gap-2">
          <ScrollArea className="rounded-md border">
            {list.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Ничего не найдено.</p>}
            {list.map((s, i) => (
              <button key={s.name + s.date} onClick={() => pick(i)}
                className={cn('flex w-full flex-col px-3 py-2 text-left hover:bg-accent', sel === s && 'bg-accent')}>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.date} · {s.by}</span>
              </button>
            ))}
          </ScrollArea>
          <ScrollArea className="rounded-md border p-3">
            {!sel ? <p className="text-sm text-muted-foreground">Выберите исследование.</p> : sel.rows ? (
              <div className="space-y-1">
                <div className="mb-2 text-sm font-medium">{sel.name} · {sel.date}</div>
                {sel.rows.map((r, i) => (
                  <label key={r.n} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                    <Checkbox checked={checked.includes(i)} onCheckedChange={() => setChecked(c => c.includes(i) ? c.filter(x => x !== i) : [...c, i])} />
                    <span className="min-w-0 flex-1 truncate">{r.n}</span>
                    <span className={cn('tabular-nums text-xs', FLAG_CLS[r.flag])}>{r.v}{r.u ? ` ${r.u}` : ''} {FLAG_MARK[r.flag]}</span>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{r.ref}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{sel.name} · {sel.date} · {sel.by}</div>
                <p>{sel.desc}</p>
                <p><b>Заключение:</b> {sel.concl}</p>
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button disabled={!canInsert} onClick={insert}><FileDown className="size-4" />Вставить в документ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```
(NOTE: `text-info` comes from the `--color-info` theme token added in Plan 1's `index.css` `@theme` block — it exists. If tsc/tailwind doesn't resolve it, use `text-primary` for `low` instead and note it.)

- [ ] **Step 2: Toolbar buttons + append.** In `RichTextToolbar.tsx`: import `Activity, ScanLine, FlaskConical` (add to lucide import), `import { useState } from 'react'`, `import { StudyHistoryModal } from './StudyHistoryModal'`, `import { STUDY_TARGET, type StudyKind } from '@/domain/studies'`. Inside the component add:
```tsx
const [studyKind, setStudyKind] = useState<StudyKind | null>(null)
const insertStudy = (html: string) => {
  if (!studyKind) return
  const tag = STUDY_TARGET[studyKind]
  const el = (document.querySelector(`[data-section-tag="${tag}"]`) ?? document.querySelector('[data-section-tag]')) as HTMLElement | null
  if (!el) return
  el.innerHTML = el.textContent?.trim() ? `${el.innerHTML}<br>${html}` : html
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
```
In the JSX, after the "Рекомендации" insert button add:
```tsx
<Div />
<button type="button" title="Вставить функциональное исследование" onClick={() => setStudyKind('func')} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><Activity className="size-4" />Функц. иссл.</button>
<button type="button" title="Вставить лучевую диагностику" onClick={() => setStudyKind('rad')} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><ScanLine className="size-4" />Лучевая</button>
<button type="button" title="Вставить лабораторные исследования" onClick={() => setStudyKind('lab')} className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-primary hover:bg-accent"><FlaskConical className="size-4" />Лаборатория</button>
```
And before the toolbar's closing tag: `{studyKind && <StudyHistoryModal kind={studyKind} onInsert={insertStudy} onClose={() => setStudyKind(null)} />}`
(These open a modal → `onClick`, not `onMouseDown` — they don't need to preserve the text selection since the insert targets a section by tag.)

- [ ] **Step 3: Smoke test** `StudyHistoryModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { StudyHistoryModal } from './StudyHistoryModal'

describe('StudyHistoryModal (smoke)', () => {
  it('lab kind lists studies with rows, no axe violations', async () => {
    const { baseElement, getByText } = render(<StudyHistoryModal kind="lab" onInsert={() => {}} onClose={() => {}} />)
    expect(getByText('Лабораторные исследования')).toBeTruthy()
    expect(getByText('Общий анализ крови')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
  it('func kind shows description + conclusion preview', () => {
    const { getByText } = render(<StudyHistoryModal kind="func" onInsert={() => {}} onClose={() => {}} />)
    expect(getByText('ЭКГ с расшифровкой')).toBeTruthy()
    expect(getByText('Заключение:')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(doctor): study-history browser + insert past results into the document"`

---

### Task 3: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2:** (Controller) screenshot: the lab browser open with flagged rows; then the document with an inserted lab block in ЛАБОРАТОРНЫЕ.

---

## Self-Review (plan author)

**Spec coverage:** The last major toolbar feature: past-results browsing + insertion (func/rad/lab), ported from the prototype's STUDY_HISTORY/FmtToolbar modals. Insert targets the clinically-correct section (ЛАБОРАТОРНЫЕ / ИНСТРУМЕНТАЛЬНЫЕ, fallback first section) with escaped, `<br>`-formatted HTML, and pokes `input` so pagination reflows. **Deferred (noted):** StudyRangeCal date filter + lab print. Remaining after this: hints panel, "все рекомендации" history, templates.

**Placeholder scan:** No TODOs. STUDY_HISTORY fully listed (3+3+3 with all rows). All code complete. The `text-info` fallback note is explicit.

**Type consistency:** `StudyKind`/`Study`/`LabRow` in `domain/studies.ts`; `studyInsertHtml(kind, s, rowIdx?)` matches tests + modal. `STUDY_TARGET` keys cover all kinds. Modal props `{kind, onInsert(html), onClose}` match the toolbar wiring. `checked` row indices only used for lab. Buttons use `onClick` (modal) vs the existing `onMouseDown` (selection-preserving) — intentional and explained.

**Scope:** One coherent feature (browse → preview → selective insert), formatter unit-tested, modal smoke-tested, visually verifiable.
