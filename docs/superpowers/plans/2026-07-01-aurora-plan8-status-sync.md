# Aurora Redesign — Plan 8: Consultation status ↔ queue sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the consultation update the patient's visit status so the worklist reflects it: opening a queued patient marks them "Идёт приём", pausing → "Пауза", finishing → "Осмотрен" — visible in the queue + summary cards when you go back. Done through the service seam (localStorage-backed status overrides), so it survives navigation between routes.

**Architecture:** Add a small persistent status-override layer to `src/services/doctor.ts` (localStorage), applied by `getQueue`/`getPatient`. `ConsultationPage` initializes its status from the loaded patient, promotes a `queue`/`invited` patient to `now` on open, and persists every status change (pause/finish) via `setPatientStatus`. The worklist re-reads on navigation (its `useEffect` runs on mount), so returning shows the new status. Ported behaviour from prototype `app.jsx` (in-place `p.status` mutation) — here it's a typed service override.

**Tech Stack:** React 19, TS, Vitest (jsdom `localStorage`). No new components.

**Testability:** the override service is pure-ish (localStorage) → unit-tested (TDD, clearing storage per test). The wiring is covered by the existing `ConsultationPage`/`Worklist` smoke tests staying green.

**Reference:** prototype `app.jsx`. Prior: Plans 1–7.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis.

## File Structure (this plan)
```
src/services/doctor.ts          # + status overrides (localStorage) applied in getQueue/getPatient; setPatientStatus
src/services/doctor.test.ts     # override behaviour (TDD)
src/features/doctor/consultation/ConsultationPage.tsx  # init/promote/persist status
```

---

### Task 1: Service status overrides (TDD)

**Files:** `src/services/doctor.ts` (extend), `src/services/doctor.test.ts` (extend).

- [ ] **Step 1: Add failing tests** to `src/services/doctor.test.ts` (append a new describe; keep existing tests). At the top add `import { beforeEach } ...` if not present and clear storage:
```ts
import { setPatientStatus } from './doctor'

describe('doctor service — status overrides', () => {
  beforeEach(() => { localStorage.clear() })
  it('setPatientStatus overrides a patient status in getQueue', async () => {
    // 195247 is a reference-day (day 0) patient, initially "now"
    await setPatientStatus(195247, 'done')
    const rows = await getQueue(0)
    expect(rows.find(p => p.id === 195247)!.status).toBe('done')
  })
  it('getPatient reflects an override', async () => {
    await setPatientStatus(188903, 'paused')
    const p = await getPatient(188903)
    expect(p!.status).toBe('paused')
  })
  it('getDaySummary counts an overridden done patient', async () => {
    const before = await getDaySummary(0)
    await setPatientStatus(188903, 'done') // was "queue"
    const after = await getDaySummary(0)
    expect(after.done).toBe(before.done + 1)
  })
})
```
(Ensure `getQueue`, `getPatient`, `getDaySummary` are imported in the test file — they already are from the existing tests; add `setPatientStatus` + `beforeEach`.)

- [ ] **Step 2: Run — FAIL:** `npm run test -- services/doctor`

- [ ] **Step 3: Implement** in `src/services/doctor.ts` — add the override layer and apply it. Keep `getQueue`/`getDaySummary` behaviour but map through overrides; add `getPatient` override + `setPatientStatus`:
```ts
import type { Patient, DaySummary, PatientStatus } from '@/domain/types'
import { PATIENTS, REC_SERVICES } from '@/data/doctor'

const STATUS_KEY = 'aurora.patientStatus'
function loadOverrides(): Record<number, PatientStatus> {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}') as Record<number, PatientStatus> } catch { return {} }
}
export async function setPatientStatus(id: number, status: PatientStatus): Promise<void> {
  const o = loadOverrides(); o[id] = status
  localStorage.setItem(STATUS_KEY, JSON.stringify(o))
}
function applyOverride(p: Patient, o: Record<number, PatientStatus>): Patient {
  return o[p.id] ? { ...p, status: o[p.id] } : p
}

export async function getQueue(dayOffset: number): Promise<Patient[]> {
  const o = loadOverrides()
  return PATIENTS.filter(p => (p.day ?? 0) === dayOffset).map(p => applyOverride(p, o))
}

export async function getPatient(id: number): Promise<Patient | undefined> {
  const o = loadOverrides()
  const p = PATIENTS.find(x => x.id === id)
  return p ? applyOverride(p, o) : undefined
}

export async function getDaySummary(dayOffset: number): Promise<DaySummary> {
  const day = await getQueue(dayOffset)
  return {
    queue: day.filter(p => p.status === 'queue' || p.status === 'invited' || p.status === 'now').length,
    done: day.filter(p => p.status === 'done').length,
    recs: REC_SERVICES.length,
    recsDone: REC_SERVICES.filter(r => r.status === 'Выполнено').length,
  }
}
```
(This replaces the existing `getQueue`/`getPatient`/`getDaySummary` bodies with override-aware versions; the exports/signatures are unchanged. `PatientStatus` is imported from `@/domain/types`.)

- [ ] **Step 4: Run — PASS:** `npm run test -- services/doctor`
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat(doctor): persistent patient-status overrides in the service (TDD)"`

---

### Task 2: Wire the consultation to set status

**Files:** `src/features/doctor/consultation/ConsultationPage.tsx`.

- [ ] **Step 1:** Read the current file. It loads the patient and holds `const [status, setStatus] = useState<'now' | 'paused' | 'done'>('now')`, passing `setStatus` to `<Timer>`. Change it so the status initializes from the loaded patient, promotes a `queue`/`invited` patient to `now` (persisting), and persists every change:
  1. Add `setPatientStatus` to the `getPatient` import: `import { getPatient, setPatientStatus } from '@/services/doctor'`.
  2. In the load `useEffect`, after `setPatient(p)`, add:
```tsx
if (p.status === 'queue' || p.status === 'invited') { setStatus('now'); void setPatientStatus(p.id, 'now') }
else if (p.status === 'paused') setStatus('paused')
else if (p.status === 'done') setStatus('done')
else setStatus('now')
```
   (Keep the `alive` guard around these — only run if `alive`.)
  3. Add a wrapper that persists:
```tsx
const changeStatus = (s: 'now' | 'paused' | 'done') => { setStatus(s); if (patient) void setPatientStatus(patient.id, s) }
```
  4. Pass `changeStatus` to the Timer instead of `setStatus`: `<Timer status={status} setStatus={changeStatus} onFinish={() => notify('Приём завершён')} />`.

- [ ] **Step 2: Gate** — `npm run verify` green (existing ConsultationPage + Worklist smoke tests still pass; the service tests from Task 1 pass). If a test leaves a localStorage override that affects another test, add `beforeEach(() => localStorage.clear())` to the ConsultationPage test file too (only if needed).
- [ ] **Step 3: Manual** — `npm run dev`: on `/doctor` note a "queue" patient (e.g. Юлдашев, "В очереди"); open them → header shows "Идёт приём"; click "Завершить приём" → back to `/doctor` → that patient now shows "Осмотрен" and the summary cards updated. (Because it's localStorage-backed, a refresh keeps it. To reset the demo, clear the `aurora.patientStatus` localStorage key.) Stop dev.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(doctor): consultation persists visit status → queue reflects it"`

---

### Task 3: Gate + screenshot
- [ ] **Step 1:** `npm run verify && npm run build` — green; report counts.
- [ ] **Step 2:** (Controller) screenshot the queue after finishing a patient (status reflected). 

---

## Self-Review (plan author)

**Spec coverage:** Connects the consultation to the worklist via the service seam — the highest-value "works end-to-end" remaining consultation piece. `setPatientStatus` + override-aware `getQueue`/`getPatient`/`getDaySummary` (Task 1, TDD), wired into `ConsultationPage` open/pause/finish (Task 2). localStorage-backed so it survives route navigation. Draft/publish + version history, hints/past-results, and revisit/admission remain — later plans.

**Placeholder scan:** No TODOs. The override service + wiring are fully specified. The reset instruction (clear the localStorage key) is operational guidance, not a gap.

**Type consistency:** `PatientStatus` from `@/domain/types` used for the override map + `setPatientStatus`. `getQueue`/`getPatient`/`getDaySummary` signatures unchanged (callers untouched). `ConsultationPage`'s local status union `'now'|'paused'|'done'` is a subset of `PatientStatus`, so `setPatientStatus(id, s)` typechecks. `changeStatus` matches `Timer`'s `setStatus: (s: 'now'|'paused'|'done') => void`.

**Scope:** One coherent behaviour (status sync), service-unit-tested + wired, visually verifiable in the queue.
