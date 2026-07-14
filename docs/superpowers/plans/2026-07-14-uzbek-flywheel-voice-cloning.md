# Uzbek Flywheel — Plan 4: Russian Voice Cloning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the clinic enroll a few consenting operators' voices and use them as text-to-voice voices in the «Озвучка» page — several real Russian call-center voices, gated behind a written-consent step.

**Architecture:** Extends the existing V2T T2V system. Adds a `voices` table (built-in + cloned, with consent metadata), a cloning TTS engine behind the SAME injectable TTS seam the app already has (`app/tts.py`, `synthesize(..., engine=None)`; edge-tts stays default + fallback), and a Voices UI. The real cloning model (XTTS v2) is exercised only in a manual GPU smoke — never in the pytest suite; gates use an injected fake cloning engine.

**Tech Stack:** Python 3.13, FastAPI, SQLite, Coqui XTTS v2 (community fork; real path only, not gated), edge-tts (existing), React 18 + TS + Tailwind v4. Runs on the owner's RTX 2060 SUPER (8 GB) — cloning is slower than edge-tts but workable; Russian good, Uzbek rough.

**Context:**
- Spec: `docs/superpowers/specs/2026-07-14-callcenter-uzbek-flywheel-design.md` (Part C).
- **Working dir: `C:\Users\user\Desktop\V2T T2V`.** Independent of Plan 3 (can run before/after/parallel — but serialize commits; do not run two implementers on the repo at once).
- Existing TTS: `app/tts.py` has `VOICES = {"ru": {"female": "ru-RU-SvetlanaNeural", "male": "ru-RU-DmitryNeural"}, "uz": {...}}`, `edge_engine(text, voice_id, out_path)`, and `synthesize(text, language, voice, out_path, engine=None)` (validates language ru/uz + voice female/male, calls `(engine or edge_engine)(...)`). `app/routes/misc.py` `_tts_generate(request, text, language, voice)` hashes to a filename in `cfg.tts_dir` and calls `synthesize(..., engine=request.app.state.tts_engine)`; the TTS/scripts endpoints live there. `create_app(cfg, ..., tts_engine=None, ...)` stores `app.state.tts_engine`. `scripts` table has `voice` TEXT (currently 'female'/'male').
- Conventions: Russian UI, no emojis, lucide, `import type`, strict `isinstance` validators (send real booleans/ints), IntegrityError→409/422, `get_db`, gates (`pytest`, `tsc -b`, vitest, build static/). Audio-file cleanup pattern already used in `misc.py` (reference-count before unlink).

---

## File Structure

```
app/
  db.py               # + voices table (built-in + cloned, consent fields)
  tts.py              # + clone_engine seam: synth via reference sample; XTTS real (not gated); FakeCloneEngine; seed built-in voices helper
  routes/
    voices.py         # NEW: list voices, enroll (sample+consent), revoke/deactivate
    misc.py           # /tts + /scripts accept a cloned voice id; serve enrolled samples
  main.py             # register voices router; optional clone_engine injection like tts_engine
web/src/
  lib/api.ts          # + Voice type; listVoices/enrollVoice/deleteVoice; tts/scripts accept voice ref
  pages/VoicesPage.tsx# NEW: list + record/upload enrollment with consent
  pages/TtsPage.tsx   # cloned voices selectable alongside built-in
  shell/nav.ts        # + Голоса
  App.tsx             # + /voices route
scripts/
  clone_check.py      # NEW: manual XTTS GPU smoke (not gated)
```

---

### Task 1: `voices` table + built-in seed

**Files:** Modify `app/db.py`; Modify `tests/test_db.py`.

- [ ] **Step 1: Write failing test** — append to `tests/test_db.py`:

```python
def test_voices_table(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn); init_db(conn)
    tables = {r["name"] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert "voices" in tables
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(voices)")}
    assert {"name", "language", "kind", "reference_audio_path",
            "consent_text", "consent_given_by", "consent_at", "active"} <= cols
    conn.close()
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** — add to `SCHEMA` in `app/db.py`:

```sql
CREATE TABLE IF NOT EXISTS voices(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  kind TEXT NOT NULL DEFAULT 'cloned' CHECK(kind IN ('builtin','cloned')),
  reference_audio_path TEXT,
  consent_text TEXT,
  consent_given_by TEXT,
  consent_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL);
```

(No built-in rows seeded into the table — built-in voices remain the `VOICES` map in `tts.py`; the `voices` table holds only cloned enrollments. The `kind` column + CHECK is future-proofing.)

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: voices table for cloned-voice enrollment with consent metadata"`

---

### Task 2: Cloning engine seam — synth from a reference sample, fake for tests, XTTS real path

**Files:** Modify `app/tts.py`; Modify `tests/test_api_misc.py` (or a new `tests/test_tts.py`); Create `scripts/clone_check.py`.

- [ ] **Step 1: Write failing test** — `tests/test_tts.py`:

```python
from pathlib import Path

from app.tts import synthesize_cloned


def test_synthesize_cloned_uses_reference_and_engine(tmp_path):
    ref = tmp_path / "ref.wav"; ref.write_bytes(b"reference-audio")
    out = tmp_path / "out.mp3"
    seen = {}

    def fake_clone(text, reference_path, language, out_path):
        seen.update(text=text, reference=str(reference_path), language=language)
        Path(out_path).write_bytes(b"ID3-cloned:" + text.encode())

    p = synthesize_cloned("Здравствуйте", ref, "ru", out, engine=fake_clone)
    assert p == out and out.read_bytes().startswith(b"ID3-cloned:")
    assert seen["reference"] == str(ref) and seen["language"] == "ru"


def test_synthesize_cloned_rejects_missing_reference(tmp_path):
    out = tmp_path / "out.mp3"
    try:
        synthesize_cloned("x", tmp_path / "nope.wav", "ru", out, engine=lambda *a: None)
        assert False
    except ValueError as e:
        assert "образец" in str(e).lower()
```

- [ ] **Step 2: Run to verify failure** — FAIL (no `synthesize_cloned`).

- [ ] **Step 3: Implement** in `app/tts.py`:

```python
def synthesize_cloned(text, reference_path, language, out_path, engine=None):
    """Synthesize `text` in the voice of `reference_path` (an enrolled sample).
    `engine(text, reference_path, language, out_path)` does the work; defaults to XTTS."""
    reference_path = Path(reference_path)
    if not reference_path.exists():
        raise ValueError("образец голоса не найден")
    if language not in VOICES:
        raise ValueError("язык должен быть 'ru' или 'uz'")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    (engine or xtts_engine)(text, reference_path, language, out_path)
    return out_path


def xtts_engine(text, reference_path, language, out_path):
    """Real cloning via Coqui XTTS v2 (community fork). Not exercised by tests.
    Bind to the installed TTS API at implementation time — reference:
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        tts.tts_to_file(text=text, speaker_wav=str(reference_path), language=language, file_path=str(out_path))
    Lazy-import inside the function; pick device cuda->cpu; verify signatures vs installed version."""
    from TTS.api import TTS  # noqa: PLC0415  (lazy; heavy)
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    tts.tts_to_file(text=text, speaker_wav=str(reference_path),
                    language=language, file_path=str(out_path))
```

(Add `from pathlib import Path` if not already imported.) `scripts/clone_check.py`: manual smoke — takes a reference wav + text, calls `synthesize_cloned(text, ref, "ru", out)` with the real engine, prints the output path or a readable failure; NOT gated.

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass (real xtts_engine untouched).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: cloning TTS seam (synthesize_cloned) + XTTS real engine + fake for tests"`

---

### Task 3: Voices API — enroll (sample + consent), list, revoke

**Files:** Create `app/routes/voices.py`; Modify `app/main.py`; Create `tests/test_api_voices.py`.

- [ ] **Step 1: Write failing test** — `tests/test_api_voices.py`:

```python
import io


def test_enroll_list_revoke_voice(client):
    r = client.post("/api/voices",
        data={"name": "Оператор Дильноза", "language": "ru",
              "consent_text": "Согласен на использование голоса",
              "consent_given_by": "Дильноза"},
        files=[("sample", ("s.wav", io.BytesIO(b"voice-sample-bytes"), "audio/wav"))])
    assert r.status_code == 200
    vid = r.json()["id"]
    voices = client.get("/api/voices").json()
    assert any(v["id"] == vid and v["kind"] == "cloned" for v in voices)
    # consent is required
    assert client.post("/api/voices",
        data={"name": "X", "language": "ru", "consent_text": "", "consent_given_by": ""},
        files=[("sample", ("s.wav", io.BytesIO(b"x"), "audio/wav"))]).status_code == 422
    # revoke removes it from the active list
    assert client.delete(f"/api/voices/{vid}").status_code == 200
    assert all(v["id"] != vid for v in client.get("/api/voices").json())
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `app/routes/voices.py`:
  - `POST /api/voices` — multipart: `name`, `language`, `consent_text`, `consent_given_by` (Form fields) + `sample` (UploadFile). Validate: name non-empty, language in ('ru','uz'), `consent_text` and `consent_given_by` both non-empty (else 422 «требуется согласие: текст и имя»). Save the sample to `cfg.data_dir / "voices" / f"{stamp}-{safe_name}.wav"` (basename-sanitize; create dir). INSERT into voices (kind='cloned', reference_audio_path, consent fields, created_at, active=1). Return the row.
  - `GET /api/voices` — `WHERE active=1 ORDER BY name` (cloned enrollments). (Built-in voices are added client-side from a constant, or expose them too — keep this endpoint = cloned only; the TTS page merges built-in + cloned.)
  - `DELETE /api/voices/{id}` — 404 if missing; soft-delete (active=0) OR hard delete + unlink the sample. Use soft-delete (active=0) so any scripts referencing it don't dangle; also stop offering it. Return `{ok: True}`.
  - `GET /api/voices/{id}/sample` — serve the reference audio (FileResponse; basename guard; 404) so the UI can play back what was enrolled.
  - `app/main.py`: register the router under `/api`.

- [ ] **Step 4: Run** — all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: voices API - consent-gated enrollment, list, revoke, sample playback"`

---

### Task 4: TTS + scripts accept a cloned voice

**Files:** Modify `app/routes/misc.py`; Modify `tests/test_api_misc.py`.

- [ ] **Step 1: Write failing test** — append to `tests/test_api_misc.py` (the module's fake-TTS client fixture already injects `tts_engine`; add a fake clone engine similarly):

```python
def test_tts_with_cloned_voice(cfg):
    import io
    from pathlib import Path
    from fastapi.testclient import TestClient
    from app.main import create_app

    def fake_tts(text, voice_id, out_path): Path(out_path).write_bytes(b"builtin")
    def fake_clone(text, reference_path, language, out_path):
        Path(out_path).write_bytes(b"cloned:" + Path(reference_path).name.encode())

    app = create_app(cfg, tts_engine=fake_tts, clone_engine=fake_clone,
                     start_workers=False, start_watcher=False)
    with TestClient(app) as client:
        v = client.post("/api/voices",
            data={"name": "Дильноза", "language": "ru",
                  "consent_text": "ок", "consent_given_by": "Дильноза"},
            files=[("sample", ("s.wav", io.BytesIO(b"ref"), "audio/wav"))]).json()
        r = client.post("/api/tts", json={"text": "Привет", "language": "ru",
                                          "voice": f"clone:{v['id']}"})
        assert r.status_code == 200
        audio = client.get(r.json()["audio_url"])
        assert audio.content.startswith(b"cloned:")
```

- [ ] **Step 2: Run to verify failure** — FAIL (`voice: "clone:N"` not handled; `clone_engine` param absent).

- [ ] **Step 3: Implement.**
  - `app/main.py`: add `clone_engine=None` param to `create_app`, store `app.state.clone_engine = clone_engine`.
  - `app/routes/misc.py` `_tts_generate(request, text, language, voice)`: if `voice` starts with `"clone:"`, parse the id (`int(voice.split(":",1)[1])`), open a short-lived `conn = get_conn(cfg.db_path)` (import `get_conn` from `..db`), look up `SELECT reference_audio_path FROM voices WHERE id=? AND active=1` (404 «голос не найден» if missing), close the conn, then call `synthesize_cloned(text, Path(row["reference_audio_path"]), language, out_path, engine=request.app.state.clone_engine)`. Otherwise the existing built-in `synthesize(...)` path. Keep the hash-based output filename but include `voice` in the hashed key so different voices don't collide. ValueError→422, other engine failure→502 (existing pattern; wrap as the file already does).
  - The `/scripts` create/patch already store `voice`; allow `voice` to be `"clone:N"` too (no schema change — it's just a string). When (re)voicing a script with a `clone:` voice, `_tts_generate` handles it.

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: TTS + scripts synthesize in enrolled cloned voices"`

---

### Task 5: Frontend — Voices page + enrollment + cloned voices in «Озвучка»

**Files:** Create `web/src/pages/VoicesPage.tsx`; Modify `web/src/lib/api.ts`, `web/src/pages/TtsPage.tsx`, `web/src/shell/nav.ts`, `web/src/App.tsx`; tests.

- [ ] **Step 1: Write failing tests.** `VoicesPage.test.tsx` (mock `../lib/api`): renders enrolled voices; the enroll form requires a name + a consent checkbox + a sample file before «Сохранить голос» is enabled, and submitting calls `enrollVoice` with a FormData containing the consent fields; delete calls `deleteVoice`. `TtsPage.test.tsx`: the voice Select includes both built-in (Женский/Мужской) and any cloned voices (`clone:{id}`), and choosing a cloned voice + «Озвучить» calls `api.tts({voice: "clone:N", ...})`.

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.**
  - `api.ts`: add `Voice {id, name, language, kind, active}`; `listVoices()` → GET `/api/voices`; `enrollVoice(fd: FormData)` → POST `/api/voices` (multipart — use `fetch` with the FormData, no JSON header, like `uploadCalls`); `deleteVoice(id)` → DELETE.
  - `VoicesPage.tsx` (h1 «Голоса»): intro «Запишите голос согласившегося сотрудника, чтобы использовать его в озвучке. Нужно письменное согласие.»; enrollment form — name Input, language Select (ru/uz), a file input «Образец голоса (1–2 минуты)» (accept audio), a required consent checkbox with the statement «Сотрудник согласен на запись и использование его голоса», and «Сохранить голос» (disabled until name + file + checkbox). Submit builds a FormData (`name`, `language`, `consent_text` = the statement, `consent_given_by` = name, `sample` = file) → `enrollVoice` → ok toast + refresh. List of enrolled voices: name, language, a play button (`<audio src={/api/voices/{id}/sample}>`), «Удалить» with confirm → `deleteVoice`. EmptyState «Голосов пока нет».
  - `TtsPage.tsx`: the voice Select options = built-in [«Женский» value `female`, «Мужской» value `male`] + cloned voices from `listVoices()` as [«{name} (клон)» value `clone:{id}`]. Everything else unchanged (the audio + download + scripts library). When a `clone:` voice is chosen the same `api.tts({text, language, voice})` call carries it.
  - `nav.ts`: add `{to:"/voices", label:"Голоса", icon: Mic}` (lucide). `App.tsx`: add the `/voices` route.

- [ ] **Step 4: FINAL GATE.** `npm --prefix web run typecheck` (`tsc -b`) clean; `npm --prefix web run test` all pass; `npm --prefix web run build`; emoji sweep → none; `.venv\Scripts\python.exe -m pytest -q` → all pass; server smoke (port 8794): GET `/` 200 with bundle, GET `/api/voices` 200, stop.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat(web): voices page (consent enrollment) + cloned voices in TTS; gate green"`

---

## Verification gate (whole plan)

- Backend `pytest` green; frontend `tsc -b` clean + vitest green; build serves the SPA with the new «Голоса» section; cloned voice selectable in «Озвучка» (via the fake clone engine in tests).
- Zero emojis; Russian; lucide only; consent required to enroll (tested); real XTTS never loaded in the suite.
- NOT verified here (needs owner + GPU + a consenting voice): real cloned-voice quality (Russian good / Uzbek rough), first live synthesis latency on the 2060. The manual `scripts/clone_check.py` smoke + owner acceptance follow this plan.

## Out of scope (this plan)

The correction-loop foundation (Plan 3), Uzbek TTS quality work, model retraining, AI phone agent, auth, deployment.
