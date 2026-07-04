# Aurora Redesign — Plan 21: Patient card — Чек-ап tab (packages, allocation math, assign/manage, summary print)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace the last heavy card-tab stub. **Чек-ап** shows the patient's assigned check-up packages as a grouped table (one banner row per package — collapse toggle, name + «Пакет · N услуг», assigned/curator/progress meta, «В корзине»/«Завершён» badge, package totals: gross price sum, package-% tag, −discount, package price, «Сводное» print, actions kebab — then child service rows: name (+ «на выбор» option dropdown), doctor, visit time (date/time split), room, added-by, invoice/pay/status chips, qty, price, «Пакет» discount tag, −discount, amount, docs clip with count, per-row детали). Actions: **Назначить чек-ап** (catalog modal → package added to the table with the package discount allocated across lines), package menu (add-service/referrer notify-stubs, «Запланировать позже», «Отменить счёт», «Отменить чек-ап», «Удалить чек-ап» with done-guards), per-service донастройка (doctor/time/qty; package discount read-only), docs modal (result pills → download notify), and the consolidated **Сводное заключение** print.

**Architecture:** Task 1 TDDs `src/domain/checkup.ts` — `chkAllocate(lines, pkgPrice)` (proportional package-discount allocation, last line takes the rounding remainder; **fixture: allocating the cardio catalog package MUST reproduce the exact `pkgAlloc` values already in CARD_SERVICES CK1 rows: [25926, 8333, 22222, 32407, 11112], amounts summing to 980 000**), `svcSettled` (issued+paid+done), `svcInCart` (!cancelled && !settled) — and ports data: `CHK_CATALOG` (3 programs verbatim incl. the «на выбор» choice row), `CARD_CHECKUPS` meta (CK1), `SRV_DOCTORS` (3 names, reg-data.jsx:221). Task 2 builds `CheckupTab.tsx` (+ in-file ChkAssignModal/ChkMenu/ChkSvcDetail/ChkDocsModal) with LOCAL services state seeded from `card.services` (same pattern as ServicesTab's `rows`), wires it into `PatientCardPage.tsx` (stubs left: only `docs`). Print via the house `card/printHtml.ts` frame (Aurora branding — NOT the prototype's Medion red). Ported from `reg-card2.jsx:1005-1279`, `reg-data.jsx:64-100,221`.

**Tech Stack:** React 19, TS, design-system Card/Table/Badge/Button/Input/Select/Dialog/DropdownMenu (or Dialog-list menu per house idiom), lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis; lucide icons; `moneyFmt` strips signs (prefix − manually); Radix Tabs tests need mouseDown-then-click; Dialog width via `sm:max-w-*`.

---

### Task 1: checkup domain + data (TDD)

**Files:** `src/domain/checkup.ts` (new), `src/domain/checkup.test.ts` (new), `src/data/patientCard.ts` (extend), `src/services/patientCard.ts` (extend), `src/services/patientCard.test.ts` (extend).

- [ ] **Step 1 (RED): write `src/domain/checkup.test.ts` first.**
  - `chkAllocate` fixtures (hand-computed):
    - Cardio package: lines with prices `[280000, 90000, 240000, 350000, 120000]` (qty 1), pkgPrice `980000` → sum `1080000`, disc `100000` → per-line discounts `[25926, 8333, 22222, 32407, 11112]` (first four = `Math.round(price/sum*disc)`, last = remainder), `pkgAlloc` mirrors discount, amounts = price−discount, `sum(amount) === 980000`. These MUST equal the CK1 `pkgAlloc`s already in CARD_SERVICES — assert against the literals.
    - No-discount passthrough: `pkgPrice >= sum` returns lines unchanged; `pkgPrice == null` unchanged; empty list unchanged.
    - Pre-existing line discount is ADDED to (`discount:(l.discount||0)+d`).
    - qty respected: price 100000 qty 2 counts as 200000 in the base.
  - `svcSettled`: true only for `invoice==='issued' && pay==='paid' && status==='done'`; `svcInCart`: false for cancelled, false for settled, true for planned/unpaid combos.
- [ ] **Step 2 (GREEN): implement `src/domain/checkup.ts`** — pure functions, typed against `CardService` (import the type; `chkAllocate` may take a minimal structural type `{ price, qty?, discount? }[]` + return with `pkgAlloc`).
- [ ] **Step 3: port data** (verbatim, `reg-data.jsx:73-100,221`) into `src/data/patientCard.ts`:
```ts
export interface ChkCatalogSvc { n: string; p: number; type: string; choice?: boolean; options?: string[] }
export interface ChkProgram { name: string; dir: string; pkgPrice: number; services: ChkCatalogSvc[] }
export const CHK_CATALOG: ChkProgram[] = [ /* Диабет-контроль 1150000 (6 услуг, одна choice с 3 options) / Сердце под контролем 980000 (5) / Женское здоровье 1340000 (5) — verbatim */ ]
export interface CardCheckupMeta { id: string; name: string; pkgPrice: number; assignedAt: string; curator: string }
export const CARD_CHECKUPS: CardCheckupMeta[] = [ { id: 'CK1', name: 'Чек-ап «Сердце под контролем»', pkgPrice: 980000, assignedAt: '02.06.2026', curator: 'Бакиева М. А.' } ]
export const SRV_DOCTORS = ['Бакиева Малика Алимовна', 'Абдуллаев Бекзоджон Кутбиддинович', 'Казанцева Наталья Владимировна']
```
  Extend the `getPatientCard()` bundle with `checkups: CARD_CHECKUPS` and `chkCatalog: CHK_CATALOG`; bundle test asserts `chkCatalog` has 3 programs and `checkups[0].id === 'CK1'`. Note: `CardService` needs `choice?/options?/chosen?` optional fields for catalog-added rows (extend the interface; existing rows unchanged).
- [ ] **Step 4:** `npm run verify` green. Commit: `feat(registration): checkup domain (package allocation TDD) + catalog data`

---

### Task 2: CheckupTab + modals + wire-in

**Files:** `src/features/registration/card/CheckupTab.tsx` (new; in-file ChkAssignModal, ChkMenu, ChkSvcDetail, ChkDocsModal), `PatientCardPage.tsx` (wire `checkup`, remove from stubs — only `docs` stays), `CheckupTab.test.tsx` (new), page test (extend).

Props `{ patient, card, notify }`. Local state: `svcs` seeded `card.services.map((s,i)=>({...s,_id:i}))`; `metas` seeded from `card.checkups` (local copy — assignments push into it); `collapsed` record; modal states (`assign`, `detail:_id|null`, `docsOf:_id|null`, `ckMenu:checkupId|null`).

- [ ] **Header row:** «Чек-апы пациента · {N}» (N = distinct checkupIds) + primary «Назначить чек-ап». Empty state (CheckCircle icon, «У пациента нет назначенных чек-апов.», soft «Назначить программу») when N=0.
- [ ] **Grouped table** (`reg-card2.jsx:1085-1164`): columns Услуга/Врач/Время визита/Кабинет/Кто добавил/Счёт/Оплата/Статус/Кол-во/Стоимость/Скидка/Сумма скидки/Сумма/Документы/(actions). Per checkupId:
  - **Banner row** (colSpan over the left columns): chevron collapse toggle (rotates when open), CheckCircle icon tile, `{name}` + «Пакет · {totalN} услуг», meta «Назначен {assignedAt} · куратор {curator} · выполнено {performedN}/{totalN}» (live = not cancelled; performed = done), badge «В корзине» (any live not settled — use `svcInCart`) else «Завершён»; then gross `priceSum` (Σ price·qty), package-% tag `({disc/priceSum*100).toFixed(1)` with comma decimal + `%`) or «—», `−{disc}` or «—», bold `pkgPrice || sum`, «Сводное» button (Printer icon) → summary print, kebab (MoreHorizontal) → ChkMenu.
  - **Child rows** (when open; cancelled rows dimmed): name (+ if `choice && !chosen` a Select «Выбрать вариант…» over options → `setSvc(_id, {chosen: v, name: v})`; if chosen: «выбрано: {chosen} · сменить» link resetting chosen); doctor; time split by regex `^(\d{2}\.\d{2}\.\d{4})\s*[·]?\s*(.*)$` into date line + time line else single line; room; addedBy; invoice chip (issued → ok chip with invoiceNo, else INV chip map), pay chip, status chip (reuse `serviceStatus.ts` maps); qty; price; «Пакет» tag when discount>0 else «—»; `−{discount}` or «—»; bold amount; docs clip button (FileText + count badge when docs.length>0) → ChkDocsModal; детали button → ChkSvcDetail.
- [ ] **ChkAssignModal** (`:1256-1279`, Dialog): 3 program cards — name + `{pkgPrice} сум`, «{dir} · {N} услуг · выгода {sum−pkgPrice} сум» (only when sum>pkgPrice), first-3 service names joined « · » + « …», primary «Назначить в корзину» → `addCheckup(cat)`.
- [ ] **addCheckup** (`:1057-1068`): id `CK${metas.length + 1}...` — deterministic, NOT Date.now() (e.g. next unused `CK{n}`); rows from catalog services (`date:'06.06.2026'`, doneDate:'', doctor:'—', room:'—', time:'по записи', addedBy:'Кадыров Исломбек Х.', status:'planned', invoice:'none', pay:'unpaid', qty:1, price:p, discount:0, amount:p, checkupId:newId, docs:[], choice/options/chosen) → `chkAllocate(rows, pkgPrice)` → prepend with fresh `_id`s; push meta `{id, name, pkgPrice, assignedAt:'06.06.2026', curator:'—'}`; close; notify «Чек-ап назначен в корзину: {name}».
- [ ] **ChkMenu** (`:1172-1181,1187-1205`, Dialog list): title = package name; items (icon, label, sub, disabled, tone): «Добавить услугу в пакет» → notify «Добавление услуги в пакет — в окне назначений»; «Указать направителя» → notify «Направитель — раздел в разработке»; «Запланировать позже» → all planned rows of the package get `time:'по записи'` + notify; «Отменить счёт» (disabled unless some invoice issued AND none done) → package rows `{invoice:'none', invoiceNo:'', pay:'unpaid'}` + warn notify; «Отменить чек-ап» (warn tone, disabled if any done) → rows `status:'cancelled'` + warn notify; «Удалить чек-ап» (danger tone, disabled if any done) → rows removed + warn notify. Footer note «Отмена и удаление доступны, пока услуги не выполнены.»
- [ ] **ChkSvcDetail** (`:1208-1234`, Dialog): name; Врач Select (`— не назначен —` + SRV_DOCTORS); Время визита Input (placeholder «06.06.2026 10:00–10:20 или «по записи»»); Кол-во number Input min 1; Скидка (пакетная) disabled Input; live «Сумма: {max(0, price·qty − discount)} сум»; Сохранить applies patch.
- [ ] **ChkDocsModal** (`:1237-1253`, Dialog): empty state («Результатов/заключений пока нет.» + «Появятся после выполнения услуги.») or doc pills → notify «Документ «X» скачивается».
- [ ] **Summary print** (`:1005-1037`): via house `printHtml.ts` frame (Aurora branding, house palette — NOT Medion red): title «Заключение по результатам комплексного обследования (чек-ап)», patient grid (Пациент/Дата рождения/№ карты/Дата заключения 06.06.2026/Программа/Куратор), table #/Услуга/Врач/Дата/Статус(выполнено|запланировано)/Результат-заключение (docs joined «; » or «—»), «Заключение и рекомендации:» block (prototype text verbatim), signature row «Куратор программы: … / Подпись / печать: ____________»; excludes cancelled rows; notify «Сводное заключение чек-апа отправлено на печать».
- [ ] **Wire-in + tests:** register `checkup` TabsContent in PatientCardPage (stub list → only `docs`). Page test: switch to Чек-ап → `findAllByText(/Сердце под контролем/)` non-empty. `CheckupTab.test.tsx`: render with `getPatientCard()` + axe zero violations; banner shows «выполнено 1/5» + «В корзине» for CK1; opening «Назначить чек-ап» and picking «Диабет-контроль» adds a second banner row with badge and notify called; «Удалить чек-ап» disabled for CK1 (has a done row); mock `window.open` for the print test (button click → notify, no crash).
- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `feat(registration): card Чек-ап tab (packages, assign, allocation, summary print)`

---

### Task 3: Gate + screenshots (controller)
- [ ] `npm run verify && npm run build`; screenshots: Чек-ап table (CK1 expanded), assign modal, package menu; owner checkpoint.

---

## Self-Review (plan author)

**Spec coverage:** Full CheckupTab behaviour ported: grouped banner/child table, choice rows, assign-from-catalog with the real allocation math (validated against the CK1 literals already shipped in Plan 17 data), package-level actions with done-guards, per-service донастройка, docs modal, consolidated print on the house frame. Determinism: no Date.now() ids (sequential CK ids), fixed dates as in prototype.

**Placeholder scan:** all data verbatim-referenced (reg-data.jsx:73-100,221); all modals specced with line refs. No TBDs.

**Type consistency:** `CardService` gains optional `choice/options/chosen`; chip maps reused from `serviceStatus.ts`; `moneyFmt` sign rule respected; local-state seeding matches ServicesTab's `_id` pattern.

**Scope:** one TDD domain task + one UI task + controller gate. After this, the card is 12/13 — only Документы (doc-print subsystem) remains.
