# Call-Center QA — Plan 2: Frontend (React UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Russian-language browser UI for the call-center QA backend (Plan 1, complete: 81 tests green) — 7 screens served as a static SPA by the existing FastAPI app — so the non-technical owner can upload, review, fix, teach, coach, voice, and configure without ever seeing an API.

**Architecture:** Vite + React 18 + TypeScript + Tailwind v4 in `web/`; `npm run build` emits to `../static/`, which `app/main.py` already mounts at `/`. Hash-based routing (`/#/calls/5`) so deep links survive refresh without SPA-fallback server changes. Typed API client over `fetch`; lightweight polling hooks (no query lib). Built `static/` output IS committed (the owner never runs node; Start.bat serves prebuilt assets).

**Design system (fixed — do not invent):** the ailos/Aurora medical language. Calm clinical blue-teal, light-only, generous whitespace, high legibility. Font: **Geist Variable** (`@fontsource-variable/geist` — has Cyrillic). Icons: **lucide-react** only, NEVER emojis. Palette (oklch, from the Aurora product): background `oklch(0.99 0.004 240)`, foreground `oklch(0.26 0.02 255)`, primary `oklch(0.58 0.10 220)`, primary-foreground `oklch(0.99 0 0)`, secondary/muted `oklch(0.96 0.01 235)`, muted-foreground `oklch(0.52 0.02 255)`, accent `oklch(0.95 0.02 210)`, destructive `oklch(0.58 0.17 25)`, border/input `oklch(0.92 0.008 245)`, ring = primary, radius `0.5rem`. Status tokens: ok `oklch(0.62 0.13 155)`, warn `oklch(0.76 0.13 75)`, info `oklch(0.60 0.11 235)` (+ destructive). Dataviz rules: stat tiles = hero numbers (no plot, no hover layer); the ONLY charts are single-series (weekly avg score bars, per-criterion bars) → one hue (primary), thin marks, 4px rounded top ends anchored to baseline, 2px gaps, recessive grid, labels in ink tokens (never series color), per-bar tooltip via `<title>`; status colors never used as series colors; any FUTURE multi-series chart must run the dataviz palette validator first.

**Tech Stack:** react 18, react-dom, react-router-dom 7 (HashRouter), typescript 5, vite 6, @tailwindcss/vite (Tailwind v4), lucide-react, @fontsource-variable/geist; dev: vitest, jsdom, @testing-library/react, @testing-library/user-event, @vitejs/plugin-react.

**Context:**
- Spec: `docs/superpowers/specs/2026-07-10-callcenter-qa-v2t-t2v-design.md` §4 (screens), §5 (review screen). Plan 1 (backend): `2026-07-10-callcenter-qa-backend.md` — COMPLETE.
- **Working directory for ALL tasks: `C:\Users\user\Desktop\V2T T2V`** (the build repo). Node v24 / npm 11 available. Backend suite must STAY at 81 passed — run `.venv\Scripts\python.exe -m pytest -q` before every commit.
- Frontend gates per task: `npm --prefix web run typecheck` (tsc --noEmit) + `npm --prefix web run test` (vitest run) green before commit; `npm --prefix web run build` in tasks that say so.
- **Calibrated code discipline:** foundation tasks (1–4) specify code verbatim; screen tasks (5–10) pin the tricky logic verbatim (hooks, sync, charts) and specify layouts/behavior as precise contracts with acceptance tests — the two-stage review per task enforces them. UI text is RUSSIAN everywhere; ў/ғ etc. not needed (Russian, not Uzbek, UI).
- All API endpoints, shapes and Russian error conventions are in Plan 1; the client in Task 3 lists every route explicitly.

## Screen inventory (from spec §4)

| Route | Screen | Core elements |
|---|---|---|
| `#/` | Главная (Dashboard) | stat tiles, статусы очереди, failed-jobs banner, date filter |
| `#/calls` | Звонки | upload dropzone, filters, table, pagination |
| `#/calls/:id` | Проверка звонка | audio+transcript sync, edits, scorecard, examples, coaching |
| `#/operators` | Операторы | list, CRUD, stats panel (tiles + weekly bars + criteria bars), coaching |
| `#/scorecard` | Чек-лист | criteria editor, examples library, prompt preview + versions |
| `#/tts` | Озвучка | free-text TTS, scripts library |
| `#/settings` | Настройки | API key, models, watcher, filename pattern, backup |

---

### Task 1: Scaffold `web/` + build pipeline

**Files:** Create `web/` (vite react-ts), `web/vite.config.ts`, `web/tsconfig.json` adjustments, `web/vitest.setup.ts`, update root `.gitignore`.

- [ ] **Step 1:** From repo root:
```powershell
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router-dom lucide-react @fontsource-variable/geist
npm install -D @tailwindcss/vite tailwindcss vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```
- [ ] **Step 2:** `web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "../static", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
  },
});
```
(If TS complains about `test` key, add `/// <reference types="vitest/config" />` at the top.)

`web/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add npm scripts to `web/package.json`: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"build": "tsc --noEmit && vite build"` (replace default build script).

Append to root `.gitignore`: `web/node_modules/` and `web/dist/`. Do NOT ignore `static/` — built output is committed.

- [ ] **Step 3:** Replace `web/src/App.tsx` with a placeholder that renders `<h1>Контроль качества</h1>`; delete demo CSS content from `web/src/App.css` (remove file + import), keep `web/src/index.css` minimal for now (`@import "tailwindcss";`). Remove `public/vite.svg` reference from `index.html`; set `<html lang="ru">`, `<title>Контроль качества колл-центра</title>`.
- [ ] **Step 4:** Smoke test `web/src/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app title", () => {
  render(<App />);
  expect(screen.getByText("Контроль качества")).toBeInTheDocument();
});
```
- [ ] **Step 5:** Gates: `npm --prefix web run typecheck` → clean; `npm --prefix web run test` → 1 passed; `npm --prefix web run build` → creates `static/index.html` + assets; `.venv\Scripts\python.exe -m pytest -q` → 81 passed (backend untouched).
- [ ] **Step 6:** Commit: `feat(web): scaffold Vite+React+TS+Tailwind v4, build to static/, vitest wiring`

---

### Task 2: Design foundation — tokens, primitives, formatters

**Files:** Create `web/src/index.css` (replace), `web/src/lib/format.ts`, `web/src/lib/cn.ts`, `web/src/components/ui.tsx`, tests.

- [ ] **Step 1:** `web/src/index.css` — the medical theme, VERBATIM:
```css
@import "tailwindcss";
@import "@fontsource-variable/geist";

@theme {
  --font-sans: "Geist Variable", "Segoe UI", sans-serif;

  --color-background: oklch(0.99 0.004 240);
  --color-foreground: oklch(0.26 0.02 255);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.26 0.02 255);
  --color-primary: oklch(0.58 0.1 220);
  --color-primary-foreground: oklch(0.99 0 0);
  --color-secondary: oklch(0.96 0.01 235);
  --color-secondary-foreground: oklch(0.3 0.02 255);
  --color-muted: oklch(0.96 0.01 235);
  --color-muted-foreground: oklch(0.52 0.02 255);
  --color-accent: oklch(0.95 0.02 210);
  --color-accent-foreground: oklch(0.3 0.03 235);
  --color-destructive: oklch(0.58 0.17 25);
  --color-destructive-foreground: oklch(0.99 0 0);
  --color-border: oklch(0.92 0.008 245);
  --color-input: oklch(0.92 0.008 245);
  --color-ring: oklch(0.58 0.1 220);

  --color-ok: oklch(0.62 0.13 155);
  --color-ok-soft: oklch(0.95 0.03 155);
  --color-warn: oklch(0.76 0.13 75);
  --color-warn-soft: oklch(0.97 0.04 85);
  --color-info: oklch(0.6 0.11 235);
  --color-info-soft: oklch(0.95 0.02 235);
  --color-danger-soft: oklch(0.96 0.02 25);

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* active transcript line: soft accent wash + primary left rail */
.seg-active {
  background: var(--color-accent);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

@keyframes rise-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.rise-in { animation: rise-in 0.35s ease both; }

@media (prefers-reduced-motion: reduce) {
  .rise-in { animation: none; }
}
```
- [ ] **Step 2:** `web/src/lib/cn.ts`: `export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");`

`web/src/lib/format.ts` VERBATIM:
```ts
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export const STATUS_RU: Record<string, string> = {
  queued: "В очереди",
  transcribing: "Расшифровка",
  analyzing: "Оценка",
  ready: "К проверке",
  reviewed: "Проверен",
  error: "Ошибка",
};

export const BOOKING_RU: Record<string, string> = {
  "записан": "Записан",
  "не записан": "Не записан",
  "перезвонит": "Перезвонит",
  "неясно": "Неясно",
};

export function fmtScore(total: number | null | undefined, max = 12): string {
  return total == null ? "—" : `${total} / ${max}`;
}
```
- [ ] **Step 3:** `web/src/components/ui.tsx` — small primitive set, one file, VERBATIM contracts (implementation may vary in classes but must keep names/props/roles):
  - `Button({variant?: "primary"|"secondary"|"ghost"|"destructive", size?: "sm"|"md", ...button props})` — primary = `bg-primary text-primary-foreground hover:opacity-90`; focus ring `focus-visible:ring-2 ring-ring`; `disabled:opacity-50`.
  - `Card({title?, children, className?})` — `bg-card border border-border rounded-lg p-4`.
  - `Badge({tone: "ok"|"warn"|"info"|"danger"|"neutral", children})` — soft tinted bg (`--color-*-soft`), strong-tone text, `rounded-md px-2 py-0.5 text-sm inline-flex items-center gap-1`.
  - `Input`, `Textarea`, `Select` — bordered, `bg-card`, ring on focus; label wrapper `Field({label, children})` with `<label>` association via htmlFor/id passthrough.
  - `Dialog({open, onClose, title, children})` — fixed overlay (`bg-foreground/20`), centered `bg-card` panel, closes on overlay click + Escape, `role="dialog"` `aria-modal="true"` `aria-label={title}`.
  - `Spinner({label?})` — lucide `Loader2` with `animate-spin` + visually-hidden label (default "Загрузка").
  - `EmptyState({icon, title, hint?})` — muted centered block.
  - `StatusBadge({status})` — maps call status → Badge tone (queued neutral, transcribing/analyzing info + Loader2 spin icon, ready warn, reviewed ok, error danger + CircleAlert icon) with STATUS_RU label.
- [ ] **Step 4:** Tests `web/src/components/ui.test.tsx`: Button renders text + respects disabled; Badge tones render; Dialog opens/closes on Escape; StatusBadge shows "К проверке" for ready and has no emoji characters (`/[\u{1F300}-\u{1FAFF}]/u` regex negative). `web/src/lib/format.test.ts`: fmtDuration (95 → "1:35"), fmtScore, STATUS_RU completeness for all six statuses.
- [ ] **Step 5:** Gates (typecheck + vitest). Commit: `feat(web): medical theme tokens, UI primitives, formatters`

---

### Task 3: Typed API client

**Files:** Create `web/src/lib/api.ts`, `web/src/lib/api.test.ts`.

- [ ] **Step 1:** `api.ts` — types + client, VERBATIM shape (trim comments as needed):
```ts
export interface Operator { id: number; name: string; filename_alias: string | null; active: number; }
export interface Call {
  id: number; original_filename: string; operator_id: number | null; operator_name?: string | null;
  source: string; status: string; error_msg: string | null; duration_sec: number | null;
  detected_language: string | null; uploaded_at: string; call_date: string | null;
  booking_result?: string | null; missed_booking?: number | null; total_score?: number | null;
}
export interface Segment {
  id: number; call_id: number; idx: number; start_sec: number | null; end_sec: number | null;
  text_original: string; text_corrected: string | null; edited_at: string | null;
}
export interface Score { criterion_key: string; ai_score: number; ai_reason: string | null; reviewer_score: number | null; }
export interface Analysis {
  id: number; model: string; prompt_version_id: number; booking_result: string | null;
  missed_booking: number | null; summary: string | null; recommendation: string | null;
  created_at: string; scores: Score[];
}
export interface Review { call_id: number; comment: string | null; reviewed_at: string | null; }
export interface CallDetail { call: Call; segments: Segment[]; analysis: Analysis | null; review: Review | null; }
export interface Criterion { id: number; key: string; label_ru: string; description_ru: string; active: number; sort: number; }
export interface Example {
  id: number; criterion_id: number; kind: "good" | "bad"; phrase: string; note: string | null;
  criterion_key?: string; criterion_label?: string;
}
export interface CoachingItem {
  id: number; call_id: number; operator_id: number; note: string; script_id: number | null;
  status: string; created_at: string; resolved_at: string | null; operator_name?: string; original_filename?: string;
}
export interface OperatorStats {
  calls_total: number; avg_total: number | null;
  by_criterion: { criterion_key: string; avg_score: number; n: number }[];
  weekly: { week: string; avg_total: number; n: number }[];
  open_coaching: number; missed_bookings: number;
}
export interface Dashboard {
  calls_total: number; by_status: Record<string, number>; avg_total: number | null;
  missed_bookings: number; failed_jobs_total: number;
}
export interface Script { id: number; name: string; text: string; language: string; voice: string; audio_path: string | null; updated_at: string; }
export interface Settings {
  model: string; model_low_cost: string; whisper_model: string; whisper_device: string;
  port: number; watch_enabled: boolean; filename_pattern: string; has_api_key: boolean;
}
export interface PromptPreview { version_id: number; current_text: string; versions: { id: number; hash: string; created_at: string }[]; }
export interface UploadResult { filename: string; status: "created" | "duplicate" | "rejected"; call_id?: number; error?: string; }

export class ApiError extends Error {
  constructor(public status: number, detail: string) { super(detail); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = `Ошибка ${res.status}`;
    try { const body = await res.json(); if (body?.detail) detail = String(body.detail); } catch { /* keep default */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export const api = {
  dashboard: (p?: { date_from?: string; date_to?: string }) =>
    req<Dashboard>("/api/dashboard" + qs(p)),
  listCalls: (p?: Record<string, string | number | undefined>) =>
    req<{ total: number; items: Call[] }>("/api/calls" + qs(p)),
  callDetail: (id: number) => req<CallDetail>(`/api/calls/${id}`),
  uploadCalls: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return req<{ results: UploadResult[] }>("/api/calls/upload", { method: "POST", body: fd });
  },
  patchCall: (id: number, body: object) => req<Call>(`/api/calls/${id}`, json("PATCH", body)),
  retryCall: (id: number) => req<{ ok: boolean }>(`/api/calls/${id}/retry`, { method: "POST" }),
  rescore: (id: number) => req<{ ok: boolean }>(`/api/calls/${id}/rescore`, { method: "POST" }),
  editSegment: (id: number, text_corrected: string | null) =>
    req<Segment>(`/api/segments/${id}`, json("PATCH", { text_corrected })),
  overrideScore: (callId: number, key: string, reviewer_score: number | null) =>
    req<{ ok: boolean }>(`/api/calls/${callId}/scores/${key}`, json("PUT", { reviewer_score })),
  setReview: (callId: number, body: { comment?: string; reviewed?: boolean }) =>
    req<Review>(`/api/calls/${callId}/review`, json("PUT", body)),
  listOperators: () => req<Operator[]>("/api/operators"),
  createOperator: (body: object) => req<Operator>("/api/operators", json("POST", body)),
  patchOperator: (id: number, body: object) => req<Operator>(`/api/operators/${id}`, json("PATCH", body)),
  operatorStats: (id: number) => req<OperatorStats>(`/api/operators/${id}/stats`),
  listCoaching: (p?: Record<string, string | number | undefined>) =>
    req<CoachingItem[]>("/api/coaching" + qs(p)),
  createCoaching: (body: object) => req<CoachingItem>("/api/coaching", json("POST", body)),
  resolveCoaching: (id: number) => req<CoachingItem>(`/api/coaching/${id}/resolve`, { method: "POST" }),
  listCriteria: () => req<Criterion[]>("/api/criteria"),
  patchCriterion: (id: number, body: object) => req<Criterion>(`/api/criteria/${id}`, json("PATCH", body)),
  listExamples: (criterion_id?: number) => req<Example[]>("/api/examples" + qs({ criterion_id })),
  createExample: (body: object) => req<Example>("/api/examples", json("POST", body)),
  deleteExample: (id: number) => req<{ ok: boolean }>(`/api/examples/${id}`, { method: "DELETE" }),
  promptPreview: () => req<PromptPreview>("/api/scorecard/prompt"),
  tts: (body: { text: string; language: string; voice: string }) =>
    req<{ audio_url: string }>("/api/tts", json("POST", body)),
  listScripts: () => req<Script[]>("/api/scripts"),
  createScript: (body: object) => req<Script>("/api/scripts", json("POST", body)),
  patchScript: (id: number, body: object) => req<Script>(`/api/scripts/${id}`, json("PATCH", body)),
  deleteScript: (id: number) => req<{ ok: boolean }>(`/api/scripts/${id}`, { method: "DELETE" }),
  getSettings: () => req<Settings>("/api/settings"),
  putSettings: (body: object) => req<Settings>("/api/settings", json("PUT", body)),
  backup: () => req<{ path: string }>("/api/backup", { method: "POST" }),
};

function qs(p?: Record<string, string | number | undefined>): string {
  if (!p) return "";
  const entries = Object.entries(p).filter(([, v]) => v !== undefined && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}
```
- [ ] **Step 2:** Tests (mock `global.fetch` with `vi.stubGlobal`): success path parses JSON; error path throws ApiError with the backend's Russian `detail`; `qs` filtering; `uploadCalls` builds FormData with 2 entries named "files".
- [ ] **Step 3:** Gates. Commit: `feat(web): typed API client covering all backend endpoints`

---

### Task 4: App shell — routing, sidebar, polling hook, toasts

**Files:** Create `web/src/shell/Layout.tsx`, `web/src/shell/nav.ts`, `web/src/lib/usePolling.ts`, `web/src/lib/toast.tsx`, rewrite `web/src/App.tsx` + `web/src/main.tsx`, page stub files under `web/src/pages/`, tests.

- [ ] **Step 1:** Routing: `HashRouter` in `main.tsx`; `App.tsx` defines routes to 7 pages (stubs render their Russian h1 for now). Nav definition `nav.ts`:
```ts
import { LayoutDashboard, Phone, Users, ListChecks, Volume2, Settings as SettingsIcon } from "lucide-react";
export const NAV = [
  { to: "/", label: "Главная", icon: LayoutDashboard },
  { to: "/calls", label: "Звонки", icon: Phone },
  { to: "/operators", label: "Операторы", icon: Users },
  { to: "/scorecard", label: "Чек-лист", icon: ListChecks },
  { to: "/tts", label: "Озвучка", icon: Volume2 },
  { to: "/settings", label: "Настройки", icon: SettingsIcon },
];
```
- [ ] **Step 2:** `Layout.tsx`: fixed left sidebar (w-56, `bg-card border-r border-border`): product name "Контроль качества" small caps muted + nav items (NavLink; active = `bg-accent text-accent-foreground font-medium`, inactive = `text-muted-foreground hover:bg-secondary`); content area `max-w-6xl mx-auto p-6` with `<Outlet/>`. Every page's h1: `text-xl font-semibold`.
- [ ] **Step 3:** `usePolling.ts` VERBATIM:
```ts
import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling<T>(fn: () => Promise<T>, intervalMs: number | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (intervalMs == null) return;
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, refresh, ...deps]);

  return { data, error, loading, refresh };
}
```
- [ ] **Step 4:** `toast.tsx`: tiny context provider — `useToast().push(message, tone?: "ok"|"danger")`; renders stacked bottom-right cards that auto-dismiss in 4s; `role="status"` for ok, `role="alert"` for danger. Wrap in `App`.
- [ ] **Step 5:** Tests: nav renders 6 items with Russian labels; clicking «Звонки» switches route (stub h1 appears); usePolling delivers data, surfaces ApiError message, and clears its interval on unmount (vi.useFakeTimers); toast appears and auto-dismisses.
- [ ] **Step 6:** Gates + `npm --prefix web run build` still succeeds. Commit: `feat(web): app shell - hash routing, sidebar nav, polling hook, toasts`

---

### Task 5: Dashboard (Главная)

**Files:** Create `web/src/pages/DashboardPage.tsx`, `web/src/components/StatTile.tsx`, tests.

**Contract:**
- `usePolling(api.dashboard(dateRange), 5000, [dateRange])`.
- Date filter row (top right): two `<input type="date">` (От / До) + «Сбросить» ghost button; empty = all time. Filters map to `date_from`/`date_to`.
- **StatTile** (dataviz "hero number" — no plot, no hover): `Card` with muted `text-sm` label above a `text-3xl font-semibold tabular-nums` value; optional lucide icon top-right in `text-muted-foreground`. Tiles (grid 4-up, `rise-in` staggered via inline `animationDelay`): «Звонков» = calls_total; «Средний балл» = avg_total ?? "—" with `/ 12` suffix in muted; «Упущенные записи» = missed_bookings (value in `text-warn` tone when > 0); «Ошибки обработки» = failed_jobs_total (destructive tone when > 0).
- Queue strip below tiles: for each of the six statuses with count > 0, a `StatusBadge` + count; plus a live region (`aria-live="polite"`) summarizing «В работе: N» when transcribing+analyzing > 0.
- Error banner (destructive-soft Card) when `failed_jobs_total > 0`: «Есть звонки с ошибками — откройте список звонков с фильтром "Ошибка"» + link `#/calls?status=error` (Calls page must read `status` from the hash query — Task 6).
- States: `Spinner` while loading; `EmptyState` (icon `Inbox`, «Пока нет звонков», hint about upload/incoming) when calls_total is 0.

**Tests:** mocked api.dashboard: tiles show values; missed>0 gets warn styling class; failed banner appears only when failed_jobs_total>0; date inputs trigger refetch with params (assert fetch URL).

Gates + commit: `feat(web): dashboard - stat tiles, queue strip, error banner, date filter`

---

### Task 6: Calls page (Звонки)

**Files:** Create `web/src/pages/CallsPage.tsx`, `web/src/components/UploadZone.tsx`, tests.

**Contract:**
- **UploadZone** (top of page): a dashed-border `rounded-lg` area («Перетащите записи сюда или нажмите, чтобы выбрать» + `Upload` icon), `<input type="file" multiple accept=".mp3,.wav,.ogg,.m4a,.flac,.opus" class="sr-only">`, click + drag/drop (dragover adds `border-primary bg-accent`); on drop/select → `api.uploadCalls(files)`; while uploading show Spinner + «Загрузка N файлов…»; per-result toasts: created → ok «Файл … добавлен», duplicate → neutral-ok «… уже есть в системе», rejected → danger «…: неподдерживаемый формат»; then refresh list.
- Filter row: Select статус (Все + 6 RU statuses), Select оператор (from `api.listOperators`), date От/До, Select результат записи (BOOKING_RU), checkbox «Упущенная запись». Initial `status` may come from hash query (`#/calls?status=error`): read once on mount via `useSearchParams`.
- Table (`text-sm`, sticky header row, hover `bg-secondary/60` rows, whole row clickable → `#/calls/:id`): Файл • Оператор («—» if null) • Дата (fmtDate) • Длительность (fmtDuration) • Статус (StatusBadge; if error also `title={error_msg}`) • Балл (fmtScore total_score; muted «—» pre-analysis) • Запись (BOOKING_RU badge: записан→ok, не записан→danger, перезвонит→warn, неясно→neutral) + missed_booking `TriangleAlert` warn icon with `aria-label="Упущенная запись"`.
- Pagination: limit 50; «Назад/Вперёд» ghost buttons + «N–M из total» tabular-nums; polling 5000ms keeps page+filters.
- States: Spinner / EmptyState / error banner with refresh button.

**Tests:** upload flow (2 files mocked → toasts by result kind; fetch called with FormData); filter change refetches with correct query params; row click navigates (assert location.hash); status query param from URL preselects filter.

Gates + commit: `feat(web): calls page - bulk upload zone, filters, table, pagination`

---

### Task 7: Review page, part 1 — audio+transcript core

**Files:** Create `web/src/pages/ReviewPage.tsx` (layout + left pane), `web/src/lib/useAudioSync.ts`, `web/src/components/Transcript.tsx`, tests.

- [ ] **useAudioSync.ts** VERBATIM:
```ts
import { useEffect, useRef, useState } from "react";
import type { Segment } from "./api";

export function activeSegmentIndex(segments: Segment[], t: number): number {
  // last segment whose start_sec <= t (segments are ordered by idx)
  let lo = 0, hi = segments.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((segments[mid].start_sec ?? 0) <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

export function useAudioSync(segments: Segment[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setActiveIdx(activeSegmentIndex(segments, el.currentTime));
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [segments]);

  const seekTo = (sec: number | null | undefined) => {
    const el = audioRef.current;
    if (el && sec != null) { el.currentTime = sec; el.play().catch(() => {}); }
  };

  return { audioRef, activeIdx, seekTo };
}
```
- [ ] **ReviewPage layout:** header row (back link `ArrowLeft` → `#/calls`, filename `font-medium`, StatusBadge, operator select inline (PATCH on change), date). Two-column grid `lg:grid-cols-[1fr_380px]`: left = audio + transcript; right = scorecard (Task 8). Data: `api.callDetail(id)`; poll every 3000ms while `status` is queued/transcribing/analyzing, else no polling (null interval).
- [ ] **Processing banner** (info-soft Card, Loader2 spin): «Звонок обрабатывается…» with stage name; **error state** (danger-soft Card): error_msg + «Повторить» Button → `api.retryCall`; toasts on 409s surface backend Russian detail.
- [ ] **Audio:** `<audio ref controls preload="metadata" src={/api/calls/${id}/audio} className="w-full">`.
- [ ] **Transcript.tsx:** ordered list; each row = `button` (full-width text-left, `rounded-md px-3 py-1.5`) with muted `tabular-nums` timestamp (m:ss from start_sec) + text (corrected ?? original); active row gets `.seg-active` + `aria-current="true"`; auto-scroll active row into view (`scrollIntoView({block:"nearest"})`); click → `seekTo(start_sec)`. Row hover reveals a `Pencil` ghost icon-button (aria-label «Исправить текст») → row switches to edit mode: Textarea (initial = corrected ?? original) + «Сохранить» / «Отмена» + (if corrected non-null) «Вернуть оригинал» destructive-ghost. Save → `api.editSegment(id, text)`; restore → `api.editSegment(id, null)`. Corrected rows show a small muted «исправлено» chip + original text in collapsed muted `line-through`-free block (details/summary «показать оригинал»). While call is transcribing/analyzing, edit affordances hidden (409 guard exists server-side; UI hides too).
- [ ] **Tests:** `activeSegmentIndex` unit table (before first, inside, between, after last); click row seeks (mock HTMLMediaElement.play); edit save issues PATCH with text; «Вернуть оригинал» sends null; edit hidden while analyzing.

Gates + commit: `feat(web): review page core - synced transcript, seek, inline fixes`

---

### Task 8: Review page, part 2 — scorecard, examples, coaching

**Files:** Extend `web/src/pages/ReviewPage.tsx`; create `web/src/components/ScorePanel.tsx`, `web/src/components/ExamplePopover.tsx`, `web/src/components/CoachingDialog.tsx`, tests.

**ScorePanel contract:**
- Needs `api.listCriteria()` once (labels by key; render scores in criteria sort order).
- Per criterion row: label_ru `text-sm font-medium`; AI score chip (0 danger-soft / 1 warn-soft / 2 ok-soft, tabular) + ai_reason muted `text-sm`; reviewer segmented control: three buttons 0/1/2 (`aria-pressed`, active = solid primary) + `RotateCcw` ghost «сброс» (only when reviewer_score != null) → `api.overrideScore(callId, key, v)`; effective value = reviewer ?? ai — bold when overridden («ваша оценка»).
- Totals header: big effective total `fmtScore` + muted AI total when differs.
- Below: booking_result badge + missed_booking warn line («Пациента можно было записать»), summary paragraph, recommendation in accent-soft Card («Совет оператору»).
- Footer: Textarea «Комментарий» (save on blur via setReview {comment}); primary Button «Отметить проверенным» (setReview {reviewed:true}; when status=reviewed shows ok Badge «Проверен» + reviewed_at date); secondary «Переоценить с учётом правок» → `api.rescore` (confirm Dialog: «Текущие оценки сохранятся в истории; новая оценка заменит их на экране») then poll kicks in; disabled + hint while processing.
- All actions disabled with tooltips while status is transcribing/analyzing; 409/422 → danger toast with backend detail.

**ExamplePopover contract:** listen to `mouseup`/`selectionchange` inside the transcript container; when a non-empty text selection exists within one segment row, float a small pill near it: «В примеры» (`Sparkles`... no — use `BookmarkPlus` icon). Click opens a Dialog: readonly selected phrase, radio ХОРОШИЙ/ПЛОХОЙ пример (ok/danger tinted), Select критерий (active criteria), optional note Input, «Сохранить» → `api.createExample({criterion_id, kind, phrase, note, call_id, segment_id})` → ok toast «Пример сохранён — система учтёт его при следующих оценках».

**CoachingDialog contract:** trigger Button (`MessageSquareShare`) «Замечание оператору» in the header area; Dialog: operator Select (preselect call's operator; if call unassigned allow any), note Textarea (required), script Select (optional, from api.listScripts, «без скрипта» default), «Отправить» → `api.createCoaching`; 422 mismatch → danger toast.

**Tests:** override buttons call API with right args + optimistic UI updates effective total; reset sends null; example dialog posts selection payload (simulate window.getSelection mock); coaching dialog validates empty note; rescore confirm flow fires POST and switches to processing banner (mock detail refetch returning analyzing).

Gates + commit: `feat(web): review scorecard - overrides, verdict, teaching examples, coaching`

---

### Task 9: Operators + Scorecard pages

**Files:** Create `web/src/pages/OperatorsPage.tsx`, `web/src/pages/ScorecardPage.tsx`, `web/src/components/WeeklyBars.tsx`, `web/src/components/CriterionBars.tsx`, tests.

**WeeklyBars.tsx** (single-series SVG, dataviz-compliant) VERBATIM:
```tsx
interface WeekPoint { week: string; avg_total: number; n: number; }

export function WeeklyBars({ data, max = 12 }: { data: WeekPoint[]; max?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Пока нет данных по неделям.</p>;
  const W = 320, H = 96, PAD = 2, bw = Math.max(6, Math.floor(W / data.length) - PAD);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img"
           aria-label={`Средний балл по неделям, последняя: ${data[data.length - 1].avg_total} из ${max}`}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.avg_total / max) * H);
          const x = i * (bw + PAD);
          return (
            <g key={d.week}>
              <rect x={x} y={H - h} width={bw} height={h} rx={4}
                    fill="var(--color-primary)" opacity={i === data.length - 1 ? 1 : 0.55}>
                <title>{`${d.week}: ${d.avg_total} из ${max} (звонков: ${d.n})`}</title>
              </rect>
              {i === data.length - 1 && (
                <text x={x + bw / 2} y={H - h - 4} textAnchor="middle"
                      fontSize="11" fill="var(--color-foreground)" className="tabular-nums">
                  {d.avg_total}
                </text>
              )}
            </g>
          );
        })}
        <line x1="0" y1={H + 0.5} x2={W} y2={H + 0.5} stroke="var(--color-border)" />
      </svg>
      <figcaption className="text-xs text-muted-foreground mt-1">Средний балл по неделям (0–{max})</figcaption>
    </figure>
  );
}
```
(Rules embodied: one hue = primary; latest bar full-opacity is the only emphasized mark + only direct label; values otherwise in tooltips; label text in ink token, never series color; baseline hairline only; no legend for a single series.)

**CriterionBars.tsx:** horizontal bars 0–2 per criterion (label_ru left `text-sm`, track `bg-secondary rounded-full h-2`, fill `bg-primary rounded-full` width `avg/2*100%`, value right `tabular-nums text-sm`); worst-first order comes from API.

**OperatorsPage contract:** two-pane (`lg:grid-cols-[280px_1fr]`): left = operator list (`api.listOperators`; each = name + alias muted; active selection `bg-accent`) + «Добавить» Button → Dialog (name required, filename_alias with hint «латиницей, как в имени файла: dilnoza»), duplicate name → 409 danger toast. Right pane (selected operator, `api.operatorStats(id)` + `api.listCoaching({operator_id})`, both refetched on selection change):
- Header: operator name `text-xl font-semibold` + «Изменить» ghost Button → edit Dialog (name, filename_alias, active toggle «Активен»).
- Stat tiles row (reuse StatTile, `rise-in`): «Звонков» calls_total; «Средний балл» avg_total via fmtScore; «Упущено записей» missed_bookings (warn tone > 0); «Открытых замечаний» open_coaching.
- Card «Динамика по неделям»: `WeeklyBars data={stats.weekly}`.
- Card «По критериям»: `CriterionBars` mapping `by_criterion` keys → label_ru via `api.listCriteria()` (loaded once at page level and passed down).
- Card «Замечания»: coaching list — each row: note text, source call link (`#/calls/{call_id}`, filename), fmtDate(created_at), status Badge (open → warn «Открыто», resolved → ok «Решено»), «Решено» Button when open → `api.resolveCoaching` → refresh. EmptyState «Замечаний нет».
- No operator selected → EmptyState «Выберите оператора».

**ScorecardPage contract** (three stacked sections, page h1 «Чек-лист»):
1. Card «Критерии» — `api.listCriteria()` table: label_ru (inline Input, save on blur → patchCriterion), description_ru (inline Textarea, save on blur), active toggle («Активен»/«Выключен» → patchCriterion {active}), sort number Input. Toast «Сохранено» on each patch; muted note «Отключённые критерии не учитываются при оценке».
2. Card «Примеры для обучения» — `api.listExamples()` grouped by criterion_label; each example row: ThumbsUp ok-badge «хорошо» or ThumbsDown danger-badge «плохо», phrase «в кавычках», note muted, source call link when call_id present, `Trash2` ghost Button → confirm → `api.deleteExample` → refresh + toast. Intro line: «Примеры собираются на экране проверки звонка (выделите фразу). Здесь их можно просматривать и удалять.» EmptyState when none.
3. Card «Инструкция для ИИ» — `api.promptPreview()`: muted intro «Собирается автоматически из критериев и примеров. Каждое изменение создаёт новую версию — старые оценки остаются привязанными к своей версии.»; `<pre className="whitespace-pre-wrap text-sm bg-secondary rounded-md p-3 max-h-72 overflow-auto">{current_text}</pre>`; footer Badge «Текущая версия #{version_id}» + collapsible versions list (id + fmtDate(created_at), newest first) behind «История версий ({n})».

**Tests:** WeeklyBars renders one rect per week with `<title>` tooltips and exactly one direct-label `<text>` (the last); empty weekly → placeholder text; CriterionBars fill width ∝ avg/2; operator create → POST + list refresh; duplicate operator name surfaces 409 toast; resolveCoaching POSTs and updates badge; criterion label edit PATCHes on blur; example delete DELETEs after confirm; promptPreview version badge shows «#N».

Gates + commit: `feat(web): operators page (stats charts + coaching) and scorecard teaching page`

---

### Task 10: TTS + Settings pages, final build + integration gate

**Files:** Create `web/src/pages/TtsPage.tsx`, `web/src/pages/SettingsPage.tsx`, tests; update `README.md`; final build + smoke.

**TtsPage contract** (page h1 «Озвучка»):
- Card «Озвучить текст»: Textarea (Русский label «Текст»), language Select (Русский `ru` / Узбекский `uz`), voice Select (Женский `female` / Мужской `male`), «Озвучить» primary Button (Spinner + disabled while pending) → `api.tts({text, language, voice})` → render `<audio controls src={audio_url} className="w-full mt-3">` + «Скачать MP3» link (`<a href={audio_url} download>`). Empty text → the button is disabled (client-side) AND the backend's 422 (Russian detail) surfaces as danger toast; 502 «не удалось создать аудио…» → danger toast.
- Card «Библиотека скриптов»: `api.listScripts()` list — each: name `font-medium`, language+voice muted, play Button (`Play` icon) → sets an `<audio>` src to `/api/tts/audio/${basename(script.audio_path)}` where `basename = audio_path.split(/[\\/]/).pop()` (audio_path is an OS path; the serve route takes the filename only), «Изменить» ghost → edit Dialog (name, text, language, voice; note «текст/язык/голос — аудио перезапишется»), «Удалить» ghost → confirm → `api.deleteScript` (409 «используется в коучинге» → danger toast). «Добавить скрипт» Button → create Dialog (same fields) → `api.createScript` → refresh. EmptyState «Скриптов пока нет».

**SettingsPage contract** (page h1 «Настройки», loads `api.getSettings()`; each Card saves via `api.putSettings` + ok toast «Сохранено», then refetch):
- Card «Ключ API Claude»: status line — has_api_key ? ok Badge «Ключ задан» : warn Badge «Ключ не задан — оценка звонков не работает»; `<input type="password">` + «Сохранить ключ» → putSettings {anthropic_api_key}; the key is NEVER rendered back (field starts empty each load). Muted note «Ключ хранится в вашем профиле Windows, не в папке программы.»
- Card «Модели»: model Select — options: «Точная (Sonnet 5)» = `claude-sonnet-5`, «Экономная (Haiku)» = current `model_low_cost`; if the loaded `model` matches neither, add it as a selected extra option so nothing is lost. Muted note «Экономная модель дешевле, но оценки грубее.»
- Card «Распознавание речи»: whisper_model Input, whisper_device Select (Автоматически `auto` / Видеокарта `cuda` / Процессор `cpu`), muted note «Смена модели распознавания вступает в силу после перезапуска программы; модель оценки Claude — сразу.»
- Card «Приём файлов»: watch_enabled toggle «Следить за папкой incoming», filename_pattern Input with hint «Как система узнаёт оператора и дату из имени файла (регулярное выражение).»
- Card «Резервная копия»: muted «Сохраняет копию базы (расшифровки, оценки, примеры). Аудио не входит.» + «Создать копию» Button → `api.backup` → ok toast «Копия создана» + show returned path in `text-sm font-mono break-all`.

**Final integration:**
- [ ] `npm --prefix web run build` → refreshes `static/` (tsc clean + vite build).
- [ ] Full frontend gate: `npm --prefix web run typecheck` clean, `npm --prefix web run test` all green.
- [ ] Backend suite unchanged: `.venv\Scripts\python.exe -m pytest -q` → 81 passed.
- [ ] Emoji sweep: `rg -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src` → no matches (lucide icons only).
- [ ] Server smoke (PowerShell): start `uvicorn app.server:app --port 8790`, then GET `/` → 200 with body containing `<div id="root">` and the app's script tag (static mount now serves the SPA, not the placeholder — the placeholder branch in `main.py` only fires when `static/index.html` is absent, so its presence flips it automatically); GET `/api/dashboard` → 200; stop server.
- [ ] `README.md`: replace «Пока готов только «мотор» (API)…» paragraph with «Интерфейс открывается автоматически. Разделы слева: Главная, Звонки, Операторы, Чек-лист, Озвучка, Настройки.»; add to «Для разработчика»: `- Пересборка интерфейса: npm --prefix web run build (кладётся в static/, коммитится).`
- [ ] Commit: `feat(web): TTS + settings pages; SPA shipped to static/; README updated`

## Verification gate (whole plan)

- `npm --prefix web run typecheck` clean; `npm --prefix web run test` green; `npm --prefix web run build` succeeds; backend `pytest` → 81 passed; server smoke serves the SPA at `/`.
- Zero emojis in `web/src` (rg sweep above); lucide-react icons only; all user-facing strings Russian.
- Every screen degrades gracefully: Spinner while loading, EmptyState when empty, error banner + retry on failure (no white screen on a failed fetch).
- `static/` output is committed so `Start.bat` serves a prebuilt SPA with no node step.
- NOT verified here (needs owner + real machine): real audio playback, real edge-tts audio, real Claude scoring, Uzbek quality — the 5–10 real-call acceptance test follows this plan.

## Out of scope

Auth, dark mode, mobile/responsive below 1280px (desktop-first — must not break at 1280×800 but phones aren't targeted), speaker diarization UI, Google Sheets export, server deployment, real-time transcription.

