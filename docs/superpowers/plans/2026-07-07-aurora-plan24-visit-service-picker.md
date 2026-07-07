# Aurora Redesign — Plan 24: Visit registration 4b — the 5-column service picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace VisitPage's «Выбор услуг — следующий этап» placeholder with the real **service picker**: five radio-list columns — Типы услуг (9), Направление (10; when type=«Чек-ап» → the checkup catalog's directions), Услуги (per direction with prices; «Чек-ап» type lists catalog packages with a «пакет · N» tag + package price), Врачи (searchable; «Чек-ап» shows the info note instead), Временной слот (date nav header 05.06.2026; 8 slots where closed slots show «закрыт» and booked show «занят» with the occupant in the tooltip; both are disabled unless Тип пациента = Экстренный, which re-enables them with an «экстр.» tag) — plus two ⇄ **swap buttons** that reorder adjacent columns (тип⇄направление, услуги⇄врачи). Adds flow into the hoisted cart (pill bumps live): double-click on a service/doctor/slot or the footer button «Добавить в корзину» adds the selected service (with duplicate warning via `normName` — «…уже есть в назначениях (возможен дубль)»); for «Чек-ап» the footer becomes «Добавить чек-ап» and adds the whole package as a group with the package discount allocated across lines (`chkAllocate`) and a checkup meta entry. Header (subbar) gains three actions: **«Повторить пакет»** (adds the previous patient's 3-service set), **«Из шаблона»** (ServiceTemplateModal: searchable template list with load + «create template from current cart» with name input), **«Сбросить фильтры»** (clears all five selections + swap order + notify).

**Architecture:** Task 1 adds the visit-window checkup catalog to `src/data/visit.ts` (`CHECKUP_CATALOG` — the reg-services version: 2 programs with `cat` fields, distinct from the card's CHK_CATALOG; prototype keeps them separate — reg-services.jsx:172-188) and builds `ServicePicker.tsx` (+`PickerCol`/`SwapBtn` in-file) with the add flows lifted via props (`onAdd(line)`, `onAddCheckup(cat)`), wired into VisitPage panel 1; cart append logic lives in VisitPage (`addToCart`/`addCheckupToCart` — reg-services.jsx:308-327 verbatim incl. notify texts, deterministic ids from a counter ref, `chkAllocate` reused from `domain/checkup`). Task 2 adds the header actions + `ServiceTemplateModal.tsx` (`addPackage`/`saveTemplate` :328-340, LAST_PACKAGE/INIT_PACKAGES already ported in Plan 23) + `resetPicker` (:344-348). **Deliberate improvement:** the prototype's PickerCol search inputs are decorative (no onChange — reg-services.jsx:8-9); ours actually filter the column's list (case-insensitive contains). Slot-nav chevrons are decorative in the prototype — keep them as disabled buttons. Ported from `reg-services.jsx:3-27,75-94,97-142,171-188,301-348,591-673,702-733`.

**Tech Stack:** React 19, TS, design-system Card/Input/Button/Badge/Dialog, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian verbatim; no emojis (the ⚠ glyph inside prototype notify strings is a text glyph — keep it); lucide icons; no Date.now() (line ids from an incrementing ref; checkup ids `CK-{n}` from the same counter); added lines use `time: '05.06.2026 · ' + slot` / `'05.06.2026 · по записи'` literals.

---

### Task 1: CHECKUP_CATALOG data + ServicePicker + add flows

**Files:** `src/data/visit.ts` (extend: CHECKUP_CATALOG 2 programs verbatim from reg-services.jsx:172-188 — Диабет-контроль 1150000 w/ 6 services incl. the choice row (`choice:true`, 3 options), Сердце под контролем 980000 w/ 5; items `{n,p,cat}`), `src/services/visit.test.ts` (+count assert), `src/features/registration/visit/ServicePicker.tsx` (new), `VisitPage.tsx` (wire + add flows), `ServicePicker.test.tsx` / VisitPage test extension.

- [ ] **PickerCol** (:3-16): column with header (icon+title), optional search Input (REAL filtering — see improvement note), scrollable radio list, optional footer. **SwapBtn** (:19-27): small ⇄ button positioned at the column junction (Repeat lucide icon, aria-label «Поменять местами»).
- [ ] **Columns** (:591-673): types (radio items over SRV_TYPES; picking «Чек-ап» switches dir to the catalog's first dir + srv to first package; leaving «Чек-ап» resets dir «Кардиология», srv ''); directions (ckDirs when Чек-ап else SRV_DIRECTIONS); services (Чек-ап → packages with `пакет · {N}` tag + `{rfmt(pkgPrice)}` right, dbl-click adds package; else SRV_SERVICES[dir] rows name+price, dbl-click adds; footer hint «Двойной клик по услуге, врачу или слоту — добавить в корзину» / checkup variant); doctors (search on; Чек-ап → note «Для чек-апа врач назначается по каждой услуге внутри «Назначений».»; dbl-click doctor adds with that doctor); slots (no search; Чек-ап → note; else slot-nav header (disabled chevrons + 05.06.2026) + slot rows: closed = SRV_SLOTS_CLOSED, booked = SRV_SLOTS_BOOKED with tooltip `{pid} · {name} · {slot} · {service}`, `disabled` when (closed||booked) && ptype!=='emg', tags «занят»/«закрыт»/«экстр.», dbl-click adds with that slot; footer primary «Добавить в корзину»/«Добавить чек-ап»).
- [ ] **Swap order:** `dirFirst`/`docFirst` state; render `[dirFirst?dirs:types, Swap, dirFirst?types:dirs, docFirst?doctors:services, Swap, docFirst?services:doctors, slots]`.
- [ ] **Add flows in VisitPage** (:308-327): `addToCart(svc?, slotArg?, docArg?)` — resolve service (selected srv fallback `{n:srv,p:280000}`), doctor short form (`useDoc.split(' ').slice(0,2).join(' ')` unless '—'), line `{id, name, cat:dir, doctor, time:'05.06.2026 · '+(slotArg||slot||'по записи'), room:'—', visit:'Первичный', qty:1, price, discount:0, invoice:'none', invoiceNo:'', pay:'unpaid', cancelled:false, src:'reg', addedBy:REG_ME}`; dup check via normName over non-cancelled lines → notify «„X" добавлена · ⚠ такая услуга уже есть в назначениях (возможен дубль)» warn / «„X" добавлена в корзину» ok (use the prototype's «» quotes verbatim). No selection → warn «Выберите услугу». `addCheckupToCart(cat)`: ckId `CK-{counter}`; lines from cat.services (choice rows keep baseName/options/chosen:null, `defer:true`, src:'checkup', time '05.06.2026 · по записи') → `chkAllocate(lines, pkgPrice)`; append + push `{id,name,pkgPrice}` to a checkups meta state; dup-list notify «Чек-ап «X» добавлен…» w/ ⚠ variant.
- [ ] **Wire-in:** ServicePicker replaces the panel-1 placeholder; props `{refs, ptype, state+setters or internal state with onAdd/onAddCheckup}` — component-internal selection state is fine; VisitPage owns cart/checkups.
- [ ] **Tests:** ServicePicker/VisitPage — renders 9 types + Кардиология services with prices; footer add → pill count +1 + notify ok; adding same service again → warn notify contains «возможен дубль»; booked slot button disabled + switching Тип пациента to Экстренный enables it (tag «экстр.»); switching type to Чек-ап shows «Диабет-контроль» with «пакет · 6» and «Добавить чек-ап» → cart +6 lines, pill total grows by exactly 1 150 000 (allocated discounts sum = 1000), notify; doctors search filters (type 'Казанцева' → 1 row); axe zero violations on the page with picker.
- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `feat(registration): visit service picker (5 columns, swaps, slot rules, package add)`

---

### Task 2: header actions + ServiceTemplateModal + reset

**Files:** `ServiceTemplateModal.tsx` (new), `VisitPage.tsx` (subbar buttons), tests.

- [ ] **Subbar buttons** (:712-714, right-aligned): «Повторить пакет» (Repeat icon, title verbatin «Добавить тот же набор услуг, что и предыдущему пациенту (удобно для нескольких детей)») → `addPackage(LAST_PACKAGE, 'Добавлен пакет предыдущего пациента')`; «Из шаблона» (Bookmark) → modal; «Сбросить фильтры» (RefreshCw) → resetPicker (clear type/dir/srv/doc/slot + swap flags, notify «Фильтры выбора услуг сброшены»).
- [ ] **addPackage(items, note)** (:328-334): appends plain lines (doctor '—', time '05.06.2026 · по записи'), dup-list in notify «{note} · ⚠ дубли: …».
- [ ] **ServiceTemplateModal** (:97-142): search over template names; rows `{name}` + «{N} услуг · {rfmt(sum)} сум» + «Загрузить» → onLoad(items) + close; create section «Создать шаблон из текущей корзины ({N} услуг)» + name Input + «Сохранить шаблон» (disabled w/o name or empty cart) → prepends template `{id:max+1, name, items from non-cancelled cart}` + notify «Шаблон «X» сохранён»; templates state lives in VisitPage (INIT_PACKAGES seed).
- [ ] **Tests:** «Повторить пакет» → +3 lines + notify; template modal lists 3 seeds with sums (Кардио чек-ап 610 000), load → lines added; save disabled w/o name, with name → new template appears in list; «Сбросить фильтры» → type radios cleared + notify; axe on modal.
- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `feat(registration): visit header actions (repeat package, templates, reset) + template modal`

---

### Task 3: Gate + screenshots (controller)
- [ ] `npm run verify && npm run build`; screenshots: picker (default Кардиология), Чек-ап type view, emergency slots, template modal, cart pill after adds; owner checkpoint.

---

## Self-Review (plan author)

**Spec coverage:** Full picker behaviour (radio columns, swap order, slot busy/closed/emergency rules with tooltips, dbl-click + footer adds, checkup package add with real allocation, dup protection), header actions + template CRUD. The appointments table stays stubbed (Plan 25); invoice gating untouched (Plan 26).

**Placeholder scan:** every behaviour line-referenced to reg-services.jsx; both catalog programs enumerated; notify strings verbatim. Two deliberate deltas declared (functional search, decorative chevrons).

**Type consistency:** cart line shape identical to Plan 23's seed lines (CardService-compatible); chkAllocate/normName/svcWord reused from domain; CHECKUP_CATALOG kept separate from the card's CHK_CATALOG exactly as the prototype does.

**Scope:** two implementation tasks + controller gate; each task gates green independently.
