# Aurora Redesign — Plan 11: Publish + document version history

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Complete the document lifecycle: an "Опубликовать" action snapshots the document into a persistent history (`aurora.his.history`); a right-panel "История документов" lists the patient's published versions (date/time, title, author, Опубликован/Исправление badge) and can fill the current document from any version.

**Architecture:** A `src/services/history.ts` seam (localStorage): `publishDocument(patientId, docType, title, body)` appends an entry (auto `amend` flag when an earlier version of the same patient+docType exists); `loadPatientHistory(patientId)` returns entries newest-first. `A4Document` gains an "Опубликовать" button (same required-field validation; also refreshes the draft) plus a `restoreReq` prop that fills sections from a history snapshot (switching docType and bumping a `revision` key so the contentEditable sections remount with the restored HTML). `HistoryPanel` (right column, under ActionButtons) lists entries and requests restores; `ConsultationPage` wires publish→refresh and restore→A4Document. Ported from prototype `consultation.jsx` (HISTORY_KEY/persistence L2203–2225, version grouping + DOC_ST L1832–1876), simplified: publish = append version (read-only/amend-mode deferred).

**Tech Stack:** React 19, TS, Vitest (jsdom localStorage), design-system `Badge`/`Button`, lucide-react.

**Testability:** the history service is pure-ish → TDD. `HistoryPanel` gets a smoke test (empty + one published entry). A4/ConsultationPage wiring covered by existing smoke tests staying green.

**Reference:** prototype `consultation.jsx`. Prior: Plans 1–10 (esp. Plan 9 drafts).

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

## File Structure (this plan)
```
src/services/history.ts             # HistoryEntry, publishDocument, loadPatientHistory, fmtDate, fmtTime
src/services/history.test.ts        # TDD
src/features/doctor/consultation/
  HistoryPanel.tsx                  # right-panel version list + restore
  HistoryPanel.test.tsx             # smoke (empty + listed entry)
  A4Document.tsx                    # + Опубликовать, restoreReq, revision key, onPublished
  ConsultationPage.tsx              # wire publish-tick + restore request
```

---

### Task 1: History service (TDD)

**Files:** `src/services/history.ts`, `src/services/history.test.ts`.

- [ ] **Step 1: Failing tests** `src/services/history.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { publishDocument, loadPatientHistory, fmtDate, fmtTime } from './history'

describe('document history', () => {
  beforeEach(() => { localStorage.clear() })
  it('loadPatientHistory returns [] when nothing published', () => {
    expect(loadPatientHistory(1)).toEqual([])
  })
  it('publishDocument appends an entry retrievable per patient', () => {
    publishDocument(195247, 0, 'Приём (осмотр, консультация)', { 'ЖАЛОБЫ': 'x' })
    const list = loadPatientHistory(195247)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Приём (осмотр, консультация)')
    expect(list[0].amend).toBe(false)
    expect(list[0].body).toEqual({ 'ЖАЛОБЫ': 'x' })
  })
  it('a second publish of the same patient+docType is an amendment, newest first', () => {
    publishDocument(195247, 0, 'Приём (осмотр, консультация)', { 'ЖАЛОБЫ': 'v1' }, 1000)
    publishDocument(195247, 0, 'Приём (осмотр, консультация)', { 'ЖАЛОБЫ': 'v2' }, 2000)
    const list = loadPatientHistory(195247)
    expect(list).toHaveLength(2)
    expect(list[0].body['ЖАЛОБЫ']).toBe('v2')
    expect(list[0].amend).toBe(true)
    expect(list[1].amend).toBe(false)
  })
  it('history is isolated per patient; different docType is not an amendment', () => {
    publishDocument(195247, 0, 'A', { 'ЖАЛОБЫ': 'a' })
    publishDocument(161000, 0, 'B', { 'ЖАЛОБЫ': 'b' })
    publishDocument(195247, 1, 'C', { 'ПОКАЗАНИЯ': 'c' })
    expect(loadPatientHistory(195247)).toHaveLength(2)
    expect(loadPatientHistory(161000)).toHaveLength(1)
    expect(loadPatientHistory(195247).find(e => e.docType === 1)!.amend).toBe(false)
  })
  it('fmtDate/fmtTime format a timestamp', () => {
    const ts = new Date(2026, 5, 4, 9, 5).getTime()
    expect(fmtDate(ts)).toBe('04.06.2026')
    expect(fmtTime(ts)).toBe('09:05')
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- history`

- [ ] **Step 3: Implement** `src/services/history.ts`:
```ts
import type { DraftBody } from './drafts'

export interface HistoryEntry {
  id: string
  patientId: number
  docType: number
  title: string
  savedAt: number
  by: string
  amend: boolean
  body: DraftBody
}

const KEY = 'aurora.his.history'
const CUR_DOCTOR = 'Казанцева Н. В.'

function loadAll(): HistoryEntry[] {
  try { const l = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(l) ? (l as HistoryEntry[]) : [] } catch { return [] }
}

export function publishDocument(patientId: number, docType: number, title: string, body: DraftBody, now: number = Date.now()): HistoryEntry {
  const all = loadAll()
  const amend = all.some(e => e.patientId === patientId && e.docType === docType)
  const entry: HistoryEntry = { id: `${patientId}:${docType}:${now}`, patientId, docType, title, savedAt: now, by: CUR_DOCTOR, amend, body }
  all.push(entry)
  localStorage.setItem(KEY, JSON.stringify(all))
  return entry
}

export function loadPatientHistory(patientId: number): HistoryEntry[] {
  return loadAll().filter(e => e.patientId === patientId).sort((a, b) => b.savedAt - a.savedAt)
}

export function fmtDate(ts: number): string {
  const d = new Date(ts), z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}`
}
export function fmtTime(ts: number): string {
  const d = new Date(ts), z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getHours())}:${z(d.getMinutes())}`
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- history`
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): document history service (publish + versions) (TDD)"`

---

### Task 2: Publish button + HistoryPanel + restore wiring

**Files:** `A4Document.tsx`, `HistoryPanel.tsx`, `HistoryPanel.test.tsx`, `ConsultationPage.tsx`.

- [ ] **Step 1: `A4Document` — publish + restore.** Read the current file. It has `docType`/`draft`/`savedAt` state, `sheet` ref, `handleSave` (validate → saveDraft → indicator → notify), sections keyed `${docType}:${s}`. Make these changes:
  1. Props: change the signature to accept the new optional props:
```tsx
export function A4Document({ patient, notify, restoreReq, onPublished }: {
  patient: Patient
  notify: (m: string, t?: 'ok' | 'warn') => void
  restoreReq?: { body: Record<string, string>; docType: number; n: number } | null
  onPublished?: () => void
}) {
```
  2. Imports: `import { useEffect, useRef, useState } from 'react'` (add useEffect if missing); `import { publishDocument } from '@/services/history'`; add `Send` to the lucide-react import.
  3. State: add `const [revision, setRevision] = useState(0)`.
  4. Section keys: change to `key={`${docType}:${revision}:${s}`}` (same map, revision added).
  5. Restore effect (after the state declarations):
```tsx
useEffect(() => {
  if (!restoreReq) return
  setDocType(restoreReq.docType)
  setDraft(restoreReq.body)
  setSavedAt(null)
  setRevision(v => v + 1)
  notify('Документ заполнен из истории')
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [restoreReq?.n])
```
  6. Extract the body-collection used by `handleSave` into a helper and add `handlePublish` (same validation; publishes AND saves the draft):
```tsx
const collectBody = (root: HTMLDivElement | null): Record<string, string> => {
  const body: Record<string, string> = {}
  sections.forEach(tag => { const el = root?.querySelector(`[data-section-tag="${tag}"]`); if (el) body[tag] = el.innerHTML })
  return body
}
const validateMissing = (root: HTMLDivElement | null) => REQUIRED_FIELDS.filter(f => {
  const el = root?.querySelector(`[data-section-tag="${f.tag}"]`)
  return !el || !el.textContent?.trim()
})
const handlePublish = () => {
  const root = sheet.current
  const missing = validateMissing(root)
  if (missing.length) { notify(`Заполните: ${missing.map(m => m.label).join(', ')}`, 'warn'); return }
  const body = collectBody(root)
  saveDraft(patient.id, docType, body)
  publishDocument(patient.id, docType, DOC_TYPES[docType].name, body)
  const now = new Date(); const hh = String(now.getHours()).padStart(2, '0'); const mm = String(now.getMinutes()).padStart(2, '0')
  setSavedAt(`${hh}:${mm}`)
  notify('Документ опубликован')
  onPublished?.()
}
```
   Refactor `handleSave` to reuse `validateMissing` + `collectBody` (behaviour unchanged).
  7. Toolbar: add after the "Сохранить" button: `<Button variant="secondary" size="sm" onClick={handlePublish}><Send className="size-4" />Опубликовать</Button>` (keep the Печать button and the savedAt indicator).

- [ ] **Step 2: `HistoryPanel.tsx`**:
```tsx
import { useEffect, useState } from 'react'
import { History, FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { loadPatientHistory, fmtDate, fmtTime, type HistoryEntry } from '@/services/history'
import type { DraftBody } from '@/services/drafts'

export function HistoryPanel({ patientId, refresh, onRestore }: { patientId: number; refresh: number; onRestore: (e: { body: DraftBody; docType: number }) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  useEffect(() => { setEntries(loadPatientHistory(patientId)) }, [patientId, refresh])
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><History className="size-3.5" />История документов</div>
      {entries.length === 0 && <p className="text-xs text-muted-foreground">Опубликованных документов нет.</p>}
      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="rounded-md border p-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(e.savedAt)} · {fmtTime(e.savedAt)}</span>
              <Badge variant={e.amend ? 'default' : 'secondary'} className="ml-auto text-[10px]">{e.amend ? 'Исправление' : 'Опубликован'}</Badge>
            </div>
            <div className="mt-1 truncate">{e.title}</div>
            <div className="text-xs text-muted-foreground">{e.by}</div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => onRestore({ body: e.body, docType: e.docType })}><FileDown className="size-3.5" />Заполнить документ</Button>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Wire `ConsultationPage.tsx`.** Read the current file. Add imports (`HistoryPanel`, and `useState` already there). Add state:
```tsx
const [histTick, setHistTick] = useState(0)
const [restoreReq, setRestoreReq] = useState<{ body: Record<string, string>; docType: number; n: number } | null>(null)
```
Change the center column's A4Document to pass the new props:
```tsx
<A4Document patient={patient} notify={notify} restoreReq={restoreReq} onPublished={() => setHistTick(t => t + 1)} />
```
Add `HistoryPanel` in the right column under `ActionButtons`:
```tsx
<HistoryPanel patientId={patient.id} refresh={histTick} onRestore={(e) => setRestoreReq(r => ({ ...e, n: (r?.n ?? 0) + 1 }))} />
```

- [ ] **Step 4: Smoke test** `HistoryPanel.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HistoryPanel } from './HistoryPanel'
import { publishDocument } from '@/services/history'

describe('HistoryPanel (smoke)', () => {
  beforeEach(() => { localStorage.clear() })
  it('shows the empty state with no axe violations', async () => {
    const { container, getByText } = render(<HistoryPanel patientId={1} refresh={0} onRestore={() => {}} />)
    expect(getByText('Опубликованных документов нет.')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
  it('lists a published document', () => {
    publishDocument(1, 0, 'Приём (осмотр, консультация)', { 'ЖАЛОБЫ': 'x' })
    const { getByText } = render(<HistoryPanel patientId={1} refresh={0} onRestore={() => {}} />)
    expect(getByText('Приём (осмотр, консультация)')).toBeTruthy()
    expect(getByText('Опубликован')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Gate + commit** — `npm run verify && npm run build` green (history service + HistoryPanel tests + ConsultationPage smoke + all prior; if the ConsultationPage smoke breaks on leftover history entries, add `beforeEach(() => localStorage.clear())` there). Commit: `git add -A && git commit -m "feat(doctor): publish document + version history panel with restore"`

---

### Task 3: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2:** (Controller) screenshot: fill + publish → history entry appears; publish again → "Исправление" version listed.

---

## Self-Review (plan author)

**Spec coverage:** Completes the document lifecycle deferred from Plan 9: publish (validated snapshot → persistent history with version/amend semantics, Task 1 TDD; A4 button Task 2), a right-panel history list (date/time/title/author/status badge), and fill-from-version restore (docType switch + revision-keyed remount so contentEditable renders the restored HTML). Ported from the prototype's history model, simplified: read-only/amend-mode + the full HistoryFullModal search remain deferred, as do hints/past-results.

**Placeholder scan:** No TODOs. All code complete. The `restoreReq?.n` effect-dep with the eslint-disable is deliberate (fire per request).

**Type consistency:** `HistoryEntry`/`publishDocument(patientId, docType, title, body, now?)`/`loadPatientHistory` in `history.ts` match tests + callers. `DraftBody` reused from `drafts.ts`. `A4Document`'s new props match what `ConsultationPage` passes; `HistoryPanel`'s `onRestore({body, docType})` feeds `setRestoreReq` which adds `n`. `DOC_TYPES[docType].name` exists (`domain/consultation`). `saveDraft` reused from Plan 9.

**Scope:** One coherent lifecycle feature (publish → history → restore), service-unit-tested, panel smoke-tested, visually verifiable.
