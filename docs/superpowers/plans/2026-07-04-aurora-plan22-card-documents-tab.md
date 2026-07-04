# Aurora Redesign — Plan 22: Patient card — Документы tab (doc catalog, fill-form modal, bilingual A4 print)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Replace the LAST card-tab stub — the card goes 13/13. **Документы** = a catalog of fillable/printable patient forms (9 docs in 3 categories: Договоры и финансы — договор / заявление на возврат / гарантийное обязательство; Информированные согласия — на вмешательство / на ПДн / отказ; Радиология (анкеты) — КТ / МРТ / Рентген), shown as tile grid («Значки») or list with a toggle. Clicking a doc opens **DocFormModal**: simple docs render their field schema (text/date/textarea, dates prefilled with the demo today); анкеты render the radiology questionnaire (study Select from the mode's service list, weight, study date, Да·Ha/Нет·Yo‘q/— segmented answers per safety question, pregnancy inline input, contrast-consent segment). «Печать» generates a **bilingual (RU/UZ) A4 sheet** in a new window — patient strip, justified paragraphs with Uzbek italics (unfilled fields print as `____________` lines for hand-filling), meta chips, date line, signature columns — and notifies «Документ сформирован: {title}».

**Architecture:** Task 1 ports the subsystem's data + generators with pure-function TDD: `src/data/docCatalog.ts` (`CARD_DOC_GROUPS` 3×3 verbatim, `DOC_FIELDS` schemas, `ANKETA` kt/mrt/rg — bilingual questions/notes/service lists verbatim, `DOC_TILE_META` label colors mapped to theme tones) and `src/features/registration/card/docPrint.ts` — **pure HTML builders** (`buildFormDocHtml(opts)`, `buildAnketaHtml(mode, patient, vals)`, dispatcher `cardDocHtml(id, patient, vals)`) returning full HTML strings, plus a thin `cardDocPrint` that opens the window via the house `printHtml.ts` conventions. Branding is **Aurora** (house frame idiom: app name header, theme primary accents, system font stack) — NOT Medion logo/red/Montserrat; the bilingual body content, paragraph texts, footer requisites structure, sign rows, and the one-page zoom-fit script are ported. Task 2 builds `DocumentsTab.tsx` + `DocFormModal.tsx` and wires the tab (stub list → empty). Ported from `reg-card.jsx:674-811`, `doc-print.jsx:1-297` (statCardPrint :66-145 is **deferred** — it prints «вторым к счёту», belongs to the invoice/visit cluster; `cert`/`extract` configs :285-294 are ported into the dispatcher as data — reachable later via PatientDocModal).

**Tech Stack:** React 19, TS, design-system Dialog/Select/Input/Textarea/Button/Table/Badge, lucide-react, Vitest + jest-axe.

---

## Conventions
- Working dir `C:\Users\user\Desktop\aurora redesign by me` (branch `master`). Gate `npm run verify`; build `npm run build`. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Russian/Uzbek copy verbatim char-for-char (incl. ‘ apostrophes in Uzbek); no emojis; lucide icons; determinism — no Date.now()/new Date(); demo today = `'06.06.2026'` (DMY) / `'2026-06-06'` (ISO for `<input type="date">`; convert with the existing `isoToDMY` from `src/domain/registration.ts` when printing).

---

### Task 1: doc catalog data + print builders (TDD)

**Files:** `src/data/docCatalog.ts` (new), `src/features/registration/card/docPrint.ts` (new), `src/features/registration/card/docPrint.test.ts` (new).

- [ ] **Step 1 (RED): `docPrint.test.ts` first.** Fixtures:
  - Catalog shape: `CARD_DOC_GROUPS` flattens to 9 items; every item id resolves — `cardDocHtml(id, patient, {})` returns a non-empty string for all 9 (dispatcher has no dead ids).
  - Blank-fill: `cardDocHtml('refund', p, {})` contains `____________` (unfilled invoice/amount print as lines); with `vals={invoice:'№00190', amount:'120 000'}` contains `№00190` and NOT a bare-meta `____________` for that field.
  - Escaping: value `<b>x</b>` comes out escaped (`&lt;b&gt;`).
  - Anketa answers: `buildAnketaHtml('mrt', p, {q0:'Да'})` contains `Да <span` + `· Ha`; `'Нет'` → `Yo‘q`; empty → `&nbsp;`.
  - Anketa mode data: kt has 7 questions + 8 services; mrt 8 q; rg 4 q (guards verbatim port).
  - Patient strip: contains pid + name + «Жен.» for a female patient; dob; phone.
  - No Medion: output HTML contains neither `Medion` nor `medion-logo` nor `#9a2820` (Aurora branding check) — the house header/footer idiom is used instead.
- [ ] **Step 2 (GREEN): implement.**
  - `src/data/docCatalog.ts`: `CARD_DOC_GROUPS` (doc-print.jsx:213-229 verbatim — ids/titles/uz), `DOC_FIELDS` (:231-239 — field schemas `{k,t:'text'|'date'|'textarea',l,uz}` and anketa kind/mode entries), `ANKETA` (:148-176 — kt/mrt/rg with label/sub/subUz/gen/genUz/notes (ANKETA_SAFE pair + MRT's extra magnetic-warning pair)/services (8/8/8)/q bilingual pairs), `DOC_TILE_META` (reg-card.jsx:675-679 — category → [tone, label ДОГОВОР|СОГЛАСИЕ|АНКЕТА], colors mapped to theme tones: destructive-ish, violet, info — reuse the FilesTab `fileMeta` tinting idiom rather than raw hex).
  - `docPrint.ts`: port `docEsc`/`docMoney`/`docPStrip` (bilingual patient strip)/`docFoot` (requisites line — Aurora clinic identity per the house `printHtml.ts` footer idiom)/`buildFormDocHtml` (:48-63 — meta chips, justified `.dp` paragraphs w/ `.uz` italics, date line, `signLabels` columns)/`buildAnketaHtml` (:177-210 — notes, area/weight row, qrows, «Для женщин» + pregnancy row, «Я информирован(а)…»/«Я согласен(а)…» sections with the mode's gen/genUz interpolation, consent box, read+sign row, DOC_FIT_JS one-page zoom script)/`cardDocHtml` dispatcher (:246-296 — the 9 catalog cases + `cert` + `extract`, paragraph texts verbatim incl. `V()` blank-fill interpolation; NO `statcard` case — deferred)/`cardDocPrint(id,p,vals)` thin window-opener following `printHtml.ts` conventions (open, write, focus, deferred print; no-op safe when popup blocked).
- [ ] **Step 3:** `npm run verify` green. Commit: `feat(registration): doc catalog + bilingual A4 print builders (TDD)`

---

### Task 2: DocumentsTab + DocFormModal + wire-in

**Files:** `src/features/registration/card/DocumentsTab.tsx` (new, DocFormModal in-file), `PatientCardPage.tsx` (wire `docs`; stub machinery now unused — remove the stub list/TabStub if nothing references it), `DocumentsTab.test.tsx` (new), page test (extend).

- [ ] **DocumentsTab** (`reg-card.jsx:680-735`; props `{ patient, notify }`): header «Документы пациента · заполнить и распечатать» + Значки/Список segmented toggle (house FilesTab idiom, aria-pressed). Grid: tile per doc (thumb tinted per `DOC_TILE_META` with FileText icon + category label chip, hover print action «Заполнить и распечатать»), name (ru), sub (uz), meta (category). List: Table — thumb / Документ (+uz sub) / Категория / «Заполнить» soft button. Click anywhere on tile/row opens the modal.
- [ ] **DocFormModal** (`reg-card.jsx:740-811`; Dialog, width `sm:max-w-xl` simple / `sm:max-w-3xl` anketa): header = doc title + patient name; info note «Заполните поля и нажмите «Печать». Незаполненные поля останутся линиями для ручного заполнения.»; body:
  - Simple docs: 2-col grid of schema fields (`text` → Input, `date` → Input type=date seeded `'2026-06-06'`, `textarea` → Textarea; label + uz sub-label).
  - Anketa docs: Исследование Select over the mode's `services` + Вес text + Дата исследования date (seeded); «Вопросы безопасности · Xavfsizlik savollari» section — per question a row (ru + uz sub) with a 3-way segmented control «Да · Ha»/«Нет · Yo‘q»/«—» (buttons with aria-pressed, NOT inner components — plain render functions to keep input focus, per prototype note); pregnancy question with inline Input; «Согласие на контраст · Kontrastga rozilik» 2-way segment.
  - Footer: Отмена + primary «Печать» → convert date fields ISO→DMY (`isoToDMY`), call `cardDocPrint(doc.id, patient, vals)`, notify «Документ сформирован: {doc.t}», close; on throw notify warn «Ошибка формирования документа».
- [ ] **Wire-in + tests:** register `docs` TabsContent (all 13 tabs live — delete the TabStub path). Page test: switch to Документы → `findAllByText('Договор на медицинские услуги')` non-empty. `DocumentsTab.test.tsx`: render + axe zero violations (both views); grid shows 9 tiles, toggle to Список shows the table; clicking «Анкета МРТ» opens the modal with «Вопросы безопасности» and 8 question rows; segmented «Да · Ha» click sets pressed state; «Печать» with `window.open` mocked (stub `{document:{write(){},close(){}},focus(){},print(){}}`) → notify called with «Документ сформирован: Анкета МРТ» + modal closes; simple-doc path (Заявление на возврат) shows its 5 schema fields with date prefilled.
- [ ] **Gate + commit** — `npm run verify && npm run build` green. Commit: `feat(registration): card Документы tab (doc catalog, fill-form modal, bilingual print) — card 13/13`

---

### Task 3: Gate + screenshots (controller)
- [ ] `npm run verify && npm run build`; screenshots: Документы grid, anketa modal (МРТ), a generated print sheet (capture the popup page), list view; owner checkpoint.

---

## Self-Review (plan author)

**Spec coverage:** Full DocumentsTab + DocFormModal + the form/anketa print generators with bilingual verbatim content; blank-fill-to-lines behaviour; one-page fit script; Aurora rebranding of the sheet frame with a test that enforces no Medion leakage. statCardPrint explicitly deferred to the invoice/visit cluster (its only entry point); cert/extract ported as dispatcher data for the future PatientDocModal.

**Placeholder scan:** all sources line-referenced; field schemas, question counts, and dispatcher cases enumerated. No TBDs.

**Type consistency:** pure builders return strings (testable without window); dates via existing `isoToDMY`; tile tinting reuses the FilesTab idiom; segmented controls follow the house aria-pressed pattern; demo today consistent with Plans 20-21 ('06.06.2026').

**Scope:** one TDD data/print task + one UI task + controller gate. Completes the patient card 13/13 — Registration then moves to Slice 4 (visit registration).
