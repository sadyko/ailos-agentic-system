# Aurora Redesign — Plan 9: Document draft save/restore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation document's "Сохранить" actually persist: save each section's rich HTML to localStorage (keyed by patient + document type) and restore it when the consultation is reopened or the document type is switched back. Adds a "Сохранено HH:MM" indicator.

**Architecture:** A `src/services/drafts.ts` seam (localStorage `aurora.his.drafts`) with `saveDraft`/`loadDraft`. `A4Section` renders its section body from an HTML `value` (via `dangerouslySetInnerHTML`). `A4Document` loads the draft **synchronously** (localStorage is sync, so sections render restored on first paint — no re-render clobbering the contentEditable), keys sections by `docType:tag` so switching type reloads, and `handleSave` reads each section's `innerHTML` and persists it. Ported from prototype `consultation.jsx` (handleSave/localStorage drafts L1001–1035, L2185–2225) — simplified to draft-only (publish/version history is a later plan).

**Tech Stack:** React 19, TS, Vitest (jsdom localStorage). No new components.

**Testability:** the draft service is unit-tested (TDD, clearing storage per test). The A4 changes are covered by the existing `ConsultationPage` smoke test staying green.

**Reference:** prototype `consultation.jsx`. Prior: Plans 1–8.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis.

## File Structure (this plan)
```
src/services/drafts.ts             # saveDraft/loadDraft (localStorage aurora.his.drafts)
src/services/drafts.test.ts        # save/restore + isolation (TDD)
src/features/doctor/consultation/A4Section.tsx    # render HTML value
src/features/doctor/consultation/A4Document.tsx   # load/restore/save draft + indicator
```

---

### Task 1: Draft service (TDD)

**Files:** `src/services/drafts.ts`, `src/services/drafts.test.ts`.

- [ ] **Step 1: Failing tests** `src/services/drafts.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft } from './drafts'

describe('document drafts', () => {
  beforeEach(() => { localStorage.clear() })
  it('loadDraft returns {} when nothing saved', () => {
    expect(loadDraft(1, 0)).toEqual({})
  })
  it('saveDraft then loadDraft round-trips the body', () => {
    saveDraft(195247, 0, { 'ЖАЛОБЫ': '<b>боль</b>', 'ОСМОТР': 'норма' })
    expect(loadDraft(195247, 0)).toEqual({ 'ЖАЛОБЫ': '<b>боль</b>', 'ОСМОТР': 'норма' })
  })
  it('drafts are isolated by patient + docType', () => {
    saveDraft(195247, 0, { 'ЖАЛОБЫ': 'a' })
    saveDraft(195247, 1, { 'ПОКАЗАНИЯ': 'b' })
    saveDraft(161000, 0, { 'ЖАЛОБЫ': 'c' })
    expect(loadDraft(195247, 0)).toEqual({ 'ЖАЛОБЫ': 'a' })
    expect(loadDraft(195247, 1)).toEqual({ 'ПОКАЗАНИЯ': 'b' })
    expect(loadDraft(161000, 0)).toEqual({ 'ЖАЛОБЫ': 'c' })
  })
})
```

- [ ] **Step 2: Run — FAIL:** `npm run test -- drafts`

- [ ] **Step 3: Implement** `src/services/drafts.ts`:
```ts
export type DraftBody = Record<string, string> // section tag -> section innerHTML

const KEY = 'aurora.his.drafts'
type Store = Record<string, DraftBody> // `${patientId}:${docType}` -> body

function loadAll(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store } catch { return {} }
}
export function saveDraft(patientId: number, docType: number, body: DraftBody): void {
  const s = loadAll(); s[`${patientId}:${docType}`] = body
  localStorage.setItem(KEY, JSON.stringify(s))
}
export function loadDraft(patientId: number, docType: number): DraftBody {
  return loadAll()[`${patientId}:${docType}`] ?? {}
}
```

- [ ] **Step 4: Run — PASS:** `npm run test -- drafts`
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): document draft service (localStorage) (TDD)"`

---

### Task 2: A4Section HTML value + A4Document load/save/restore

**Files:** `A4Section.tsx`, `A4Document.tsx`.

- [ ] **Step 1: `A4Section` renders an HTML value** — read the current file and change ONLY the editable body `<div>` so it renders `value` as HTML (keep the memo, the tag header, and all the existing attributes — `contentEditable`, `suppressContentEditableWarning`, `role="textbox"`, `aria-multiline`, `aria-label={ru}`, `data-section-tag={ru}`). Replace `{value}` children with `dangerouslySetInnerHTML`:
```tsx
<div
  className="min-h-14 px-3 py-2 text-sm outline-none focus:bg-background"
  contentEditable
  suppressContentEditableWarning
  role="textbox"
  aria-multiline="true"
  aria-label={ru}
  data-section-tag={ru}
  dangerouslySetInnerHTML={{ __html: value }}
/>
```
(`value` still defaults to `''`, so empty sections render empty. Keep the `memo` wrapper and the `ru`/`uz`/`value` props.)

- [ ] **Step 2: `A4Document` — load/restore/save the draft.** Read the current file. It has `const [docType, setDocType] = useState(0)`, `const [zoom, setZoom] = useState(...)`, `const sheet = useRef<HTMLDivElement>(null)`, `const sections = secsFor(docType)`, a `handleSave` (validates required fields → notify), a `DocTypeSelect` with `onChange={setDocType}`, and renders `{sections.map(s => <div key={s} className="a4-keep mb-3"><A4Section ru={s} uz={SECTION_UZ[s]} /></div>)}` inside `PagedSheet`. Make these changes:
  1. Import the draft service: `import { saveDraft, loadDraft } from '@/services/drafts'`.
  2. Add draft + saved-time state (load synchronously for the initial docType):
```tsx
const [draft, setDraft] = useState<Record<string, string>>(() => loadDraft(patient.id, 0))
const [savedAt, setSavedAt] = useState<string | null>(null)
```
  3. When the document type changes, reload that type's draft and clear the indicator. Replace the DocTypeSelect `onChange`:
```tsx
<DocTypeSelect value={docType} onChange={(i) => { setDocType(i); setDraft(loadDraft(patient.id, i)); setSavedAt(null) }} />
```
  4. Restore into the sections — key them by `docType` so switching type remounts with the right content, and pass the saved HTML:
```tsx
{sections.map(s => <div key={`${docType}:${s}`} className="a4-keep mb-3"><A4Section ru={s} uz={SECTION_UZ[s]} value={draft[s] ?? ''} /></div>)}
```
  5. Extend `handleSave` to persist the section HTML after validation passes, and set the indicator. Inside `handleSave`, after the `if (missing.length) { ... return }` guard, add before the final notify:
```tsx
const body: Record<string, string> = {}
sections.forEach(tag => { const el = root?.querySelector(`[data-section-tag="${tag}"]`); if (el) body[tag] = el.innerHTML })
saveDraft(patient.id, docType, body)
const now = new Date(); const hh = String(now.getHours()).padStart(2, '0'); const mm = String(now.getMinutes()).padStart(2, '0')
setSavedAt(`${hh}:${mm}`)
```
(keep the existing `notify('Документ сохранён')`.)
  6. Show the indicator next to the Save button in the toolbar row (after the "Сохранить" button):
```tsx
{savedAt && <span className="text-xs text-muted-foreground">Черновик сохранён · {savedAt}</span>}
```

- [ ] **Step 3: Gate** — `npm run verify` green. The `ConsultationPage` smoke test renders with empty localStorage → `loadDraft` returns `{}` → sections render empty (no axe change). If a prior test left `aurora.his.drafts` in localStorage and affects the smoke test, add `beforeEach(() => localStorage.clear())` to `consultation.test.tsx` (only if needed).
- [ ] **Step 4: Manual** — `npm run dev`: open a patient, type into ЖАЛОБЫ/ОСМОТР/РЕКОМЕНДАЦИИ, click "Сохранить" → "Черновик сохранён · HH:MM"; go back to the queue and reopen the SAME patient → the text is restored; switch document type and back → each type keeps its own draft. (Stored under localStorage `aurora.his.drafts`; clear that key to reset.) Stop dev.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doctor): document draft save + restore (per patient + doc type)"`

---

### Task 3: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2:** (Controller) screenshot the document after typing + saving (showing the "Черновик сохранён" indicator).

---

## Self-Review (plan author)

**Spec coverage:** Completes the document Save flow (previously validate+toast only): sections now persist to localStorage per patient+docType (Task 1, TDD) and restore on reopen / type-switch (Task 2), with a saved indicator. Synchronous localStorage load means sections render restored on first paint — no contentEditable clobber. Publish + version history (the fuller draft/history system) remains a later plan, as do hints, past-results, revisit/admission.

**Placeholder scan:** No TODOs. Service + wiring fully specified. The optional `beforeEach` note is a conditional safety instruction, not a gap.

**Type consistency:** `DraftBody = Record<string,string>` (tag→HTML) in `drafts.ts`; `saveDraft(patientId, docType, body)`/`loadDraft(patientId, docType)` used by `A4Document` with `patient.id` + `docType`. `A4Section`'s `value` (HTML string, default '') fed from `draft[s] ?? ''`. Section key `${docType}:${tag}` remounts on type change. `handleSave` reads `innerHTML` matching what `saveDraft` stores + `A4Section` renders.

**Scope:** One coherent behaviour (draft persistence), service-unit-tested + wired, visually verifiable (type → save → reopen → restored).
