# Aurora Redesign — Plan 3: Rich-text toolbar + A4 print/pagination

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add the consultation document's rich-text formatting toolbar (bold/italic/lists/color/align via `execCommand` on the focused section), on-screen A4 pagination (measured page breaks + page-gap bands + footers), and a Print flow (pick sections → clone → system print on A4).

**Architecture:** The center `A4Document` gains a `RichTextToolbar` above the sheet, and its sheet becomes a `PagedSheet` that measures block heights and nudges blocks past page boundaries. A `PrintModal` selects which sections print; `doPrint` clones the sheet into an off-screen print root, strips screen-only chrome, injects an `@page A4` style, and calls `window.print()`. Formatting acts on the browser selection inside the `contentEditable` `A4Section` bodies (unchanged from Plan 2). All ported from the prototype `consultation.jsx` (FmtToolbar L49–150, PagedSheet L440–499, PrintModal L841–878, doPrint L964–998).

**Tech Stack:** React 19, TS, Tailwind v4, design-system `Popover`/`Button`/`Checkbox`/`Dialog`, lucide-react, Vitest + jest-axe.

**Testability note:** `execCommand`, DOM measurement (`offsetTop/Height`), and `window.print` are browser-only — jsdom returns zeros / no-ops. Tests here are **render + zero-axe smoke tests** only (the toolbar mounts, the PrintModal mounts). Behavior is validated by the owner visually + a test print. Do NOT try to assert formatting/pagination in jsdom.

**Reference:** prototype `C:\Users\user\Desktop\aurora las\_handout\src\consultation.jsx`. Prior plans: `2026-07-01-aurora-plan2-consultation-foundation.md`.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`.
- Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian copy verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/features/doctor/consultation/
  RichTextToolbar.tsx      # execCommand formatting toolbar (+ color/highlight popovers)
  RichTextToolbar.test.tsx # smoke
  PagedSheet.tsx           # A4 paper with measured pagination + gap bands + footers
  PrintModal.tsx           # section-selection print dialog
  PrintModal.test.tsx      # smoke
  A4Section.tsx            # memoize (avoid re-render clobbering contentEditable)
  A4Document.tsx           # integrate toolbar + PagedSheet + print
src/index.css              # + A4/print styles (@media print, .a4-paper, .a4-gap, .a4-pagefoot, .np)
```

---

### Task 1: Rich-text formatting toolbar

**Files:** `RichTextToolbar.tsx`, `RichTextToolbar.test.tsx`, integrate into `A4Document.tsx`.

- [ ] **Step 1: `src/features/doctor/consultation/RichTextToolbar.tsx`** (ported from FmtToolbar's formatting row; each button uses `onMouseDown` + `preventDefault` to keep the selection in the focused `contentEditable`, then `execCommand`):
```tsx
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Palette, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Outdent, Indent, Link2, Eraser,
} from 'lucide-react'

const TEXT_COLORS = ['#1c2531', '#1c5dc7', '#c0392b', '#1f9254', '#c47d12']
const HL_COLORS = ['#fff3bf', '#d3f9d8', '#ffe3e3', '#d0ebff']

// run a rich-text command on the focused contentEditable; keep the selection
function useExec() {
  return (cmd: string, val?: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    try { document.execCommand(cmd, false, val) } catch { /* deprecated API, best-effort */ }
  }
}

function Btn({ title, onMouseDown, children }: { title: string; onMouseDown: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return <button type="button" title={title} onMouseDown={onMouseDown} className="flex size-8 items-center justify-center rounded text-foreground/80 hover:bg-accent hover:text-accent-foreground">{children}</button>
}
const Div = () => <span className="mx-1 h-5 w-px bg-border" />

export function RichTextToolbar() {
  const exec = useExec()
  const addLink = (e: React.MouseEvent) => { e.preventDefault(); const url = window.prompt('Ссылка (URL):', 'https://'); if (url) { try { document.execCommand('createLink', false, url) } catch { /* */ } } }
  const setBlock = (v: string) => { try { document.execCommand('formatBlock', false, v) } catch { /* */ } }
  const setSize = (v: string) => { try { document.execCommand('fontSize', false, v) } catch { /* */ } }
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-card p-1">
      <Btn title="Отменить" onMouseDown={exec('undo')}><Undo2 className="size-4" /></Btn>
      <Btn title="Повторить" onMouseDown={exec('redo')}><Redo2 className="size-4" /></Btn>
      <Div />
      <select aria-label="Стиль" className="h-8 rounded border bg-transparent px-1 text-sm" defaultValue="" onChange={e => { setBlock(e.target.value); e.currentTarget.selectedIndex = 0 }}>
        <option value="" disabled>Стиль</option>
        <option value="p">Абзац</option><option value="h1">Заголовок 1</option><option value="h2">Заголовок 2</option><option value="h3">Заголовок 3</option>
      </select>
      <select aria-label="Размер" className="h-8 w-14 rounded border bg-transparent px-1 text-sm" defaultValue="3" onChange={e => setSize(e.target.value)}>
        <option value="1">10</option><option value="2">12</option><option value="3">14</option><option value="4">16</option><option value="5">18</option><option value="6">24</option>
      </select>
      <Div />
      <Btn title="Полужирный" onMouseDown={exec('bold')}><Bold className="size-4" /></Btn>
      <Btn title="Курсив" onMouseDown={exec('italic')}><Italic className="size-4" /></Btn>
      <Btn title="Подчёркнутый" onMouseDown={exec('underline')}><Underline className="size-4" /></Btn>
      <Btn title="Зачёркнутый" onMouseDown={exec('strikeThrough')}><Strikethrough className="size-4" /></Btn>
      <Popover>
        <PopoverTrigger asChild><button type="button" title="Цвет текста" className="flex size-8 items-center justify-center rounded hover:bg-accent"><Palette className="size-4" /></button></PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-2">{TEXT_COLORS.map(c => <button key={c} type="button" aria-label={`Цвет ${c}`} onMouseDown={exec('foreColor', c)} className="size-5 rounded" style={{ background: c }} />)}</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild><button type="button" title="Выделение" className="flex size-8 items-center justify-center rounded hover:bg-accent"><Highlighter className="size-4" /></button></PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-2">{HL_COLORS.map(c => <button key={c} type="button" aria-label={`Выделение ${c}`} onMouseDown={exec('hiliteColor', c)} className="size-5 rounded border" style={{ background: c }} />)}</PopoverContent>
      </Popover>
      <Div />
      <Btn title="По левому краю" onMouseDown={exec('justifyLeft')}><AlignLeft className="size-4" /></Btn>
      <Btn title="По центру" onMouseDown={exec('justifyCenter')}><AlignCenter className="size-4" /></Btn>
      <Btn title="По правому краю" onMouseDown={exec('justifyRight')}><AlignRight className="size-4" /></Btn>
      <Btn title="По ширине" onMouseDown={exec('justifyFull')}><AlignJustify className="size-4" /></Btn>
      <Div />
      <Btn title="Маркированный список" onMouseDown={exec('insertUnorderedList')}><List className="size-4" /></Btn>
      <Btn title="Нумерованный список" onMouseDown={exec('insertOrderedList')}><ListOrdered className="size-4" /></Btn>
      <Btn title="Уменьшить отступ" onMouseDown={exec('outdent')}><Outdent className="size-4" /></Btn>
      <Btn title="Увеличить отступ" onMouseDown={exec('indent')}><Indent className="size-4" /></Btn>
      <Div />
      <Btn title="Ссылка" onMouseDown={addLink}><Link2 className="size-4" /></Btn>
      <Btn title="Очистить форматирование" onMouseDown={exec('removeFormat')}><Eraser className="size-4" /></Btn>
    </div>
  )
}
```
(Image/table inserts and the blue card-inserts from the prototype are deferred to Plan 4/5, which depend on the pickers.)

- [ ] **Step 2: Smoke test** `RichTextToolbar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RichTextToolbar } from './RichTextToolbar'

describe('RichTextToolbar (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { container, getByTitle } = render(<RichTextToolbar />)
    expect(getByTitle('Полужирный')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 3: Integrate** into `A4Document.tsx` — import `RichTextToolbar` and render it on its own row directly under the existing toolbar row (doc-type/save/zoom), above the sheet:
```tsx
// under the first flex toolbar row, before the sheet <div ref={sheet}>:
<RichTextToolbar />
```

- [ ] **Step 4: Gate + commit** — `npm run verify` green (toolbar smoke + prior 18). Note: `document.execCommand` types exist in the TS DOM lib; if tsc complains it's deprecated, that's a warning not an error — leave it. Commit: `git add -A && git commit -m "feat(doctor): consultation rich-text formatting toolbar (execCommand)"`

---

### Task 2: A4 on-screen pagination (PagedSheet)

**Files:** `PagedSheet.tsx`, `A4Section.tsx` (memoize), `A4Document.tsx` (use PagedSheet), `src/index.css` (A4 styles).

- [ ] **Step 1: A4 styles** — append to `src/index.css` (screen paper + page bands; print styles come in Task 3):
```css
/* --- A4 document (consultation) --- */
.a4-paper { position: relative; width: 794px; margin: 0 auto; background: #fff; padding: 48px 56px; }
.a4-gap { position: absolute; left: 0; right: 0; height: 24px; background: var(--muted); display: flex; align-items: center; justify-content: center; }
.a4-gap-label { font-size: 11px; color: var(--muted-foreground); }
.a4-pagefoot { position: absolute; left: 56px; right: 56px; display: flex; justify-content: space-between; font-size: 10px; color: var(--muted-foreground); border-top: 1px solid var(--border); padding-top: 4px; }
```

- [ ] **Step 2: Memoize `A4Section`** so pagination/zoom re-renders never re-render section bodies (protects contentEditable content). Wrap the existing component:
```tsx
import { memo } from 'react'
export const A4Section = memo(function A4Section({ ru, uz, value = '' }: { ru: string; uz?: string; value?: string }) {
  /* ...existing body unchanged... */
})
```
(Change the `export function A4Section` to `const A4Section = memo(function A4Section(...) {...})` + `export { A4Section }` — keep the JSX identical.)

- [ ] **Step 3: `PagedSheet.tsx`** (ported from prototype PagedSheet L440–499; measures leaf blocks, nudges past page bottoms; draws gap bands + footers). Guarded so jsdom (zero offsets) simply renders 1 page:
```tsx
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const PAGE_H = 1040, MB = 59, MT = 50, GAP = 24

export function PagedSheet({ zoom, footer, children }: { zoom: number; footer: string; children: ReactNode }) {
  const paper = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(1)

  useLayoutEffect(() => {
    const el = paper.current
    if (!el) return
    let raf = 0
    const isBlock = (n: Element) => { const d = getComputedStyle(n).display; return d.startsWith('block') || d === 'flex' || d === 'grid' || d === 'list-item' }
    const atomsOf = (root: Element): HTMLElement[] => {
      const out: HTMLElement[] = []
      const walk = (n: Element) => { for (const ch of Array.from(n.children)) { if (!isBlock(ch)) continue; if (ch.classList.contains('a4-keep')) { out.push(ch as HTMLElement); continue } if (Array.from(ch.children).some(isBlock)) walk(ch); else out.push(ch as HTMLElement) } }
      walk(root); return out
    }
    const reflow = () => {
      const atoms = atomsOf(el)
      atoms.forEach(a => { a.style.marginTop = '' })
      const maxAtomH = PAGE_H - MB - MT
      let page = 0
      for (const a of atoms) {
        const top = a.offsetTop, h = a.offsetHeight
        if (top + h > (page + 1) * PAGE_H - MB && h <= maxAtomH) {
          const add = ((page + 1) * PAGE_H + GAP + MT) - top
          if (add > 0) { const base = parseFloat(getComputedStyle(a).marginTop) || 0; a.style.marginTop = `${base + add}px` }
          page += 1
        }
        let bottom = a.offsetTop + a.offsetHeight
        while (bottom > (page + 1) * PAGE_H - MB && page < 80) { page += 1; bottom = a.offsetTop + a.offsetHeight }
      }
      setPages(Math.max(1, page + 1))
    }
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(reflow) }
    run()
    const ro = new ResizeObserver(run); ro.observe(el)
    el.addEventListener('input', run, true)
    window.addEventListener('resize', run)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); el.removeEventListener('input', run, true); window.removeEventListener('resize', run) }
  }, [])

  return (
    <div className="origin-top" style={{ transform: `scale(${zoom / 100})` }}>
      <div ref={paper} className="a4-paper rounded-lg border shadow-sm" style={{ minHeight: pages * PAGE_H }}>
        {children}
        {Array.from({ length: pages - 1 }).map((_, i) => (
          <div key={i} className="a4-gap" style={{ top: (i + 1) * PAGE_H }}><span className="a4-gap-label">Страница {i + 2}</span></div>
        ))}
        {Array.from({ length: pages }).map((_, i) => (
          <div key={`pf${i}`} className="a4-pagefoot" style={{ top: (i + 1) * PAGE_H - 40 }}>
            <span>{footer}</span><span>страница {i + 1} из {pages}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Use `PagedSheet` in `A4Document.tsx`** — replace the inline white `<div ref={sheet} ... style={{transform}}>` sheet with `PagedSheet`, keeping the `sheet` ref on the paper (so print + save-validation still find `[data-section-tag]`). Restructure the sheet body: wrap the doc header, each section, and the inline footer as children; give the header and each `A4Section` an `a4-keep` wrapper so pagination treats them as atoms:
```tsx
// imports: import { PagedSheet } from './PagedSheet'
// remove the old zoom `transform` wrapper on the sheet; PagedSheet owns zoom + the paper.
// pass the paper ref down: add a `paperRef` prop to PagedSheet ({ paperRef?: ... }) OR
// keep `sheet` by querying: since PagedSheet owns the paper ref, expose it — simplest:
// give PagedSheet a `contentRef` forwarded to its `.a4-paper` div, and pass `sheet` as that ref.
```
Concretely: add `contentRef?: React.Ref<HTMLDivElement>` to `PagedSheet` props and set it on the `.a4-paper` div via a merged ref (assign both the internal `paper` ref and the forwarded `contentRef` using a callback ref). Then in `A4Document`, render:
```tsx
<PagedSheet zoom={zoom} contentRef={sheet} footer={CLINIC_FOOTER}>
  <div className="a4-keep mb-4 text-center">
    <div className="text-base font-semibold">{DOC_TYPES[docType].name}</div>
    <div className="mt-1 text-xs text-muted-foreground">{patient.name} · {ruAge(patient.age)} · {patient.sex === 'Ж' ? 'жен.' : 'муж.'} · ID {patient.id}</div>
    <div className="text-xs text-muted-foreground">{patient.service}</div>
  </div>
  {sections.map(s => <div key={s} className="a4-keep mb-3"><A4Section ru={s} uz={SECTION_UZ[s]} /></div>)}
</PagedSheet>
```
(Move zoom controls to stay in the toolbar row; PagedSheet applies the scale. The `sheet` ref still points at the `.a4-paper`, so `handleSave` and print keep working.)

- [ ] **Step 5: Gate + commit** — `npm run verify` green (jsdom renders 1 page, no crash; the ConsultationPage smoke test still passes). Commit: `git add -A && git commit -m "feat(doctor): A4 on-screen pagination (PagedSheet)"`

---

### Task 3: Print flow (PrintModal + doPrint + print CSS)

**Files:** `PrintModal.tsx`, `PrintModal.test.tsx`, `A4Document.tsx` (Print button + doPrint), `src/index.css` (print styles).

- [ ] **Step 1: Print styles** — append to `src/index.css`:
```css
/* --- print: show only the cloned document --- */
@media print {
  body.is-printing #root { display: none !important; }
  .print-doc-root { position: static !important; left: 0 !important; width: auto !important; }
  .print-doc-root .a4-paper { border: 0 !important; box-shadow: none !important; min-height: auto !important; }
  .a4-gap, .a4-pagefoot { display: none !important; }
}
.np { display: none !important; }
```

- [ ] **Step 2: `PrintModal.tsx`** (ported from prototype PrintModal; design-system Dialog + Checkbox):
```tsx
import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export interface PrintSection { tag: string; label: string; filled: boolean }

export function PrintModal({ sections, onClose, onPrint }: { sections: PrintSection[]; onClose: () => void; onPrint: (sel: Record<string, boolean>) => void }) {
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map(s => [s.tag, true])))
  const setAll = (v: boolean) => setSel(Object.fromEntries(sections.map(s => [s.tag, v])))
  const onlyFilled = () => setSel(Object.fromEntries(sections.map(s => [s.tag, s.filled])))
  const count = sections.filter(s => sel[s.tag]).length
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Печать документа</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Отметьте блоки, которые войдут в печатную форму. Шапка и данные пациента печатаются всегда.</p>
        <div className="max-h-72 space-y-1 overflow-auto">
          {sections.map(s => (
            <label key={s.tag} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
              <Checkbox checked={!!sel[s.tag]} onCheckedChange={() => setSel(p => ({ ...p, [s.tag]: !p[s.tag] }))} />
              <span className="flex-1 text-sm">{s.label}</span>
              <span className={`text-xs ${s.filled ? 'text-primary' : 'text-muted-foreground'}`}>{s.filled ? 'заполнено' : 'пусто'}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onlyFilled}>Только заполненные</Button>
          <Button variant="secondary" size="sm" onClick={() => setAll(true)}>Отметить все</Button>
          <Button variant="secondary" size="sm" onClick={() => setAll(false)}>Снять все</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button disabled={count === 0} onClick={() => onPrint(sel)}><Printer className="size-4" />Печать ({count})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire print into `A4Document.tsx`** — add a Print button (in the toolbar row), build the section list from the live sheet, and `doPrint` (ported from prototype doPrint L964–998):
```tsx
// state: const [printSecs, setPrintSecs] = useState<PrintSection[] | null>(null)
// import { PrintModal, type PrintSection } from './PrintModal'; import { Printer } from 'lucide-react'
// import { REQUIRED_FIELDS } from '@/domain/consultation' is already there

const docBlocks = () => {
  const root = sheet.current
  return sections.map(tag => {
    const body = root?.querySelector(`[data-section-tag="${tag}"]`)
    const el = body?.closest('.a4-keep') as HTMLElement | null
    return { tag, label: tag.charAt(0) + tag.slice(1).toLowerCase(), filled: !!body?.textContent?.trim(), el }
  })
}
const openPrint = () => setPrintSecs(docBlocks().map(({ tag, label, filled }) => ({ tag, label, filled })))
const doPrint = (sel: Record<string, boolean>) => {
  setPrintSecs(null)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const root = sheet.current; if (!root) return
    docBlocks().forEach(b => { if (b.el) b.el.classList.toggle('np', sel[b.tag] === false) })
    const clone = root.cloneNode(true) as HTMLElement
    clone.style.minHeight = 'auto'
    clone.querySelectorAll('.a4-gap, .a4-pagefoot').forEach(el => el.remove())
    clone.querySelectorAll<HTMLElement>('*').forEach(el => { if (el.style?.marginTop) el.style.marginTop = '' })
    const wrap = document.createElement('div'); wrap.className = 'print-doc-root'
    wrap.style.cssText = 'position:absolute; left:-99999px; top:0; width:794px;'
    wrap.appendChild(clone); document.body.appendChild(wrap)
    const pageSt = document.createElement('style'); pageSt.textContent = '@media print{ @page{ size: A4 portrait; margin: 14mm; } }'
    document.head.appendChild(pageSt)
    document.body.classList.add('is-printing')
    const cleanup = () => { document.body.classList.remove('is-printing'); wrap.remove(); pageSt.remove(); root.querySelectorAll('.np').forEach(e => e.classList.remove('np')) }
    window.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(cleanup, 60000)
    window.print()
  }))
}
// in the toolbar row, next to Save: <Button variant="outline" size="sm" onClick={openPrint}><Printer className="size-4" />Печать</Button>
// before the closing </div> of the component: {printSecs && <PrintModal sections={printSecs} onClose={() => setPrintSecs(null)} onPrint={doPrint} />}
```

- [ ] **Step 4: Smoke test** `PrintModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PrintModal } from './PrintModal'

describe('PrintModal (smoke)', () => {
  it('mounts with no axe violations', async () => {
    const { baseElement, getByText } = render(
      <PrintModal sections={[{ tag: 'ЖАЛОБЫ', label: 'Жалобы', filled: true }, { tag: 'ОСМОТР', label: 'Осмотр', filled: false }]} onClose={() => {}} onPrint={() => {}} />
    )
    expect(getByText('Печать документа')).toBeTruthy()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
```

- [ ] **Step 5: Gate + commit** — `npm run verify` green (PrintModal + toolbar smoke + prior). Commit: `git add -A && git commit -m "feat(doctor): consultation print flow (PrintModal + A4 system print)"`

---

### Task 4: Full gate + screenshot + checkpoint
- [ ] **Step 1:** `npm run verify && npm run build` — all green; report counts.
- [ ] **Step 2: Manual** — `npm run dev`; open a consultation: the toolbar formats selected text in a section (bold/list/color), the sheet shows page bands when content is long, "Печать" opens the section picker and a browser print preview shows the A4 document only (no app chrome). Stop dev.
- [ ] **Step 3: Commit** any final touch: `git add -A && git commit -m "chore: rich-text + print gate green"`.
(Controller then screenshots the toolbar/document for the owner.)

---

## Self-Review (plan author)

**Spec coverage:** Delivers the two deferred consultation features named in Plan 2's roadmap: rich-text formatting toolbar (Task 1) and A4 print/pagination (Tasks 2–3). Ported verbatim from the prototype's FmtToolbar/PagedSheet/PrintModal/doPrint; re-skinned onto design-system Popover/Dialog/Checkbox/Button; Russian copy kept; no emojis. Blue card-insert buttons + image/table remain deferred to Plan 4/5 (depend on the pickers) — called out.

**Placeholder scan:** No TODOs. The `contentRef` merged-ref instruction (Task 2 Step 4) is a concrete technique (callback ref assigning both internal + forwarded ref) — the implementer writes the small callback. Browser-only behavior is explicitly untestable-in-jsdom and gated by smoke render + owner visual check (stated up front) — not hand-waving, an accurate constraint.

**Type consistency:** `PrintSection` defined in `PrintModal.tsx`, imported by `A4Document`. `doPrint(sel: Record<string, boolean>)` matches `PrintModal`'s `onPrint`. `sheet` ref (existing, on `.a4-paper` via PagedSheet `contentRef`) is read by `handleSave` (Plan 2) and `docBlocks`/`doPrint` — the `[data-section-tag]` + `.a4-keep` selectors match what `A4Section`/the section wrappers render. `execCommand` uses the standard DOM signature.

**Scope:** Two coherent features on the existing consultation; smoke-testable at the render level, visually validated. No cross-module impact.
