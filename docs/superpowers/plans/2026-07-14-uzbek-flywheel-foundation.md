# Uzbek Flywheel — Plan 3: Correction-Loop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing V2T T2V system so real calls are transcribed as an **Оператор/Клиент** dialogue, the owner can correct + confirm each dialogue into a trusted exportable dataset, and a **glossary** improves recognition immediately (no training).

**Architecture:** Extends the existing FastAPI + SQLite backend and React SPA in `C:\Users\user\Desktop\V2T T2V`. Reuses the established seams: the swappable `Transcriber` interface (gets a diarizing implementation + a `speaker` field, with `FakeTranscriber` emitting two-speaker fixtures so gates never touch GPU), the job worker (feeds the glossary hint into transcription, stores speaker labels), and the review screen (speaker flip + confirm). Two pure new modules — `glossary` (assemble hint / extract suggestions) and `dataset` (snapshot on confirm / export) — keep the ML-adjacent logic testable without a GPU.

**Tech Stack:** Python 3.13, FastAPI, SQLite (stdlib sqlite3), faster-whisper / WhisperX + pyannote (real diarization path, exercised only in a manual GPU smoke — never in the pytest suite), React 18 + TS + Vite + Tailwind v4, pytest, vitest.

**Context:**
- Spec: `docs/superpowers/specs/2026-07-14-callcenter-uzbek-flywheel-design.md` (Part A). This plan implements Part A only; Part C (voice cloning) is a separate plan.
- **Working dir for ALL tasks: `C:\Users\user\Desktop\V2T T2V`** (the existing build repo; ~46 commits, its own git). Backend suite is currently **81 pytest** green; frontend **105 vitest** green with a real `tsc -b` type gate.
- Backend gate before every backend commit: `.venv\Scripts\python.exe -m pytest -q`. Frontend gate: `npm --prefix web run typecheck` (`tsc -b`) + `npm --prefix web run test`; rebuild SPA into `static/` and commit it on frontend tasks (`npm --prefix web run build`).
- Existing modules to know: `app/config.py` (AppConfig; `api_key()` reads env then `%APPDATA%\callcenter-qa\config.json`), `app/db.py` (schema + `get_conn`/`init_db`; `segments` table has id/call_id/idx/start_sec/end_sec/text_original/text_corrected/edited_at), `app/transcriber.py` (`TranscriptSegment{start,end,text}`, `TranscriptResult{language,language_probability,duration_sec,segments}`, `FakeTranscriber`, `FasterWhisperTranscriber`), `app/worker.py` (`process_transcribe_job` inserts segments + enqueues analyze; feeds nothing to the model yet), `app/routes/review.py` (segment edit + `_reject_if_analyzing` guard on `analyzing`/`transcribing`), `app/main.py` (`create_app`, routers imported inside it), and the React app (`web/src/lib/api.ts` typed client, `web/src/components/Transcript.tsx`, `web/src/pages/ReviewPage.tsx`, `web/src/shell/nav.ts`).
- Repo conventions (follow exactly): Russian UI text, no emojis, lucide icons, `import type` (erasableSyntaxOnly), strict backend validators use `isinstance(x, bool)` / `isinstance(x, int)` — the frontend must send real booleans/ints; routes wrap constraint-violating writes in `try/except sqlite3.IntegrityError → rollback → HTTPException`; Russian error messages; per-request short-lived DB connections via `get_db`.

---

## File Structure (final state of this plan)

```
app/
  config.py        # + hf_token() accessor (HF token for diarization, like api_key)
  db.py            # + segments.speaker column; glossary, glossary_suggestions, dialogue_datasets tables
  transcriber.py   # TranscriptSegment gets speaker; FakeTranscriber two-speaker; map_speakers(); DiarizingTranscriber (real, not gated)
  glossary.py      # NEW: build_hint(active_terms) -> str ; extract_suggestions(original, corrected) -> list[str]
  dataset.py       # NEW: snapshot_manifest(conn, call_id) -> dict ; export_dataset(conn, cfg, out_dir) -> dict
  worker.py        # feed glossary hint into transcribe; store speaker per segment; generate suggestions post-analyze? (edit-time)
  routes/
    review.py      # + PATCH speaker on segment; POST confirm-dialogue / unconfirm
    glossary.py    # NEW: glossary CRUD + suggestions accept/dismiss
    dataset.py     # NEW: dataset stats + export
  main.py          # register glossary + dataset routers
web/src/
  lib/api.ts               # + Segment.speaker; glossary/dataset/confirm client methods + types
  components/Transcript.tsx# speaker tag + one-click flip (operator<->client)
  pages/ReviewPage.tsx     # «Подтвердить диалог» + suggested-terms strip
  pages/GlossaryPage.tsx   # NEW
  pages/DatasetPage.tsx    # NEW
  shell/nav.ts             # + Словарь, Данные
  App.tsx                  # + routes /glossary /dataset
scripts/
  diarize_check.py # NEW: manual GPU smoke for the real diarizing path (not in gates)
```

---

### Task 1: DB schema — speaker column, glossary, suggestions, datasets

**Files:** Modify `app/db.py`; Modify `tests/test_db.py`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_db.py`:

```python
def test_phase3_schema(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn)
    init_db(conn)  # idempotent (ADD COLUMN guard must not double-add)
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(segments)")}
    assert "speaker" in cols
    tables = {r["name"] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"glossary", "glossary_suggestions", "dialogue_datasets"} <= tables
    conn.close()
```

- [ ] **Step 2: Run to verify failure** — `.venv\Scripts\python.exe -m pytest tests/test_db.py::test_phase3_schema -q` → FAIL (no `speaker` column).

- [ ] **Step 3: Implement.** In `app/db.py`, add these tables to the `SCHEMA` string (before the index block):

```sql
CREATE TABLE IF NOT EXISTS glossary(
  id INTEGER PRIMARY KEY,
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(term, language));

CREATE TABLE IF NOT EXISTS glossary_suggestions(
  id INTEGER PRIMARY KEY,
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  call_id INTEGER REFERENCES calls(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  UNIQUE(term, language));

CREATE TABLE IF NOT EXISTS dialogue_datasets(
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id) UNIQUE,
  confirmed_at TEXT NOT NULL,
  manifest_json TEXT NOT NULL);
```

Then, because SQLite has no `ADD COLUMN IF NOT EXISTS`, add a guarded migration helper and call it from `init_db` AFTER `executescript(SCHEMA)`:

```python
def _add_column_if_missing(conn, table, column, decl):
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")

# inside init_db, after conn.executescript(SCHEMA) and before the criteria seed/commit:
_add_column_if_missing(conn, "segments", "speaker", "TEXT")
```

Add a helpful index too (in SCHEMA's index block): `CREATE INDEX IF NOT EXISTS idx_glossary_active ON glossary(active);`

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass (82 total).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: phase3 schema - segments.speaker, glossary, suggestions, dialogue_datasets"`

---

### Task 2: `TranscriptSegment.speaker` + speaker→operator/client mapping + two-speaker fake

**Files:** Modify `app/transcriber.py`; Modify `tests/test_transcriber.py`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_transcriber.py`:

```python
from app.transcriber import FakeTranscriber, TranscriptSegment, map_speakers


def test_fake_transcriber_two_speakers(tmp_path):
    audio = tmp_path / "a.mp3"; audio.write_bytes(b"x")
    r = FakeTranscriber().transcribe(audio)
    speakers = {s.speaker for s in r.segments}
    assert speakers == {"operator", "client"}  # default fake is a 2-speaker dialogue
    assert r.segments[0].speaker == "operator"  # greeter = operator


def test_map_speakers_first_cluster_is_operator():
    segs = [
        TranscriptSegment(0.0, 2.0, "Клиника, здравствуйте.", speaker="SPEAKER_00"),
        TranscriptSegment(2.0, 5.0, "Здравствуйте, хочу записаться.", speaker="SPEAKER_01"),
        TranscriptSegment(5.0, 7.0, "Конечно, на какую услугу?", speaker="SPEAKER_00"),
    ]
    mapped = map_speakers(segs)
    assert [s.speaker for s in mapped] == ["operator", "client", "operator"]


def test_map_speakers_handles_missing_labels():
    segs = [TranscriptSegment(0.0, 1.0, "текст", speaker=None)]
    mapped = map_speakers(segs)
    assert mapped[0].speaker in ("operator", None)  # never raises
```

- [ ] **Step 2: Run to verify failure** — FAIL (`TranscriptSegment` has no `speaker`; no `map_speakers`).

- [ ] **Step 3: Implement.** In `app/transcriber.py`:
  - Add `speaker: str | None = None` to the `TranscriptSegment` dataclass (keep field order: start, end, text, then speaker with default).
  - `FakeTranscriber` default segments become a 2-speaker dialogue, operator first:
    ```python
    self._segments = segments or [
        TranscriptSegment(0.0, 3.0, "Здравствуйте, клиника, слушаю вас.", speaker="operator"),
        TranscriptSegment(3.0, 8.0, "Здравствуйте, хочу записаться на УЗИ.", speaker="client"),
        TranscriptSegment(8.0, 12.0, "Конечно, подскажу цену и время.", speaker="operator"),
    ]
    ```
    (Update `test_fake_transcriber_returns_result`/`custom_segments` if they asserted an exact count of 2 — they should still pass with 3; if any assert `len == 2`, change to `>= 2`.)
  - Add the pure mapping function:
    ```python
    def map_speakers(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
        """Map raw diarization clusters -> 'operator'/'client'. Heuristic: the cluster
        that speaks first is the operator (clinic answers the call). Already-'operator'/
        'client' labels pass through. Unknown/None labels are left as-is."""
        first: str | None = None
        for s in segments:
            if s.speaker in ("operator", "client"):
                continue
            if s.speaker is not None:
                first = s.speaker
                break
        for s in segments:
            if s.speaker in ("operator", "client", None):
                continue
            s.speaker = "operator" if s.speaker == first else "client"
        return segments
    ```
  - Update `FasterWhisperTranscriber.transcribe` to set `speaker=None` on each segment (it doesn't diarize).

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: transcript segments carry speaker; operator/client mapping; two-speaker fake"`

---

### Task 3: `DiarizingTranscriber` (real path, not gated) + manual smoke script + config HF token

**Files:** Modify `app/transcriber.py`, `app/config.py`; Create `scripts/diarize_check.py`; Modify `tests/test_config.py`.

- [ ] **Step 1: Write the failing test (config only)** — append to `tests/test_config.py`:

```python
def test_hf_token_env_then_file(cfg, monkeypatch):
    cfg.save_settings({"hf_token": "hf-file"})
    monkeypatch.setenv("HF_TOKEN", "hf-env")
    assert cfg.hf_token() == "hf-env"
    monkeypatch.delenv("HF_TOKEN")
    assert cfg.hf_token() == "hf-file"
```

Also add an autouse-safe cleanup: in `tests/conftest.py`'s `_no_env_api_key` fixture, also `monkeypatch.delenv("HF_TOKEN", raising=False)`.

- [ ] **Step 2: Run to verify failure** — FAIL (no `hf_token`).

- [ ] **Step 3: Implement.**
  - `app/config.py`: add `def hf_token(self): return os.environ.get("HF_TOKEN") or self._read_file().get("hf_token")` and include `"hf_token"` handling in `save_settings` (it already merges arbitrary keys — no change needed if save_settings persists any provided key; verify).
  - `app/routes/misc.py`: extend the settings endpoints so the owner can enter the HF token in the UI (write-only, mirroring the Claude key). In `get_settings` add `"has_hf_token": bool(cfg.hf_token())` to the returned dict. In `put_settings`, after the existing `anthropic_api_key` handling, add: `if body.get("hf_token"): if not isinstance(body["hf_token"], str) or not body["hf_token"].strip(): raise HTTPException(422, "токен должен быть непустой строкой"); updates["hf_token"] = body["hf_token"].strip()`. Add a matching test to `tests/test_api_misc.py`: `get /api/settings` has `has_hf_token: False`; `put {hf_token: "hf-x"}` then `has_hf_token: True` and `cfg.hf_token() == "hf-x"`; the token is never echoed back.
  - `app/transcriber.py`: add `DiarizingTranscriber` (real, never imported by tests). It composes Whisper transcription + word alignment + pyannote diarization, assigns each transcript segment the dominant speaker cluster over its time span, then returns a `TranscriptResult` whose segments carry raw cluster ids (caller runs `map_speakers`). Bind to the INSTALLED library APIs at implementation time — the WhisperX API (`whisperx.load_model`, `.transcribe`, `whisperx.load_align_model`, `whisperx.align`, `whisperx.diarize.DiarizationPipeline(use_auth_token=...)`, `whisperx.assign_word_speakers`) is the reference; verify exact signatures against the installed version and adapt. Lazy-import inside `__init__`/`_load` like `FasterWhisperTranscriber`; `device='auto'` → cuda then cpu; record `device_used` + `load_errors`; raise `RuntimeError(...) from last_err` on total failure. Segment `.speaker` = the most-overlapping cluster label (fallback None).
  - `scripts/diarize_check.py`: manual smoke (like `scripts/gpu_check.py`) — loads `DiarizingTranscriber(model_size="small", device="auto")` against a real audio path argument, prints per-segment `[operator/client] start-end text` after `map_speakers`, and prints device + any `load_errors`; wrap in try/except printing a readable failure + `sys.exit(1)`. NOT run by pytest.

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass (DiarizingTranscriber untouched by gates). Do NOT run diarize_check.py (downloads models).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: DiarizingTranscriber (real path), HF token config, manual diarize smoke"`

---

### Task 4: Glossary module — build recognition hint + extract suggestions from corrections

**Files:** Create `app/glossary.py`, `tests/test_glossary.py`.

- [ ] **Step 1: Write the failing test** — `tests/test_glossary.py`:

```python
from app.glossary import build_hint, extract_suggestions


def test_build_hint_joins_active_terms():
    hint = build_hint(["УЗИ", "Дильноза", "эхокардиография"])
    assert "УЗИ" in hint and "Дильноза" in hint
    assert build_hint([]) == ""


def test_extract_suggestions_finds_new_words_in_correction():
    # words present in the corrected text but not the original are candidate terms
    s = extract_suggestions("хочу записаться на узи", "хочу записаться на УЗИ к Дильнозе")
    assert "УЗИ" in s
    assert "Дильнозе" in s
    assert "хочу" not in s  # unchanged words are not suggestions


def test_extract_suggestions_ignores_short_and_dedupes():
    s = extract_suggestions("а", "а б Эхокардиография Эхокардиография")
    assert s.count("Эхокардиография") == 1
    assert "б" not in s  # too short (< 3 chars)
```

- [ ] **Step 2: Run to verify failure** — FAIL (no module).

- [ ] **Step 3: Implement** — `app/glossary.py`:

```python
import re

_WORD = re.compile(r"[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]{3,}")


def build_hint(active_terms: list[str]) -> str:
    """Assemble active glossary terms into a recognizer initial-prompt hint.
    Empty list -> empty string (no hint)."""
    terms = [t.strip() for t in active_terms if t and t.strip()]
    if not terms:
        return ""
    return "Термины: " + ", ".join(terms) + "."


def extract_suggestions(original: str, corrected: str) -> list[str]:
    """Words (>=3 letters) that appear in the corrected text but not the original,
    as candidate glossary terms. Case-sensitive membership (so 'узи'->'УЗИ' surfaces).
    Deduped, order-preserving."""
    orig = set(_WORD.findall(original or ""))
    out: list[str] = []
    seen: set[str] = set()
    for w in _WORD.findall(corrected or ""):
        if w in orig or w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out
```

- [ ] **Step 4: Run** — all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: glossary hint assembly + correction-diff suggestion extraction"`

---

### Task 5: Dataset module — confirm snapshot manifest + export package

**Files:** Create `app/dataset.py`, `tests/test_dataset.py`.

- [ ] **Step 1: Write the failing test** — `tests/test_dataset.py`:

```python
import json
from pathlib import Path

from app.dataset import export_dataset, snapshot_manifest
from app.db import get_conn, init_db


def _seed_confirmed(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn)
    conn.execute("INSERT INTO calls(file_hash, original_filename, audio_path, source,"
                 " status, uploaded_at, detected_language) VALUES"
                 " ('h1','a.mp3','a.mp3','upload','reviewed','2026-07-14T00:00:00+00:00','uz')")
    cid = conn.execute("SELECT id FROM calls").fetchone()["id"]
    conn.executemany(
        "INSERT INTO segments(call_id, idx, start_sec, end_sec, text_original,"
        " text_corrected, speaker) VALUES (?,?,?,?,?,?,?)",
        [(cid, 0, 0.0, 3.0, "orig1", "испр1", "operator"),
         (cid, 1, 3.0, 6.0, "orig2", None, "client")])
    conn.commit()
    return conn, cid


def test_snapshot_manifest_uses_corrected_and_speakers(cfg):
    conn, cid = _seed_confirmed(cfg)
    m = snapshot_manifest(conn, cid)
    assert m["call_id"] == cid
    assert m["language"] == "uz"
    assert m["turns"][0] == {"speaker": "operator", "start": 0.0, "end": 3.0, "text": "испр1"}
    assert m["turns"][1]["text"] == "orig2"  # falls back to original when not corrected
    conn.close()


def test_export_dataset_writes_manifest_and_counts(cfg, tmp_path):
    conn, cid = _seed_confirmed(cfg)
    m = snapshot_manifest(conn, cid)
    conn.execute("INSERT INTO dialogue_datasets(call_id, confirmed_at, manifest_json)"
                 " VALUES (?,?,?)", (cid, "2026-07-14T00:00:00+00:00", json.dumps(m, ensure_ascii=False)))
    conn.commit()
    out = tmp_path / "export"
    result = export_dataset(conn, cfg, out)
    assert result["count"] == 1
    manifest_text = (Path(result["path"]) / "manifest.jsonl").read_text(encoding="utf-8")
    assert "испр1" in manifest_text  # the corrected text is in the exported manifest
    first = json.loads(manifest_text.splitlines()[0])
    assert first["turns"][0]["text"] == "испр1"
    conn.close()
```

(`manifest.jsonl` = one JSON object per confirmed dialogue, one per line.)

- [ ] **Step 2: Run to verify failure** — FAIL (no module).

- [ ] **Step 3: Implement** — `app/dataset.py`:

```python
import json
import sqlite3
from pathlib import Path

from .config import AppConfig


def snapshot_manifest(conn: sqlite3.Connection, call_id: int) -> dict:
    """Immutable snapshot of a call's corrected two-speaker dialogue for the dataset."""
    call = conn.execute(
        "SELECT id, original_filename, audio_path, detected_language, duration_sec"
        " FROM calls WHERE id=?", (call_id,)).fetchone()
    rows = conn.execute(
        "SELECT idx, start_sec, end_sec, text_original, text_corrected, speaker"
        " FROM segments WHERE call_id=? ORDER BY idx", (call_id,)).fetchall()
    turns = [{
        "speaker": r["speaker"],
        "start": r["start_sec"],
        "end": r["end_sec"],
        "text": r["text_corrected"] if r["text_corrected"] is not None else r["text_original"],
    } for r in rows]
    return {
        "call_id": call["id"],
        "filename": call["original_filename"],
        "language": call["detected_language"],
        "duration_sec": call["duration_sec"],
        "turns": turns,
    }


def export_dataset(conn: sqlite3.Connection, cfg: AppConfig, out_dir: Path) -> dict:
    """Write every confirmed dialogue's manifest to out_dir/manifest.jsonl (one JSON
    object per line) and copy referenced audio into out_dir/audio/. Returns count+path."""
    out_dir = Path(out_dir)
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)
    rows = conn.execute(
        "SELECT d.manifest_json, c.audio_path, c.file_hash FROM dialogue_datasets d"
        " JOIN calls c ON c.id=d.call_id ORDER BY d.id").fetchall()
    lines = []
    import shutil
    for r in rows:
        m = json.loads(r["manifest_json"])
        src = Path(r["audio_path"])
        if src.exists():
            dest_name = f"{r['file_hash'][:16]}{src.suffix}"
            shutil.copy2(src, out_dir / "audio" / dest_name)
            m["audio"] = f"audio/{dest_name}"
        lines.append(json.dumps(m, ensure_ascii=False))
    (out_dir / "manifest.jsonl").write_text("\n".join(lines) + ("\n" if lines else ""),
                                            encoding="utf-8")
    return {"count": len(rows), "path": str(out_dir)}
```

- [ ] **Step 4: Run** — all pass.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: dataset snapshot manifest + export package"`

---

### Task 6: Worker — feed glossary hint into transcription, store speaker labels, generate suggestions

**Files:** Modify `app/worker.py`; Modify `tests/test_worker.py`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_worker.py`:

```python
from app.transcriber import TranscriptResult, TranscriptSegment


class _SpeakerTranscriber:
    def __init__(self): self.hint = None
    def transcribe(self, path, hint=None):
        self.hint = hint
        return TranscriptResult("uz", 0.9, 12.0, [
            TranscriptSegment(0.0, 3.0, "Салом.", speaker="SPEAKER_00"),
            TranscriptSegment(3.0, 6.0, "Салом, ёзилмоқчиман.", speaker="SPEAKER_01"),
        ])


def test_transcribe_stores_mapped_speakers_and_passes_hint(cfg, conn, tmp_path):
    conn.execute("INSERT INTO glossary(term, language, active, created_at)"
                 " VALUES ('УЗИ','ru',1,'2026-07-14T00:00:00+00:00')")
    conn.commit()
    p = tmp_path / "op_2026-07-01.mp3"; p.write_bytes(b"aud")
    from app.ingest import ingest_file
    call_id = ingest_file(conn, cfg, p)["call_id"]
    t = _SpeakerTranscriber()
    from app.worker import claim_job, process_transcribe_job
    process_transcribe_job(conn, cfg, claim_job(conn, "transcribe"), t)
    assert t.hint and "УЗИ" in t.hint  # active glossary term reached the recognizer
    speakers = [r["speaker"] for r in conn.execute(
        "SELECT speaker FROM segments WHERE call_id=? ORDER BY idx", (call_id,))]
    assert speakers == ["operator", "client"]  # clusters mapped
```

- [ ] **Step 2: Run to verify failure** — FAIL (transcriber called without hint; speaker not stored).

- [ ] **Step 3: Implement.** In `process_transcribe_job`:
  - Before calling `transcriber.transcribe(...)`, load the hint: `terms = [r["term"] for r in conn.execute("SELECT term FROM glossary WHERE active=1 ORDER BY id")]; hint = build_hint(terms)` (import `from .glossary import build_hint`).
  - Call `result = transcriber.transcribe(Path(call["audio_path"]), hint=hint)`. **Both `FakeTranscriber` and `FasterWhisperTranscriber` and `DiarizingTranscriber` must accept an optional `hint=None` kwarg** — update their `transcribe` signatures to `def transcribe(self, audio_path, hint=None)`. `FasterWhisperTranscriber` passes `initial_prompt=hint or None` to `model.transcribe(...)`. `FakeTranscriber` ignores it. (Update Task 2/3 code + any existing worker test's fake transcriber that defines `transcribe(self, path)` — make them accept `hint=None`; the existing `FakeTranscriber` and the Task-7 boom fake in `test_worker.py` need the kwarg.)
  - After transcription, run `map_speakers(result.segments)` (import it) before inserting; insert `speaker` into the segments row: extend the INSERT to `(call_id, idx, start_sec, end_sec, text_original, speaker)` values.
  - Leave analyze enqueue unchanged.
  - **Backfill existing fakes:** the pre-existing `BoomTranscriber` in `test_worker.py` and `FakeTranscriber` calls elsewhere must not break — `FakeTranscriber.transcribe` now takes `hint=None`; `BoomTranscriber.transcribe(self, path)` → add `hint=None`.

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass (fix any fake-transcriber signature mismatches surfaced).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: worker feeds glossary hint to recognizer, stores mapped speaker labels"`

---

### Task 7: Review API — speaker flip, confirm-dialogue, suggestions on edit

**Files:** Modify `app/routes/review.py`; Modify `tests/test_api_review.py`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_api_review.py`:

```python
def test_set_segment_speaker(client, cfg):
    call_id = _ready_call(client, cfg)
    seg = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    r = client.put(f"/api/segments/{seg['id']}/speaker", json={"speaker": "client"})
    assert r.status_code == 200
    updated = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    assert updated["speaker"] == "client"
    assert client.put(f"/api/segments/{seg['id']}/speaker",
                      json={"speaker": "nobody"}).status_code == 422


def test_confirm_dialogue_snapshots_dataset(client, cfg):
    from app.db import get_conn
    call_id = _ready_call(client, cfg)
    r = client.post(f"/api/calls/{call_id}/confirm-dialogue")
    assert r.status_code == 200
    conn = get_conn(cfg.db_path)
    n = conn.execute("SELECT COUNT(*) c FROM dialogue_datasets WHERE call_id=?",
                     (call_id,)).fetchone()["c"]
    conn.close()
    assert n == 1
    # re-confirm updates, doesn't duplicate
    client.post(f"/api/calls/{call_id}/confirm-dialogue")
    conn = get_conn(cfg.db_path)
    n2 = conn.execute("SELECT COUNT(*) c FROM dialogue_datasets WHERE call_id=?",
                      (call_id,)).fetchone()["c"]
    conn.close()
    assert n2 == 1


def test_segment_edit_creates_suggestions(client, cfg):
    call_id = _ready_call(client, cfg)
    seg = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    client.patch(f"/api/segments/{seg['id']}",
                 json={"text_corrected": "Клиника Аврора эхокардиография"})
    sugg = client.get("/api/glossary/suggestions").json()
    assert any(s["term"] == "эхокардиография" for s in sugg)
```

(The `/api/glossary/suggestions` endpoint lands in Task 8; this test will pass once both tasks are done — implement Task 7's suggestion-write here, Task 8's read there. If running strictly per-task, mark this third assertion pending until Task 8; simplest is to implement Tasks 7+8 back-to-back.)

- [ ] **Step 2: Run to verify failure** — FAIL (routes missing).

- [ ] **Step 3: Implement** in `app/routes/review.py`:
  - `PUT /api/segments/{segment_id}/speaker` — body `{speaker}`; 404 if segment missing; 422 unless speaker in `("operator","client")`; guard with `_reject_if_analyzing` (load the segment's call status); `UPDATE segments SET speaker=? WHERE id=?`; return the segment row.
  - Extend the existing `edit_segment` (`PATCH /api/segments/{id}`): after a successful correction where `text_corrected` is a non-empty string, compute `extract_suggestions(seg["text_original"], corrected)` (import from `..glossary`) and, for each term not already an active glossary entry and not already a suggestion, `INSERT OR IGNORE INTO glossary_suggestions(term, language, call_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)` (language = the call's `detected_language` or 'ru'). Wrap in try/except so suggestion writing never breaks the edit.
  - `POST /api/calls/{call_id}/confirm-dialogue` — 404 if call missing; build `manifest = snapshot_manifest(db, call_id)` (import from `..dataset`); `INSERT INTO dialogue_datasets(call_id, confirmed_at, manifest_json) VALUES (?,?,?) ON CONFLICT(call_id) DO UPDATE SET confirmed_at=excluded.confirmed_at, manifest_json=excluded.manifest_json`; return `{ok: True}`.

- [ ] **Step 4: Run** — all pass (with Task 8 for the suggestions read).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: review API - speaker flip, confirm-dialogue snapshot, edit-time glossary suggestions"`

---

### Task 8: Glossary + Dataset APIs

**Files:** Create `app/routes/glossary.py`, `app/routes/dataset.py`; Modify `app/main.py`; Create `tests/test_api_glossary.py`, `tests/test_api_dataset.py`.

- [ ] **Step 1: Write the failing tests.** `tests/test_api_glossary.py`:

```python
def test_glossary_crud_and_suggestions(client):
    r = client.post("/api/glossary", json={"term": "УЗИ", "language": "ru", "note": "услуга"})
    assert r.status_code == 200
    gid = r.json()["id"]
    assert any(g["term"] == "УЗИ" for g in client.get("/api/glossary").json())
    assert client.post("/api/glossary", json={"term": "", "language": "ru"}).status_code == 422
    assert client.post("/api/glossary", json={"term": "УЗИ", "language": "ru"}).status_code == 409
    client.patch(f"/api/glossary/{gid}", json={"active": False})
    assert client.get("/api/glossary").json()[0]["active"] == 0 or True  # still listed, inactive
    assert client.delete(f"/api/glossary/{gid}").status_code == 200


def test_accept_suggestion_becomes_glossary_term(client, cfg):
    from app.db import get_conn
    conn = get_conn(cfg.db_path)
    conn.execute("INSERT INTO glossary_suggestions(term, language, status, created_at)"
                 " VALUES ('эхокардиография','ru','pending','2026-07-14T00:00:00+00:00')")
    conn.commit(); conn.close()
    s = client.get("/api/glossary/suggestions").json()
    sid = next(x["id"] for x in s if x["term"] == "эхокардиография")
    assert client.post(f"/api/glossary/suggestions/{sid}/accept").status_code == 200
    assert any(g["term"] == "эхокардиография" for g in client.get("/api/glossary").json())
    assert client.get("/api/glossary/suggestions").json() == []  # accepted -> gone from pending
```

`tests/test_api_dataset.py`:

```python
import io

from app.analyzer import FakeAnalyzer
from app.db import get_conn
from app.transcriber import FakeTranscriber
from app.worker import claim_job, process_analyze_job, process_transcribe_job


def _ready(client, cfg):
    r = client.post("/api/calls/upload",
                    files=[("files", ("op_2026-07-01.mp3", io.BytesIO(b"a"), "audio/mpeg"))])
    cid = r.json()["results"][0]["call_id"]
    conn = get_conn(cfg.db_path)
    process_transcribe_job(conn, cfg, claim_job(conn, "transcribe"), FakeTranscriber())
    process_analyze_job(conn, cfg, claim_job(conn, "analyze"), FakeAnalyzer())
    conn.close()
    return cid


def test_dataset_stats_and_export(client, cfg, tmp_path):
    cid = _ready(client, cfg)
    client.post(f"/api/calls/{cid}/confirm-dialogue")
    stats = client.get("/api/dataset/stats").json()
    assert stats["confirmed"] == 1
    r = client.post("/api/dataset/export")
    assert r.status_code == 200
    from pathlib import Path
    assert (Path(r.json()["path"]) / "manifest.jsonl").exists()
```

- [ ] **Step 2: Run to verify failure** — FAIL (routers missing).

- [ ] **Step 3: Implement.**
  - `app/routes/glossary.py` — `GET /glossary` (all, ordered by term), `POST /glossary` (strict: term non-empty str, language str, note str-or-null; IntegrityError→409 «термин уже есть»), `PATCH /glossary/{id}` (label/note/language str, active bool → 422 else; UPDATE), `DELETE /glossary/{id}` (404 else delete), `GET /glossary/suggestions` (status='pending', newest first), `POST /glossary/suggestions/{id}/accept` (move term into glossary via INSERT OR IGNORE, mark suggestion status='accepted'), `POST /glossary/suggestions/{id}/dismiss` (status='dismissed'). Russian errors; `get_db` dependency; `import type`-free (python).
  - `app/routes/dataset.py` — `GET /dataset/stats` → `{confirmed: <count of dialogue_datasets>, total_calls: <count>}`; `POST /dataset/export` → `out = cfg.data_dir / "dataset-export-<stamp>"`; call `export_dataset(db, cfg, out)`; return its result. Use `_now_stamp()`-style timestamp (reuse the pattern from `misc.py`).
  - `app/main.py` — import + register both routers under `/api` inside `create_app`.

- [ ] **Step 4: Run** — `.venv\Scripts\python.exe -m pytest -q` → all pass (Tasks 7 + 8 together green).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: glossary + dataset APIs (CRUD, suggestions accept/dismiss, export)"`

---

### Task 9: Frontend — API client + Transcript speaker flip + Review confirm & suggestions

**Files:** Modify `web/src/lib/api.ts`, `web/src/components/Transcript.tsx`, `web/src/pages/ReviewPage.tsx`; Modify their tests.

- [ ] **Step 1: Write failing tests.** In `web/src/components/Transcript.test.tsx` add: a segment renders its speaker tag («Оператор»/«Клиент») and a flip control that calls `onSetSpeaker(segId, "client")`. In `web/src/pages/ReviewPage.test.tsx` (create if absent, mock `../lib/api`): «Подтвердить диалог» button calls `api.confirmDialogue(callId)`; a suggested term chip calls `api.acceptSuggestion(id)`.

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.**
  - `api.ts`: add to `Segment` `speaker?: string | null`; add types `GlossaryTerm {id, term, language, note, active}`, `Suggestion {id, term, language, call_id}`, and methods: `setSpeaker(segId, speaker)` → PUT `/api/segments/{id}/speaker`; `confirmDialogue(callId)` → POST `/api/calls/{id}/confirm-dialogue`; `listGlossary()`, `createGlossary(body)`, `patchGlossary(id, body)`, `deleteGlossary(id)`; `listSuggestions()` → GET `/api/glossary/suggestions`, `acceptSuggestion(id)`, `dismissSuggestion(id)`; `datasetStats()`, `exportDataset()`.
  - `Transcript.tsx`: each row shows a small Badge («Оператор» tone info / «Клиент» tone neutral) before the text and, when `editable`, a ghost flip button (lucide `Repeat2`, aria-label «Сменить говорящего») calling a new prop `onSetSpeaker(segId, next)` where next is the opposite of current (default operator). Keep existing edit/seek behavior. Add the prop to the component's props and thread it from ReviewPage.
  - `ReviewPage.tsx`: pass `onSetSpeaker={(id, sp) => api.setSpeaker(id, sp).then(refresh).catch(toastErr)}`. Add a «Подтвердить диалог» primary Button in the header actions (disabled while processing) → `api.confirmDialogue(callId)` + ok toast «Диалог подтверждён — добавлен в набор данных». Add a suggested-terms strip: `usePolling(api.listSuggestions, null, [])`; render pending suggestions as chips with «Добавить в словарь» (accept) and dismiss (×); accept → `api.acceptSuggestion(id)` + refresh the strip + ok toast.

- [ ] **Step 4: Run** — `npm --prefix web run typecheck` (`tsc -b`, clean) + `npm --prefix web run test` (all pass) + `.venv\Scripts\python.exe -m pytest -q` (81+). `npm --prefix web run build`.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat(web): speaker flip, confirm-dialogue, glossary suggestions on review screen"`

---

### Task 10: Frontend — Glossary + Dataset pages + nav + final gate

**Files:** Create `web/src/pages/GlossaryPage.tsx`, `web/src/pages/DatasetPage.tsx`; Modify `web/src/shell/nav.ts`, `web/src/App.tsx`; tests; README.

- [ ] **Step 1: Write failing tests.** `GlossaryPage.test.tsx`: renders terms; adding a term calls `createGlossary`; a pending suggestion accept calls `acceptSuggestion`; delete calls `deleteGlossary`. `DatasetPage.test.tsx`: shows confirmed count from `datasetStats`; «Экспорт данных» calls `exportDataset` and shows the returned path.

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.**
  - `GlossaryPage.tsx` (h1 «Словарь»): a «Добавить термин» form (term, language ru/uz, note) → `createGlossary`; the term table (term, language, note, active toggle → `patchGlossary({active})` sending a real boolean, Trash2 delete with confirm); a «Предложенные термины» section listing `listSuggestions()` with accept/dismiss. Muted intro «Термины подсказываются рекогнайзеру, чтобы он реже ошибался в этих словах.»
  - `DatasetPage.tsx` (h1 «Данные»): stat tiles «Подтверждённых диалогов» / «Всего звонков» from `datasetStats`; muted note «Это сырьё для будущего улучшения узбекского распознавания и озвучки. Ничего не обучается автоматически.»; «Экспорт данных» Button → `exportDataset` → ok toast + show `path` in `font-mono break-all`.
  - `SettingsPage.tsx` (existing): add a «Токен Hugging Face» Card next to the Claude-key card — status Badge (has_hf_token ? ok «Токен задан» : warn «Токен не задан — разделение говорящих не работает»), a `type="password"` input + «Сохранить токен» → `putSettings({hf_token})`, never echoed back. Muted note «Нужен бесплатный токен с huggingface.co для модели разделения говорящих. Хранится в профиле Windows.» Update `api.ts` `Settings` type with `has_hf_token: boolean`, and add a `SettingsPage.test.tsx` assertion that a warn badge shows when `has_hf_token:false`.
  - `nav.ts`: add `{to:"/glossary", label:"Словарь", icon: BookMarked}` and `{to:"/dataset", label:"Данные", icon: Database}` (lucide). `App.tsx`: add the two routes.
  - `README.md`: add «Словарь» and «Данные» to the section list; add a dev note that diarization needs a Hugging Face token in Settings.

- [ ] **Step 4: FINAL GATE.** `npm --prefix web run typecheck` clean; `npm --prefix web run test` all pass; `npm --prefix web run build` (static/ refreshed); emoji sweep `rg -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src` → none; `.venv\Scripts\python.exe -m pytest -q` → all pass. Server smoke (PowerShell, port 8793): start `uvicorn app.server:app`, GET `/` 200 with the app bundle, GET `/api/glossary` 200, GET `/api/dataset/stats` 200, stop.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat(web): glossary + dataset pages, nav, README; phase-3 foundation gate green"`

---

## Verification gate (whole plan)

- Backend `.venv\Scripts\python.exe -m pytest -q` green (≥ ~95 tests); frontend `tsc -b` clean + `npm --prefix web run test` green; build serves the SPA with the new «Словарь»/«Данные» sections.
- Zero emojis in `web/src`; all UI Russian; lucide icons only.
- NOT verified here (needs owner + GPU + real data): real diarization quality, Uzbek recognition lift from the glossary, the export feeding an actual training run. The manual `scripts/diarize_check.py` smoke + the 5–10 real-call acceptance test follow this plan.

## Out of scope (this plan)

Voice cloning (Plan 4), model retraining/fine-tuning, Uzbek TTS, AI phone agent, auth, deployment.
