# Aurora Redesign — Plan 1: Foundation + Doctor Worklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a real, deployable Vite+React+TS app in `C:\Users\user\Desktop\aurora redesign by me`, themed with Aurora's medical palette on the copied shadcn-native design system, with an app shell + router + data seam, and the Doctor **worklist/queue** screen ported and re-skinned as the first palette-approval screen.

**Architecture:** Single SPA. The vetted design system (`src/components/ui/*`, `src/lib/utils.ts`, token structure) is copied from the factory repo `target/ui` and re-themed with Aurora medical CSS-variable tokens. Screens consume mock data through a thin `src/services/` seam (swap to a real backend later). React Router provides one route per module; only Doctor/worklist is built in this plan (other modules get placeholder route stubs).

**Tech Stack:** React 19, Vite 8, TypeScript 6, Tailwind v4 (`@tailwindcss/vite`), Radix UI (via `radix-ui`), class-variance-authority, lucide-react, react-router-dom, Vitest + @testing-library/react + jest-axe (jsdom).

**Reference (read-only, never modified):** prototype at `C:\Users\user\Desktop\aurora las\_handout\src\` — especially `data.jsx` (queue data model), `worklist.jsx` (queue screen), `app.jsx` (banner/greeting, date logic), `chrome.jsx` (shell intent). Design spec: `docs/superpowers/specs/2026-07-01-aurora-redesign-design.md`.

---

## Conventions
- **Working dir:** `C:\Users\user\Desktop\aurora redesign by me` (its own git repo). Commands below `cd` there. Windows + PowerShell/Bash; use forward slashes in configs.
- **Gate per task:** `npm run verify` (`tsc --noEmit && vitest run`). Build check: `npm run build`. Dev: `npm run dev`.
- **Commit trailer** (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Factory design system source:** `C:\Users\user\Desktop\ailos-agentic system\target\ui` (referred to below as `$FACTORY/target/ui`).
- **No emojis anywhere.** Icons come from `lucide-react`. UI strings stay in **Russian** (copy them from the prototype verbatim).

## File Structure (created by this plan)
```
aurora redesign by me/
  package.json, tsconfig.json, tsconfig.app.json, tsconfig.node.json
  vite.config.ts                      # react + tailwind plugins, @/* alias, vitest config
  vitest.setup.ts                     # jest-dom + jest-axe + Radix/jsdom shims (copied)
  index.html
  src/
    main.tsx                          # ReactDOM root + RouterProvider
    index.css                         # copied token structure + AURORA MEDICAL tokens
    lib/utils.ts                      # cn (copied)
    components/ui/*                    # copied design system (36 components)
    app/
      router.tsx                      # route table
      AppShell.tsx                    # nav sidebar + header layout
      ModulePlaceholder.tsx           # stub home for not-yet-built modules
      KitchenSink.tsx                 # /_preview palette check page
    domain/
      types.ts                        # Patient, PatientStatus, DaySummary, ...
      format.ts                       # capWords, moneyFmt, initials, avatarColor, pluralizePatients
      dates.ts                        # ru date helpers (dayOffset, formatDayLabel, weekday/month names)
    data/
      doctor.ts                       # ported PATIENTS / REC_SERVICES / SUMMARY sample data (typed)
    services/
      doctor.ts                       # getQueue(day), getDaySummary(day) — async, returns mock today
    features/doctor/
      Worklist.tsx                    # container: banner + tabs + summary + table
      GreetingBanner.tsx
      SummaryCards.tsx
      QueueTable.tsx
      status.ts                       # status → {label, badge variant} map
    __tests__/ (co-located *.test.ts / *.test.tsx per component)
```

---

### Task 1: Scaffold the app + git repo

**Files:** the whole project (via Vite), `README.md`.

- [ ] **Step 1: Create the project with Vite (React + TS)**

```bash
cd "C:/Users/user/Desktop"
npm create vite@latest "aurora redesign by me" -- --template react-ts
cd "aurora redesign by me"
```
Expected: a `react-ts` scaffold with `src/`, `package.json`, `vite.config.ts`, `tsconfig*.json`.

- [ ] **Step 2: Pin the stack to match the design system** — set `package.json` dependencies/devDependencies to these exact ranges (replace what the template generated), then install:

```jsonc
"dependencies": {
  "@fontsource-variable/geist": "^5.2.9",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^4.4.0",
  "lucide-react": "^1.22.0",
  "motion": "^12.42.1",
  "next-themes": "^0.4.6",
  "radix-ui": "^1.6.1",
  "react": "^19.2.7",
  "react-dom": "^19.2.7",
  "react-day-picker": "^10.0.1",
  "react-router-dom": "^7.9.4",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.6.0",
  "tw-animate-css": "^1.4.0"
},
"devDependencies": {
  "@tailwindcss/vite": "^4.3.2",
  "@testing-library/jest-dom": "^6.9.1",
  "@testing-library/react": "^16.3.2",
  "@types/node": "^24.13.2",
  "@types/react": "^19.2.17",
  "@types/react-dom": "^19.2.3",
  "@vitejs/plugin-react": "^6.0.2",
  "jest-axe": "^10.0.0",
  "jsdom": "^29.1.1",
  "tailwindcss": "^4.3.2",
  "typescript": "~6.0.2",
  "vite": "^8.1.0",
  "vitest": "^4.1.9"
}
```
Set `"scripts"` to:
```jsonc
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "verify": "tsc --noEmit && vitest run"
}
```
Run: `npm install`
Expected: installs clean.

- [ ] **Step 3: Initialize git + a short README**

`README.md`:
```markdown
# Aurora Redesign

Real, deployable rebuild of the Aurora+ MIS prototype: prototype logic re-skinned on the
project's shadcn-native design system (medical palette). Mock data now; backend seam in `src/services`.

- `npm run dev` — run locally
- `npm run build` — produce static `dist/` for hosting
- `npm run verify` — typecheck + tests
```
```bash
git init
printf "node_modules\ndist\n.vite\n" > .gitignore
git add -A && git commit -m "chore: scaffold Vite+React+TS app (Aurora redesign)"
```
Expected: first commit on `main`.

---

### Task 2: Vite/TS config + copy the design system

**Files:** `vite.config.ts`, `tsconfig.app.json`, `vitest.setup.ts`, `src/lib/utils.ts`, `src/components/ui/*`.

- [ ] **Step 1: Replace `vite.config.ts`**
```ts
/// <reference types="vitest" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    css: false,
  },
})
```

- [ ] **Step 2: Add the `@/*` alias to `tsconfig.app.json`** — inside `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: Copy the vetted design system from the factory repo**
```bash
cd "C:/Users/user/Desktop/aurora redesign by me"
mkdir -p src/lib src/components
cp "C:/Users/user/Desktop/ailos-agentic system/target/ui/src/lib/utils.ts" src/lib/utils.ts
cp -r "C:/Users/user/Desktop/ailos-agentic system/target/ui/src/components/ui" src/components/ui
cp "C:/Users/user/Desktop/ailos-agentic system/target/ui/vitest.setup.ts" vitest.setup.ts
```
Expected: `src/components/ui/*.tsx` (36 components, incl. the Slider a11y fix), `src/lib/utils.ts`, `vitest.setup.ts` present. (Do NOT copy the `ui/*.test.tsx` files — those are the factory's smoke tests; Aurora writes its own where needed.)

- [ ] **Step 4: Remove the copied factory smoke tests** (keep components only)
```bash
rm -f src/components/ui/*.test.tsx
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: vite/ts config + copy shadcn-native design system"
```

---

### Task 3: Aurora medical theme (`src/index.css`) + palette preview + build check

**Files:** `src/index.css`, `src/app/KitchenSink.tsx`.

- [ ] **Step 1: Replace `src/index.css`** — copied token *structure* from the factory, with Aurora **medical** `:root` values (calm clinical blue-teal, no dark mode applied). Full file:
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

/* Semantic status colors for clinical UI (badges, pills). */
@theme {
  --color-ok: oklch(0.62 0.13 155);
  --color-ok-foreground: oklch(0.99 0 0);
  --color-warn: oklch(0.76 0.13 75);
  --color-warn-foreground: oklch(0.25 0.02 250);
  --color-info: oklch(0.60 0.11 235);
  --color-info-foreground: oklch(0.99 0 0);
}

@theme inline {
  --font-sans: 'Geist Variable', sans-serif;
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

/* AURORA medical palette — calm clinical blue-teal, high legibility, light only. */
:root {
  --radius: 0.5rem;
  --background: oklch(0.99 0.004 240);
  --foreground: oklch(0.26 0.02 255);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.26 0.02 255);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.26 0.02 255);
  --primary: oklch(0.58 0.10 220);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.96 0.01 235);
  --secondary-foreground: oklch(0.30 0.02 255);
  --muted: oklch(0.96 0.01 235);
  --muted-foreground: oklch(0.52 0.02 255);
  --accent: oklch(0.95 0.02 210);
  --accent-foreground: oklch(0.30 0.03 235);
  --destructive: oklch(0.58 0.17 25);
  --border: oklch(0.92 0.008 245);
  --input: oklch(0.92 0.008 245);
  --ring: oklch(0.58 0.10 220);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
  html { @apply font-sans; }
}
```
(No `.dark` block is applied. `--color-danger` consumers use `destructive`.)

- [ ] **Step 2: Add a palette preview page** `src/app/KitchenSink.tsx` — renders a spread of design-system components so the owner can eyeball the medical palette:
```tsx
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function KitchenSink() {
  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Aurora — палитра</h1>
      <div className="flex flex-wrap gap-3">
        <Button>Основная</Button>
        <Button variant="secondary">Вторичная</Button>
        <Button variant="outline">Контур</Button>
        <Button variant="destructive">Опасно</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>В очереди</Badge>
        <Badge variant="secondary">Повторный</Badge>
        <Badge variant="destructive">Просрочено</Badge>
      </div>
      <Card className="max-w-sm">
        <CardHeader><CardTitle>Карточка</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input aria-label="Поиск" placeholder="Поиск пациента" />
          <Table>
            <TableHeader><TableRow><TableHead>Пациент</TableHead><TableHead>Статус</TableHead></TableRow></TableHeader>
            <TableBody><TableRow><TableCell>Иванов И.И.</TableCell><TableCell>Осмотрен</TableCell></TableRow></TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```
(Wired to a route in Task 5 at `/_preview`.)

- [ ] **Step 3: Verify the theme compiles** — temporarily render KitchenSink from `src/main.tsx` (or wait for Task 5) and run the build:
```bash
npm run build
```
Expected: `tsc -b` clean, `vite build` writes `dist/`. If Tailwind errors on an `@apply` token, the `@theme inline`/`:root` var is missing — fix in `index.css`.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: Aurora medical theme tokens + palette preview page"
```

---

### Task 4: App shell (nav + header)

**Files:** `src/app/AppShell.tsx`.

- [ ] **Step 1: Build the shell** — a left nav (module links) + header, using design-system primitives and lucide icons. Content renders via `<Outlet/>`:
```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { Stethoscope, Users, BedDouble, Wallet, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/doctor', label: 'Рабочее место врача', icon: Stethoscope },
  { to: '/registration', label: 'Регистратура', icon: Users },
  { to: '/inpatient', label: 'Стационар', icon: BedDouble },
  { to: '/cashier', label: 'Касса', icon: Wallet },
  { to: '/commerce', label: 'Коммерция', icon: LineChart },
]

export function AppShell() {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="flex flex-col gap-1 border-r bg-card p-3">
        <div className="px-2 py-3 text-lg font-semibold text-primary">Aurora+</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent font-medium text-accent-foreground'
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 overflow-auto"><Outlet /></main>
    </div>
  )
}
```

- [ ] **Step 2: Smoke test** `src/app/AppShell.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { axe } from 'jest-axe'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders nav with no axe violations', async () => {
    const { container, getByText } = render(
      <MemoryRouter initialEntries={['/doctor']}>
        <Routes><Route element={<AppShell />}><Route path="doctor" element={<div>ok</div>} /></Route></Routes>
      </MemoryRouter>
    )
    expect(getByText('Рабочее место врача')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 3: Run test** — `npm run verify` → Expected: PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: app shell (nav + header)"`

---

### Task 5: Router + module route stubs

**Files:** `src/app/ModulePlaceholder.tsx`, `src/app/router.tsx`, `src/main.tsx`.

- [ ] **Step 1: Placeholder for not-yet-built modules** `src/app/ModulePlaceholder.tsx`:
```tsx
export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Модуль в разработке.</p>
    </div>
  )
}
```

- [ ] **Step 2: Route table** `src/app/router.tsx`:
```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ModulePlaceholder } from './ModulePlaceholder'
import { KitchenSink } from './KitchenSink'
import { Worklist } from '@/features/doctor/Worklist'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/doctor" replace /> },
      { path: 'doctor', element: <Worklist /> },
      { path: 'registration', element: <ModulePlaceholder title="Регистратура" /> },
      { path: 'inpatient', element: <ModulePlaceholder title="Стационар" /> },
      { path: 'cashier', element: <ModulePlaceholder title="Касса" /> },
      { path: 'commerce', element: <ModulePlaceholder title="Коммерция" /> },
      { path: '_preview', element: <KitchenSink /> },
    ],
  },
])
```
(NOTE: `Worklist` is created in Task 7. If executing strictly in order, temporarily point `doctor` at `<ModulePlaceholder title="Рабочее место врача" />` and switch it to `<Worklist />` at the end of Task 7.)

- [ ] **Step 3: Wire `src/main.tsx`**
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>
)
```

- [ ] **Step 4: Run** — `npm run dev`, open the app: `/doctor` placeholder shows, nav switches modules, `/_preview` shows the palette. Then `npm run verify`. Expected: green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: router + module route stubs + main entry"`

---

### Task 6: Domain types + format/date helpers + mock data + service (TDD)

**Files:** `src/domain/types.ts`, `src/domain/format.ts`, `src/domain/format.test.ts`, `src/domain/dates.ts`, `src/domain/dates.test.ts`, `src/data/doctor.ts`, `src/services/doctor.ts`, `src/services/doctor.test.ts`.

- [ ] **Step 1: Types** `src/domain/types.ts`:
```ts
export type PatientStatus = 'queue' | 'invited' | 'now' | 'paused' | 'done'

export interface Patient {
  num: number
  id: number
  name: string
  dob: string
  age: number
  sex: 'М' | 'Ж'
  visit: string        // Первичный | Повторный
  stype: string        // Консультация | Чек-ап | ...
  service: string
  status: PatientStatus
  coverage: string     // Пациент | ДМС | Корпоративный | ...
  source: string
  time: string         // "09:45–10:05"
  done: string         // "" | "09:24"
  day: number          // offset from the reference day (0 = today)
  phone: string
}

export interface DaySummary {
  queue: number
  done: number
  recs: number
  recsDone: number
}
```

- [ ] **Step 2: Write failing tests for format helpers** `src/domain/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { capWords, moneyFmt, initials, avatarColor, pluralizePatients } from './format'

describe('format helpers', () => {
  it('capWords capitalizes each word', () => {
    expect(capWords('иванов иван')).toBe('Иванов Иван')
  })
  it('moneyFmt groups digits ru-style', () => {
    expect(moneyFmt('1250000')).toBe('1 250 000')
    expect(moneyFmt('')).toBe('')
  })
  it('initials takes first letters of first two words', () => {
    expect(initials('Иванов Иван Иванович')).toBe('ИИ')
  })
  it('avatarColor is deterministic and from the palette', () => {
    expect(avatarColor('Иванов')).toBe(avatarColor('Иванов'))
  })
  it('pluralizePatients picks the Russian plural form', () => {
    expect(pluralizePatients(1)).toBe('пациент')
    expect(pluralizePatients(2)).toBe('пациента')
    expect(pluralizePatients(5)).toBe('пациентов')
  })
})
```

- [ ] **Step 3: Run — Expected FAIL** (`Cannot find module './format'`): `npm run test -- format`

- [ ] **Step 4: Implement** `src/domain/format.ts` (ported from prototype `data.jsx`):
```ts
const AV_COLORS = ['#3b6fd4', '#1f9254', '#c47d12', '#8b5cf6', '#0d9aa8', '#d4567a', '#5a6acb', '#c0612f']

export function capWords(s: string): string {
  return String(s ?? '').replace(/(^|[\s-])([a-zа-яё])/g, (_m, p: string, c: string) => p + c.toUpperCase())
}

export function moneyFmt(s: string | number | null | undefined): string {
  const d = String(s ?? '').replace(/\D/g, '')
  return d ? Number(d).toLocaleString('ru-RU') : ''
}

export function initials(name: string): string {
  const p = name.split(' ')
  return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')
}

export function avatarColor(name: string): string {
  let s = 0
  for (const c of name) s += c.charCodeAt(0)
  return AV_COLORS[s % AV_COLORS.length]
}

export function pluralizePatients(n: number): string {
  const a = n % 10, b = n % 100
  if (a === 1 && b !== 11) return 'пациент'
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'пациента'
  return 'пациентов'
}
```

- [ ] **Step 5: Run — Expected PASS**: `npm run test -- format`

- [ ] **Step 6: Write failing tests for date helpers** `src/domain/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { REFERENCE_DAY, dayOffset, formatDayLabel } from './dates'

describe('date helpers', () => {
  it('dayOffset is 0 for the reference day', () => {
    expect(dayOffset(new Date(REFERENCE_DAY))).toBe(0)
  })
  it('dayOffset counts whole days forward', () => {
    const d = new Date(REFERENCE_DAY); d.setDate(d.getDate() + 2)
    expect(dayOffset(d)).toBe(2)
  })
  it('formatDayLabel renders ru weekday + day + month + year', () => {
    expect(formatDayLabel(new Date(2026, 5, 4))).toBe('Четверг, 4 июня 2026')
  })
})
```

- [ ] **Step 7: Run — Expected FAIL**: `npm run test -- dates`

- [ ] **Step 8: Implement** `src/domain/dates.ts` (ported from prototype `app.jsx` GB_WD/GB_MO + dayOffset math; reference day = Thu 4 Jun 2026):
```ts
export const REFERENCE_DAY = new Date(2026, 5, 4) // Thu 4 Jun 2026 (prototype "today")

const WD = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
const MO = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export function dayOffset(day: Date): number {
  const a = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
  const b = Date.UTC(REFERENCE_DAY.getFullYear(), REFERENCE_DAY.getMonth(), REFERENCE_DAY.getDate())
  return Math.round((a - b) / 86_400_000)
}

export function formatDayLabel(day: Date): string {
  return `${WD[day.getDay()]}, ${day.getDate()} ${MO[day.getMonth()]} ${day.getFullYear()}`
}
```

- [ ] **Step 9: Run — Expected PASS**: `npm run test -- dates`

- [ ] **Step 10: Port the mock data** `src/data/doctor.ts` — copy the `PATIENTS` array (all 9 rows) and `REC_SERVICES` verbatim from prototype `data.jsx` (lines 60–91), typed as `Patient[]`, adding the `phone` values from `_PH` inline on each row. Export both. Keep Russian strings exactly.
```ts
import type { Patient } from '@/domain/types'

export const PATIENTS: Patient[] = [
  { num: 1, id: 195247, name: 'Арзибаева Дилрабо Ровшанбековна', dob: '28.08.2018', age: 7, sex: 'Ж', visit: 'Первичный', stype: 'Консультация', service: 'Приём (осмотр, консультация) педиатра', status: 'now', coverage: 'ДМС', source: '05. Сотрудники', time: '09:45–10:05', done: '', day: 0, phone: '+998 90 961 00 04' },
  // ... rows 2–9 copied verbatim from data.jsx with matching phone from _PH by index ...
]

export interface RecService { date: string; pid: number; patient: string; service: string; status: string }
export const REC_SERVICES: RecService[] = [
  // ... 14 rows copied verbatim from data.jsx ...
]
```
(The executor copies all rows; the two shown/omitted are filled in completely — no `...` left in the real file.)

- [ ] **Step 11: Write failing test for the service** `src/services/doctor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getQueue, getDaySummary } from './doctor'

describe('doctor service', () => {
  it('getQueue(0) returns only reference-day patients', async () => {
    const rows = await getQueue(0)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(p => p.day === 0)).toBe(true)
  })
  it('getDaySummary(0) counts queue and done for the day', async () => {
    const s = await getDaySummary(0)
    expect(s.queue).toBeGreaterThanOrEqual(0)
    expect(s.done).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 12: Run — Expected FAIL**: `npm run test -- services/doctor`

- [ ] **Step 13: Implement the service seam** `src/services/doctor.ts`:
```ts
import type { Patient, DaySummary } from '@/domain/types'
import { PATIENTS, REC_SERVICES } from '@/data/doctor'

// Async on purpose: this is the seam a real backend (Odoo/API) replaces later.
export async function getQueue(dayOffset: number): Promise<Patient[]> {
  return PATIENTS.filter(p => (p.day ?? 0) === dayOffset)
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

- [ ] **Step 14: Run — Expected PASS**: `npm run test -- services/doctor`
- [ ] **Step 15: Commit** — `git add -A && git commit -m "feat: doctor domain types, format/date helpers, mock data + service seam (TDD)"`

---

### Task 7: Worklist screen — banner + summary + queue table (re-skinned)

**Files:** `src/features/doctor/status.ts`, `GreetingBanner.tsx`, `SummaryCards.tsx`, `QueueTable.tsx`, `Worklist.tsx` (+ co-located tests). Re-skin the prototype's `worklist.jsx` / `app.jsx` markup onto design-system components; keep behaviour + Russian copy.

- [ ] **Step 1: Status map** `src/features/doctor/status.ts`:
```ts
import type { PatientStatus } from '@/domain/types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
export const STATUS_META: Record<PatientStatus, { label: string; variant: BadgeVariant }> = {
  queue:   { label: 'В очереди',  variant: 'secondary' },
  invited: { label: 'Приглашён',  variant: 'outline' },
  now:     { label: 'Идёт приём', variant: 'default' },
  paused:  { label: 'Пауза',      variant: 'outline' },
  done:    { label: 'Осмотрен',   variant: 'secondary' },
}
```

- [ ] **Step 2: Greeting banner** `src/features/doctor/GreetingBanner.tsx` — ported from `app.jsx` GreetBanner (day arrows + label), re-skinned:
```tsx
import { Stethoscope, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pluralizePatients } from '@/domain/format'
import { formatDayLabel, dayOffset } from '@/domain/dates'

export function GreetingBanner({ day, count, onShiftDay }: { day: Date; count: number; onShiftDay: (delta: number) => void }) {
  const isToday = dayOffset(day) === 0
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Stethoscope className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">Рабочее место врача</div>
        <div className="text-sm text-muted-foreground">
          {isToday ? <>Сегодня вас ждут <b>{count} {pluralizePatients(count)}</b>.</>
                   : <>На выбранный день в очереди <b>{count} {pluralizePatients(count)}</b>.</>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" aria-label="Предыдущий день" onClick={() => onShiftDay(-1)}><ChevronLeft className="size-4" /></Button>
        <span className="min-w-52 text-center text-sm font-medium">{formatDayLabel(day)}</span>
        <Button variant="outline" size="icon" aria-label="Следующий день" onClick={() => onShiftDay(1)}><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Summary cards** `src/features/doctor/SummaryCards.tsx` — ported from prototype SummaryCards; four KPI cards:
```tsx
import { Card, CardContent } from '@/components/ui/card'
import type { DaySummary } from '@/domain/types'

const CARDS: { key: keyof DaySummary; label: string }[] = [
  { key: 'queue', label: 'В очереди' },
  { key: 'done', label: 'Осмотрено' },
  { key: 'recs', label: 'Рекомендаций' },
  { key: 'recsDone', label: 'Выполнено' },
]

export function SummaryCards({ summary }: { summary: DaySummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map(c => (
        <Card key={c.key}>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{summary[c.key]}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Queue table** `src/features/doctor/QueueTable.tsx` — the prototype `.tbl` re-skinned onto `Table`; columns: #, patient (avatar+name), visit/type, service, coverage, time, status:
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Patient } from '@/domain/types'
import { initials, avatarColor } from '@/domain/format'
import { STATUS_META } from './status'

export function QueueTable({ patients, onOpen }: { patients: Patient[]; onOpen: (p: Patient) => void }) {
  if (patients.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">На выбранный день пациентов нет.</div>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">№</TableHead>
          <TableHead>Пациент</TableHead>
          <TableHead>Приём</TableHead>
          <TableHead>Услуга</TableHead>
          <TableHead>Оплата</TableHead>
          <TableHead>Время</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map(p => {
          const meta = STATUS_META[p.status]
          return (
            <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p)}>
              <TableCell className="text-muted-foreground tabular-nums">{p.num}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8"><AvatarFallback style={{ background: avatarColor(p.name), color: '#fff' }}>{initials(p.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.age} лет · {p.sex}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{p.visit} · {p.stype}</TableCell>
              <TableCell className="max-w-64 truncate text-sm">{p.service}</TableCell>
              <TableCell className="text-sm">{p.coverage}</TableCell>
              <TableCell className="text-sm tabular-nums">{p.time}</TableCell>
              <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: Worklist container** `src/features/doctor/Worklist.tsx` — loads the day's queue via the service, holds the selected `day`, tabs for Очередь/Дашборд (dashboard is a placeholder in this plan):
```tsx
import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Patient, DaySummary } from '@/domain/types'
import { getQueue, getDaySummary } from '@/services/doctor'
import { REFERENCE_DAY, dayOffset } from '@/domain/dates'
import { GreetingBanner } from './GreetingBanner'
import { SummaryCards } from './SummaryCards'
import { QueueTable } from './QueueTable'

export function Worklist() {
  const [day, setDay] = useState<Date>(() => new Date(REFERENCE_DAY))
  const [patients, setPatients] = useState<Patient[]>([])
  const [summary, setSummary] = useState<DaySummary>({ queue: 0, done: 0, recs: 0, recsDone: 0 })

  useEffect(() => {
    const off = dayOffset(day)
    let alive = true
    Promise.all([getQueue(off), getDaySummary(off)]).then(([q, s]) => { if (alive) { setPatients(q); setSummary(s) } })
    return () => { alive = false }
  }, [day])

  const shiftDay = (delta: number) => setDay(d => { const n = new Date(d); n.setDate(n.getDate() + delta); return n })
  const openPatient = (_p: Patient) => { /* Plan 2: navigate to /doctor/consultation/:id */ }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <GreetingBanner day={day} count={summary.queue} onShiftDay={shiftDay} />
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Очередь приёма</TabsTrigger>
          <TabsTrigger value="dash">Дашборд</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="space-y-4">
          <SummaryCards summary={summary} />
          <QueueTable patients={patients} onOpen={openPatient} />
        </TabsContent>
        <TabsContent value="dash">
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Дашборд — в следующем плане.</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 6: Smoke test** `src/features/doctor/Worklist.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Worklist } from './Worklist'

describe('Worklist', () => {
  it('renders the queue for the reference day with no axe violations', async () => {
    const { container, findByText } = render(<Worklist />)
    expect(await findByText('Очередь приёма')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('table')).toBeTruthy())
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 7: Point the `doctor` route at `<Worklist />`** in `src/app/router.tsx` (if it was stubbed in Task 5 Step 2).

- [ ] **Step 8: Run — Expected PASS**: `npm run verify`
- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat(doctor): worklist screen (banner + summary + queue table) on design system"`

---

### Task 8: Full gate + deploy config + palette-gate handoff

**Files:** `vercel.json` (or `netlify.toml`), `README.md` (update).

- [ ] **Step 1: SPA host config** — add a static-host rewrite so client routes work on refresh. `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- [ ] **Step 2: Full verify + build**
```bash
npm run verify && npm run build
```
Expected: tsc clean; all tests pass (format, dates, services/doctor, AppShell, Worklist); `dist/` written.

- [ ] **Step 3: Manual palette check (owner gate)** — `npm run dev`, open `/doctor` and `/_preview`. Confirm: medical palette (calm blue-teal, not gray), no emojis, Russian copy, queue table renders the 9 sample patients filtered to the reference day, day arrows change the day. **This is the owner's palette-approval gate before Plan 2.**

- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: SPA host rewrite + build check; worklist ready for palette review"`

---

## Self-Review (plan author)

**Spec coverage:** §1 goal → whole plan. §2 decisions: all-5-scope → route stubs (Task 5) + spec §9 decomposition; fresh look from design system → Task 2 (copy) + Task 3 (medical tokens); reuse → Tasks 6–7 (logic/data ported, re-skinned); Vite/React/TS → Task 1; mock+seam → Task 6 (`src/services`); Russian → copy verbatim; static deploy → Task 8; router → Task 5; palette-gate validation → Task 8 Step 3. §3 architecture: shell (Task 4), router (Task 5), design-system copy+theme (Tasks 2–3), reuse table (Task 7), data seam (Task 6). §4 look → Task 3 tokens + no-emoji/lucide throughout. §5 build order → this plan is Foundation + Doctor worklist (the rest are follow-up plans; noted in header + Task 5). §6 success criteria → Task 8.

**Placeholder scan:** The only ellipses are in Task 6 Step 10 (mock-data copy) with an explicit instruction to copy all rows verbatim from `data.jsx` (a mechanical copy, source cited) — not hand-waving. Dashboard/consultation are explicitly deferred to Plan 2, not vaguely skipped. All code steps show real code.

**Type consistency:** `Patient`/`PatientStatus`/`DaySummary` defined in `domain/types.ts` and used identically in `data/doctor.ts`, `services/doctor.ts`, `features/doctor/*`. `getQueue(dayOffset)`/`getDaySummary(dayOffset)` signatures match between service definition (Task 6) and Worklist usage (Task 7). `STATUS_META` keys cover every `PatientStatus`. `dayOffset`/`formatDayLabel`/`REFERENCE_DAY` defined in `dates.ts` and used in banner + worklist. Badge `variant` union matches the design-system Badge API.

**Scope:** Foundation + one real screen — self-contained, deployable, testable. Consultation, dashboard, prints, and the other four modules are separate follow-up plans on this foundation.
