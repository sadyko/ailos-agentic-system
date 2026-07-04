# Aurora Redesign — Plan 20: Patient card — Рекоменд., Лояльность, Кешбэк, Общение, Файлы

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace five more card-tab stubs. **Рекоменд.**: open/cancelled recommended services + prescribed medications (informative, with the «Новый визит» hint + print-recipe button). **Лояльность**: personal-discount panel (big %, level, patient-category select, discount slider + apply), loyalty summary, and three columns — vouchers (value + active/used chips), promo codes (apply input + list), gift certificates (balance bars + «Выпустить»). **Кешбэк**: hero balance card + percent, начислено/списано summary, rules line, and the ledger table (operation icons, base-amount `× 3% кешбэк` explainer, Начисление/Списание chips, running Остаток). **Общение**: channel status cards (Телефон/WhatsApp/Telegram w/ connect action), message composer (channel tabs + quick templates + counter + send appends to the thread), auto-notification switches, calls history table (direction, result chips), and the SMS/messenger thread bubbles. **Файлы**: search + grid/list toggle over patient files (ext-colored thumbs, view/download actions) + FileUploadModal (computer with drag-drop / by-link modes, document-type select; uploads land in the list).

**Architecture:** Task 1 ports the remaining datasets verbatim into `src/data/patientCard.ts` — `CARD_FILES` (8), `CARD_LOYALTY` (discount/level/category/categories/vouchers 3/promos 2/certificates 2), `CARD_CASHBACK` (percent/balance/tier/maxPay/rules + 5-row ledger with running balances) — and extends the `getPatientCard()` bundle (`files`, `loyalty`, `cashback`) + tests (incl. `cashback.ledger[0].balance === cashback.balance` continuity). Tabs in `src/features/registration/card/`: `RecsTab.tsx`, `LoyaltyTab.tsx`, `CashbackTab.tsx`, `CommsTab.tsx`, `FilesTab.tsx` (with `FileUploadModal` + a shared `fileMeta(ext)` helper in-file). All wired in `PatientCardPage.tsx`; after this plan only `checkup` and `docs` remain stubbed (they depend on the doc-print/checkup subsystems — next slice). Ported from `reg-card2.jsx:173-337` (Recs/Loyalty), `:339-409` (Cashback), `:412-526` (Comms), `:616-794` (Upload/Files), `reg-data.jsx:155-198` (data).

**Tech Stack:** React 19, TS, design-system `Card`/`Table`/`Badge`/`Button`/`Input`/`Textarea`/`Select`/`Switch`/`Dialog`, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons.

---

### Task 1: Remaining card datasets (TDD-light)

**Files:** `src/data/patientCard.ts` (extend), `src/services/patientCard.ts` (extend), `src/services/patientCard.test.ts` (extend).

- [ ] **Step 1: Extend the data file** (verbatim from `reg-data.jsx:155-198,167-184`):
```ts
export interface CardFile { name: string; type: string; ext: string; date: string; author: string; size: string }
export const CARD_FILES: CardFile[] = [
  { name: 'Паспорт (AA 1234567)', type: 'Документ, удостоверяющий личность', ext: 'pdf', date: '12.03.2025', author: 'Регистратура · Хилола А.', size: '1.2 МБ' },
  { name: 'Заключение онкопроктолога', type: 'Медицинское заключение', ext: 'pdf', date: '02.06.2026', author: 'Казанцева Н. В.', size: '340 КБ' },
  { name: 'Снимок МРТ малого таза', type: 'Снимок / исследование', ext: 'jpg', date: '28.05.2026', author: 'Ибрагимов А. К.', size: '4.8 МБ' },
  { name: 'Информированное согласие', type: 'Согласие пациента', ext: 'pdf', date: '02.06.2026', author: 'Регистратура · Дилфуза Ш.', size: '180 КБ' },
  { name: 'Полис ДМС Gross Insurance', type: 'Страховой полис', ext: 'pdf', date: '15.01.2026', author: 'Регистратура · Хилола А.', size: '260 КБ' },
  { name: 'Результат ОАК', type: 'Лабораторный бланк', ext: 'pdf', date: '28.05.2026', author: 'Лаборатория', size: '96 КБ' },
  { name: 'Фото пациента', type: 'Фотография', ext: 'png', date: '12.03.2025', author: 'Регистратура · Хилола А.', size: '540 КБ' },
  { name: 'Договор оказания услуг', type: 'Договор', ext: 'docx', date: '12.03.2025', author: 'Регистратура · Хилола А.', size: '72 КБ' },
]
export const FILE_TYPES = ['Документ, удостоверяющий личность', 'Медицинское заключение', 'Снимок / исследование', 'Согласие пациента', 'Страховой полис', 'Лабораторный бланк', 'Фотография', 'Договор', 'Прочее']

export interface Voucher { title: string; code: string; value: string; valid: string; status: 'active' | 'used' }
export interface Promo { code: string; desc: string; status: 'applied' | 'used' }
export interface Certificate { num: string; balance: number; total: number; valid: string; from: string }
export interface CardLoyalty { discount: number; level: string; since: string; category: string; categories: string[]; vouchers: Voucher[]; promos: Promo[]; certificates: Certificate[] }
export const CARD_LOYALTY: CardLoyalty = {
  discount: 10, level: 'Серебряный', since: '03.2025',
  category: 'Список Учредителя',
  categories: ['Стандарт', 'Сотрудник', 'Список Учредителя', 'Список Ген. директора', 'Партнёр', 'VIP'],
  vouchers: [
    { title: 'Скидка 15% на лабораторию', code: 'LAB15', value: '−15%', valid: 'до 31.07.2026', status: 'active' },
    { title: 'Бесплатная консультация терапевта', code: 'FREEGP', value: '1 услуга', valid: 'до 30.06.2026', status: 'active' },
    { title: 'Скидка на УЗИ', code: 'UZI50', value: '−50 000 сум', valid: 'истёк 01.05.2026', status: 'used' },
  ],
  promos: [
    { code: 'SUMMER2026', desc: '−10% на лучевую диагностику', status: 'applied' },
    { code: 'WELCOME5', desc: '−5% на первый визит', status: 'used' },
  ],
  certificates: [
    { num: 'GC-2026-0431', balance: 500000, total: 500000, valid: 'до 31.12.2026', from: 'Подарок к юбилею' },
    { num: 'GC-2025-1180', balance: 120000, total: 300000, valid: 'до 30.09.2026', from: 'Корпоративный' },
  ],
}

export interface CashbackOp { date: string; type: 'in' | 'out'; service: string; doctor: string; base: number | null; amount: number; balance: number }
export interface CardCashback { percent: number; balance: number; tier: string; maxPay: number; rules: string; ledger: CashbackOp[] }
export const CARD_CASHBACK: CardCashback = {
  percent: 3, balance: 0, tier: 'Базовый', maxPay: 30,
  rules: 'Начисляется 3% от оплаченных услуг. Кешбэком можно покрыть до 30% суммы счёта.',
  ledger: [
    { date: '02.06.2026', type: 'out', service: 'Промо-акция «−15% на МРТ»', doctor: 'Отдел маркетинга', base: null, amount: 14800, balance: 0 },
    { date: '02.06.2026', type: 'in', service: 'Приём (осмотр, консультация) онкопроктолога', doctor: 'Казанцева Н. В.', base: 280000, amount: 8400, balance: 14800 },
    { date: '28.05.2026', type: 'out', service: 'МРТ малого таза', doctor: 'Ибрагимов А. К.', base: 680000, amount: 20000, balance: 6400 },
    { date: '28.05.2026', type: 'in', service: 'МРТ малого таза', doctor: 'Ибрагимов А. К.', base: 680000, amount: 20400, balance: 26400 },
    { date: '20.05.2026', type: 'in', service: 'Приём (осмотр, консультация) терапевта', doctor: 'Юсупова Д. М.', base: 200000, amount: 6000, balance: 6000 },
  ],
}
```
(NOTE: `CARD_CASHBACK_PERCENT` from Plan 17 stays for the header metric; keep both exports consistent — `CARD_CASHBACK.percent === CARD_CASHBACK_PERCENT`.)

- [ ] **Step 2: Extend the service bundle** with `files: CARD_FILES, loyalty: CARD_LOYALTY, cashback: CARD_CASHBACK` and the bundle test: `expect(c.files).toHaveLength(8)`, `expect(c.loyalty.vouchers).toHaveLength(3)`, `expect(c.cashback.ledger).toHaveLength(5)`, `expect(c.cashback.ledger[0].balance).toBe(c.cashback.balance)` (newest-first continuity). Run test-first where practical (extend the test, see it fail, then extend data/service).

- [ ] **Step 3:** `npm run verify` green. Commit: `git add -A && git commit -m "feat(registration): files/loyalty/cashback datasets (TDD)"`

---

### Task 2: RecsTab + LoyaltyTab + CashbackTab

**Files:** `RecsTab.tsx`, `LoyaltyTab.tsx`, `CashbackTab.tsx`; wire `recs`/`loyalty`/`cashback` in `PatientCardPage.tsx`; extend the page test (switch to Лояльность → `findAllByText('SUMMER2026')`; to Кешбэк → `findAllByText('Начисление')` non-empty).

- [ ] **RecsTab** (`reg-card2.jsx:173-229`; props `{ card, notify }`): two Cards side-by-side (`lg:grid-cols-2`). LEFT «Рекомендованные услуги» + count: rows over `card.recs.filter(r => r.status === 'open' || r.status === 'cancelled')` — name semibold, meta `{cat} · {by} · {date}`, right price bold + chip (open → queue-chip «Рекомендовано», cancelled → muted «Отменено» with X icon; cancelled rows dimmed); empty state; footer note «Справочно. Чтобы выполнить — нажмите «Новый визит», список подтянется в назначения.» (info box with icon). RIGHT «Назначенные медикаменты» + count: rows over `card.rx` (Pill icon, name, `{dose} · {by}`, date right), footer full-width secondary «Распечатать рецепт» → notify «Рецепт отправлен на печать».

- [ ] **LoyaltyTab** (`:231-337`; props `{ card, notify }`; `L = card.loyalty`): top Card with three zones (grid `lg:grid-cols-3`): (1) «Персональная скидка» — big `{disc}%` number (local state seeded `L.discount`), «Уровень: {level} · с {since}», «Категория пациента:» design-system Select over `L.categories` (onChange notify «Категория пациента: X»); (2) «Сводка по лояльности» — rows Активных ваучеров `X из N` / Активных промокодов / Сертификаты `N · {sum} сум` / Кешбэк `{card.cashback.percent}% начисление`; (3) «Изменить скидку» — native `<input type="range" min=0 max=30>` (aria-label) + 0%/макс. 30% labels + primary «Применить скидку» → notify «Персональная скидка обновлена: X%». Below: three columns (`lg:grid-cols-3`): Ваучеры (Tag icon, title, `code · valid`, right value + active/used chip; used dimmed); Промокоды (apply row: Input «Промокод» + «OK» button → notify «Промокод применён»; list: code mono + Активен/Использован chip + desc); Сертификаты (header + ghost «Выпустить» → notify; each: num mono, `{balance} / {total} сум` bold, progress bar `balance/total`%, `{from} · {valid}` muted).

- [ ] **CashbackTab** (`:339-409`; props `{ card }`; `C = card.cashback`): summary row — hero Card (Star icon tile, «Кешбэк-счёт», big `{moneyFmt(C.balance)} сум`, «доступно к списанию», right `{C.percent}%`/«начисление»), «Начислено всего» `+sum(in)` ok, «Списано всего» `−sum(out)` destructive. Rules info-box: `{C.rules} Текущий уровень: {C.tier}.`. Ledger table: Дата / Название услуги (op icon by service regex: Промо|акци→Tag, МРТ|КТ|УЗИ|снимок|рентген→Image, Приём|консультац|осмотр→Stethoscope, else FlaskConical; tinted in/out) + doctor sub / Сумма услуги (base + sub `× {percent}% кешбэк` for in, «оплата частью счёта» for out; «—» when base null) / Тип chip (Начисление ok / Списание warn) / Кешбэк signed colored bold / Остаток bold + «сум».

- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): card Рекоменд./Лояльность/Кешбэк tabs"`

---

### Task 3: CommsTab + FilesTab (+ FileUploadModal)

**Files:** `CommsTab.tsx`, `FilesTab.tsx`; wire `comms`/`files`; extend the page test (Общение → `findAllByText('История звонков')`; Файлы → `findAllByText('Полис ДМС Gross Insurance')`).

- [ ] **CommsTab** (`:412-526`; props `{ patient, card, notify }`):
  - Channel cards row: Телефон / SMS (`{patient.phone}`, ok «Активен»), WhatsApp (`{patient.phone}`, ok «Подключён»), Telegram-бот («подключён»/«не подключён» from `patient.tg`; ok chip or secondary «Подключить» → notify «Приглашение в Telegram-бот отправлено»).
  - Composer Card «Отправить сообщение»: channel toggle tabs (SMS blue MessageSquare / WhatsApp green Phone / Telegram Send — active tinted), quick-template chips (`['Напоминание о визите','Результаты готовы','Поздравление с ДР','Профилактический осмотр']` → set msg to `{t}: `), Textarea (placeholder «Текст сообщения для {channel}…»), counter «N симв.», primary «Отправить» → validates non-empty (warn «Введите текст сообщения»), prepends a message to a LOCAL thread state (`date: '06.06.2026 ' + current HH:MM`, dir out, status Доставлено) + notify «{Channel} отправлено пациенту» + clears.
  - «Автоуведомления» Card: 5 rows (Напоминание о визите «за 1 день и за 2 часа»; Результаты анализов готовы «сразу после публикации»; Поздравление с днём рождения «в день рождения»; Акции и спецпредложения «по расписанию маркетинга»; Неоплаченный счёт «при наличии задолженности») each with a design-system `Switch` (defaults: visit/results/birthday/debt on, promo off; aria-label per row).
  - «История звонков» table over `card.calls`: date · direction icon (in/out tinted PhoneIncoming/PhoneOutgoing or rotated Phone; title Входящий/Исходящий) · who semibold · topic muted · Длит. · result chip (Дозвонились/Записан ok, Перезвонить warn, Не дозвонились muted).
  - «Переписка в SMS и мессенджерах»: thread state seeded from `card.messages`; bubbles — out right-aligned tinted, in left; channel icon chip + text + meta `{date} · {Channel} · исходящее/входящее · {status}`.

- [ ] **FilesTab + FileUploadModal** (`:616-794`; props `{ notify }`):
  - In-file `fileMeta(ext)`: pdf → `['var(--color-destructive)','bg-destructive/10','PDF']`-style tuples (use tailwind classes for bg + inline color where needed; label = ext uppercase; jpg/png get Image icon, else FileText).
  - Toolbar: search («Поиск по файлам…», matches name+type+author), grid/list ToggleGroup (Сетка/Список), primary «Загрузить файл» → modal.
  - Grid view: file cards — colored thumb (icon + ext label + hover actions eye/download → notifies «Просмотр «X»» / «Файл «X» скачивается»), name, type, meta (date · author · size). List view: table with thumb, Название (+ext chip), Тип документа, Дата загрузки, Автор загрузки, Размер (right), Действия (eye/download).
  - `FileUploadModal` (Dialog): mode ToggleGroup «С компьютера»/«По ссылке»; computer mode = drag-drop zone («Перетащите файл сюда или нажмите, чтобы выбрать», «PDF, JPG, PNG, DOCX… до 25 МБ»; hidden file input; picked state shows ext chip + name + size (`formatBytes` local) + «Заменить»); link mode = URL Input (+ derived «Имя файла: X»); «Тип документа» Select over `FILE_TYPES`; «Загрузить» disabled until valid → `onUpload({name,type,ext,date:'06.06.2026',author:'Регистратура · Исломбек К.'(+' (по ссылке)'),size})` → prepends to the local files list + notify «Файл «X» загружен в профиль пациента».

- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `git add -A && git commit -m "feat(registration): card Общение + Файлы tabs (composer, switches, calls, thread, upload)"`

---

### Task 4: Gate + screenshots
- [ ] `npm run verify && npm run build`; (controller) screenshots: Лояльность, Кешбэк, Общение, Файлы (grid + upload modal optional).

---

## Self-Review (plan author)

**Spec coverage:** Five content tabs ported with their real behaviours (loyalty slider/category/promo-apply; cashback running-balance ledger with op icons + explainers; comms composer that actually appends to the thread + auto-notification switches + calls/messages; files with search/grid-list/upload incl. drag-drop and by-link). Data verbatim (files/loyalty/cashback) with a ledger-continuity test. After this plan only Чек-ап + Документы remain (doc-print/checkup subsystems — explicitly deferred).

**Placeholder scan:** behaviour enumerations complete with prototype refs; all data/deps defined here or in prior plans. No TBDs.

**Type consistency:** new interfaces exported from data; bundle extends `PatientCardData`; existing `CARD_CASHBACK_PERCENT` kept consistent; `moneyFmt`/`CHIP_TONE`/design-system Switch/Select reused; tab keys match the Plan-17 registry (`recs`,`loyalty`,`cashback`,`comms`,`files`).

**Scope:** Five lighter tabs in two implementation dispatches; data TDD'd, page tests extended, visually verified.
