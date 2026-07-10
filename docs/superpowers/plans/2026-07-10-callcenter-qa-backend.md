# Call-Center QA — Plan 1: Backend Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend of the call-center QA system in `C:\Users\user\Desktop\V2T T2V` — ingest (upload + watched folder), GPU Whisper transcription, Claude scoring with teachable versioned prompts, review/fixation APIs, operators/coaching, TTS, settings/backup — all behind a FastAPI HTTP API with a green pytest suite.

**Architecture:** One Python process: FastAPI serves the API (and later the built React UI); background worker threads consume a SQLite job queue (one transcribe worker — GPU serialized; one analyze worker — Claude API). All state in one SQLite file (WAL). STT and LLM are behind narrow interfaces (`Transcriber`, `Analyzer`) with fakes for tests; gates never hit the GPU or the network.

**Tech Stack:** Python 3.13 (fallback 3.12), FastAPI + uvicorn, SQLite (stdlib `sqlite3`), faster-whisper (CUDA float16, CPU int8 fallback), `anthropic` SDK with structured outputs (`output_config.format` json_schema), `edge-tts`, `watchdog`, pytest + FastAPI TestClient.

**Context:**
- Spec: `docs/superpowers/specs/2026-07-10-callcenter-qa-v2t-t2v-design.md` (in the ailos vault repo). This plan implements everything except the React frontend (Plan 2) and Start.bat browser launch polish (Plan 2).
- **Working directory for ALL tasks: `C:\Users\user\Desktop\V2T T2V`** — a NEW git repo created in Task 1. Do not commit build code to the ailos vault repo.
- Existing v1 files (`transcribe.py`, `analyze.py`, `README.md`, `requirements.txt`) move to `legacy/` in Task 1 — they stay as reference until the new system is verified.
- Scoring models (pinned from claude-api reference 2026-07-10): default `claude-sonnet-5`, low-cost `claude-haiku-4-5`.
- TTS voices: `ru-RU-SvetlanaNeural` / `ru-RU-DmitryNeural` / `uz-UZ-MadinaNeural` / `uz-UZ-SardorNeural`.
- All timestamps stored as UTC ISO-8601 strings.
- Run tests with: `.venv\Scripts\python.exe -m pytest -q` (from the project root). Expected green before every commit.

---

## File Structure (final state of this plan)

```
V2T T2V/
  app/
    __init__.py
    config.py          # AppConfig: paths, settings (DEFAULTS + %APPDATA% config.json), api key
    db.py              # connection, schema DDL, init_db, criteria seed
    ingest.py          # hash/dedup/store audio, filename→operator/date, enqueue transcribe
    transcriber.py     # TranscriptResult, FakeTranscriber, FasterWhisperTranscriber
    prompts.py         # Russian base prompt, assemble from criteria+examples, versioning
    analyzer.py        # build_schema, ClaudeAnalyzer (structured outputs), FakeAnalyzer
    worker.py          # claim/process jobs, retries+backoff, stuck-job recovery, WorkerThread
    watcher.py         # startup scan + watchdog handler for incoming/
    tts.py             # edge-tts synth (injectable engine), VOICES
    main.py            # create_app factory: routers, lifespan, static
    server.py          # module-level `app` for uvicorn
    routes/
      __init__.py
      calls.py         # upload, list+filters, detail, audio, patch, retry
      review.py        # segment edit, score override, review, rescore
      scorecard.py     # criteria, examples, prompt preview/versions
      operators.py     # operators CRUD + stats, coaching, dashboard
      misc.py          # tts, scripts, settings, backup
  tests/
    conftest.py
    test_config.py  test_db.py  test_ingest.py  test_transcriber.py
    test_prompts.py test_analyzer.py test_worker.py test_watcher.py
    test_api_calls.py test_api_review.py test_api_scorecard.py
    test_api_operators.py test_api_misc.py
  scripts/gpu_check.py
  legacy/              # v1 scripts (moved, unchanged)
  incoming/            # watched folder (gitignored contents)
  data/                # sqlite + audio + tts + backups (gitignored)
  requirements.txt  pytest.ini  .gitignore  Start.bat  README.md
```

---

### Task 1: Scaffold, venv, config module

**Files:**
- Create: `.gitignore`, `requirements.txt`, `pytest.ini`, `app/__init__.py`, `app/config.py`, `tests/conftest.py`, `tests/test_config.py`
- Move: `transcribe.py`, `analyze.py`, `README.md`, `requirements.txt` (old) → `legacy/`

- [ ] **Step 1: Init repo, move legacy, write scaffold files**

```powershell
cd "C:\Users\user\Desktop\V2T T2V"
git init
New-Item -ItemType Directory -Force legacy, app, app\routes, tests, scripts, incoming, data | Out-Null
Move-Item transcribe.py, analyze.py, README.md legacy\
Move-Item requirements.txt legacy\requirements-v1.txt
```

`.gitignore`:

```
.venv/
__pycache__/
*.pyc
data/
incoming/
calls/
transcripts/
results.csv
.pytest_cache/
node_modules/
```

`requirements.txt`:

```
fastapi>=0.115
uvicorn[standard]>=0.30
python-multipart>=0.0.9
faster-whisper>=1.1.0
anthropic>=0.60.0
edge-tts>=6.1.0
watchdog>=4.0.0
pytest>=8.0
httpx>=0.27
```

`pytest.ini`:

```ini
[pytest]
testpaths = tests
addopts = -q
```

`app/__init__.py` and `app/routes/__init__.py`: empty files.

- [ ] **Step 2: Create venv and install**

```powershell
py -3.13 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Expected: all packages install. **If `faster-whisper`/`ctranslate2` has no 3.13 wheel:** delete `.venv`, recreate with `py -3.12 -m venv .venv` (install Python 3.12 from python.org if `py -3.12` is missing), reinstall. Also install GPU libs (best-effort — failure here is OK, CPU fallback exists): `.venv\Scripts\python.exe -m pip install nvidia-cublas-cu12 nvidia-cudnn-cu12`.

- [ ] **Step 3: Write the failing test** — `tests/conftest.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from app.config import AppConfig


@pytest.fixture(autouse=True)
def _no_env_api_key(monkeypatch):
    # A developer machine may have a real key exported; tests must not see it.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture
def cfg(tmp_path):
    c = AppConfig(base_dir=tmp_path / "base", config_path=tmp_path / "config.json")
    c.ensure_dirs()
    return c
```

`tests/test_config.py`:

```python
from app.config import AppConfig, DEFAULTS


def test_dirs_created(cfg):
    for d in (cfg.data_dir, cfg.audio_dir, cfg.tts_dir, cfg.backup_dir, cfg.incoming_dir):
        assert d.is_dir()
    assert cfg.db_path.parent == cfg.data_dir


def test_settings_defaults_and_persistence(cfg):
    s = cfg.load_settings()
    assert s["model"] == "claude-sonnet-5"
    assert s["model_low_cost"] == "claude-haiku-4-5"
    assert s["whisper_model"] == "large-v3"
    cfg.save_settings({"model": "claude-haiku-4-5", "watch_enabled": False})
    s2 = cfg.load_settings()
    assert s2["model"] == "claude-haiku-4-5"
    assert s2["watch_enabled"] is False
    assert s2["whisper_device"] == DEFAULTS["whisper_device"]  # unmerged keys keep defaults


def test_api_key_env_wins(cfg, monkeypatch):
    cfg.save_settings({"anthropic_api_key": "sk-file"})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-env")
    assert cfg.api_key() == "sk-env"
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    assert cfg.api_key() == "sk-file"
```

- [ ] **Step 4: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.config'` (or ImportError).

- [ ] **Step 5: Implement** — `app/config.py`:

```python
import json
import os
from pathlib import Path

DEFAULTS = {
    "model": "claude-sonnet-5",
    "model_low_cost": "claude-haiku-4-5",
    "whisper_model": "large-v3",
    "whisper_device": "auto",  # auto | cuda | cpu
    "port": 8787,
    "watch_enabled": True,
    "filename_pattern": r"^(?P<operator>.+?)[_\- ](?P<date>\d{4}-\d{2}-\d{2})",
}

AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".opus"}


def default_config_path() -> Path:
    root = Path(os.environ.get("APPDATA", str(Path.home())))
    return root / "callcenter-qa" / "config.json"


class AppConfig:
    def __init__(self, base_dir: Path, config_path: Path | None = None):
        self.base_dir = Path(base_dir)
        self.config_path = Path(config_path) if config_path else default_config_path()

    @property
    def data_dir(self) -> Path: return self.base_dir / "data"
    @property
    def audio_dir(self) -> Path: return self.data_dir / "audio"
    @property
    def tts_dir(self) -> Path: return self.data_dir / "tts"
    @property
    def backup_dir(self) -> Path: return self.data_dir / "backups"
    @property
    def tmp_dir(self) -> Path: return self.data_dir / "tmp"
    @property
    def incoming_dir(self) -> Path: return self.base_dir / "incoming"
    @property
    def db_path(self) -> Path: return self.data_dir / "ccqa.sqlite3"
    @property
    def static_dir(self) -> Path: return self.base_dir / "static"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.audio_dir, self.tts_dir, self.backup_dir,
                  self.tmp_dir, self.incoming_dir):
            d.mkdir(parents=True, exist_ok=True)

    def _read_file(self) -> dict:
        if self.config_path.exists():
            try:
                return json.loads(self.config_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def load_settings(self) -> dict:
        return {**DEFAULTS, **self._read_file()}

    def save_settings(self, updates: dict) -> dict:
        merged = {**self._read_file(), **updates}
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
        return {**DEFAULTS, **merged}

    def api_key(self) -> str | None:
        return os.environ.get("ANTHROPIC_API_KEY") or self._read_file().get("anthropic_api_key")
```

- [ ] **Step 6: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: scaffold backend project - config module, venv, legacy v1 moved"
```

---

### Task 2: Database schema + criteria seed

**Files:**
- Create: `app/db.py`, `tests/test_db.py`
- Modify: `tests/conftest.py` (add `conn` fixture)

- [ ] **Step 1: Write the failing test** — `tests/test_db.py`:

```python
from app.db import get_conn, init_db


def test_init_idempotent_and_wal(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn)
    init_db(conn)  # must not raise
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    conn.close()


def test_criteria_seeded_once(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn)
    keys = [r["key"] for r in conn.execute("SELECT key FROM criteria ORDER BY sort")]
    assert keys == ["greeting", "need_identified", "info_accuracy",
                    "booking_offer", "politeness", "closing"]
    init_db(conn)
    assert conn.execute("SELECT COUNT(*) c FROM criteria").fetchone()["c"] == 6
    conn.close()


def test_all_tables_exist(cfg):
    conn = get_conn(cfg.db_path)
    init_db(conn)
    tables = {r["name"] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"operators", "calls", "segments", "criteria", "examples",
            "prompt_versions", "analyses", "analysis_scores", "reviews",
            "scripts", "coaching", "jobs"} <= tables
    conn.close()
```

Append to `tests/conftest.py`:

```python
from app.db import get_conn, init_db


@pytest.fixture
def conn(cfg):
    c = get_conn(cfg.db_path)
    init_db(c)
    yield c
    c.close()
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_db.py -q`
Expected: FAIL — no module `app.db`.

- [ ] **Step 3: Implement** — `app/db.py`:

```python
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS operators(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  filename_alias TEXT,
  active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS calls(
  id INTEGER PRIMARY KEY,
  file_hash TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  operator_id INTEGER REFERENCES operators(id),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_msg TEXT,
  duration_sec REAL,
  detected_language TEXT,
  language_probability REAL,
  uploaded_at TEXT NOT NULL,
  call_date TEXT);

CREATE TABLE IF NOT EXISTS segments(
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id),
  idx INTEGER NOT NULL,
  start_sec REAL,
  end_sec REAL,
  text_original TEXT NOT NULL,
  text_corrected TEXT,
  edited_at TEXT,
  UNIQUE(call_id, idx));

CREATE TABLE IF NOT EXISTS criteria(
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label_ru TEXT NOT NULL,
  description_ru TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS examples(
  id INTEGER PRIMARY KEY,
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  kind TEXT NOT NULL CHECK(kind IN ('good','bad')),
  phrase TEXT NOT NULL,
  note TEXT,
  call_id INTEGER REFERENCES calls(id),
  segment_id INTEGER REFERENCES segments(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS prompt_versions(
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  assembled_text TEXT NOT NULL,
  created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS analyses(
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id),
  prompt_version_id INTEGER NOT NULL REFERENCES prompt_versions(id),
  model TEXT NOT NULL,
  booking_result TEXT,
  missed_booking INTEGER,
  summary TEXT,
  recommendation TEXT,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS analysis_scores(
  id INTEGER PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES analyses(id),
  criterion_key TEXT NOT NULL,
  ai_score INTEGER NOT NULL,
  ai_reason TEXT,
  reviewer_score INTEGER,
  UNIQUE(analysis_id, criterion_key));

CREATE TABLE IF NOT EXISTS reviews(
  call_id INTEGER PRIMARY KEY REFERENCES calls(id),
  comment TEXT,
  reviewed_at TEXT);

CREATE TABLE IF NOT EXISTS scripts(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  voice TEXT NOT NULL DEFAULT 'female',
  audio_path TEXT,
  updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS coaching(
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id),
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  note TEXT NOT NULL,
  script_id INTEGER REFERENCES scripts(id),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  resolved_at TEXT);

CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT);

CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs(kind, status);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_segments_call ON segments(call_id, idx);
"""

SEED_CRITERIA = [
    ("greeting", "Приветствие", "Приветствие + название клиники в начале звонка", 1),
    ("need_identified", "Выявление потребности", "Выяснил потребность пациента (жалоба, услуга, врач)", 2),
    ("info_accuracy", "Точность информации", "Дал понятную информацию (цены, адрес, врач, время)", 3),
    ("booking_offer", "Предложение записи", "Активно предложил запись на приём (не ждал, пока попросят)", 4),
    ("politeness", "Вежливость", "Вежливость, эмпатия, отсутствие раздражения и перебиваний", 5),
    ("closing", "Завершение звонка", "Корректное завершение: резюме, подтверждение, прощание", 6),
]


def get_conn(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    if conn.execute("SELECT COUNT(*) FROM criteria").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO criteria(key, label_ru, description_ru, sort) VALUES (?,?,?,?)",
            SEED_CRITERIA)
    conn.commit()
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass (6 total so far).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: sqlite schema, WAL connection, criteria seed"
```

---

### Task 3: Ingest — hash, dedup, filename parsing, job enqueue

**Files:**
- Create: `app/ingest.py`, `tests/test_ingest.py`

- [ ] **Step 1: Write the failing test** — `tests/test_ingest.py`:

```python
from pathlib import Path

from app.ingest import ingest_file, parse_filename


def _make_audio(tmp_path: Path, name: str, content: bytes = b"RIFFfake-audio") -> Path:
    p = tmp_path / name
    p.write_bytes(content)
    return p


def test_parse_filename_operator_and_date(cfg):
    settings = cfg.load_settings()
    op, date = parse_filename(settings, "dilnoza_2026-07-01.mp3")
    assert op == "dilnoza" and date == "2026-07-01"
    op2, date2 = parse_filename(settings, "call-recording.mp3")
    assert op2 is None and date2 is None


def test_ingest_creates_call_and_job(cfg, conn, tmp_path):
    conn.execute("INSERT INTO operators(name, filename_alias) VALUES ('Дильноза', 'dilnoza')")
    conn.commit()
    src = _make_audio(tmp_path, "dilnoza_2026-07-01.mp3")
    result = ingest_file(conn, cfg, src, source="upload")
    assert result["status"] == "created"
    call = conn.execute("SELECT * FROM calls WHERE id=?", (result["call_id"],)).fetchone()
    assert call["status"] == "queued"
    assert call["call_date"] == "2026-07-01"
    assert call["original_filename"] == "dilnoza_2026-07-01.mp3"
    op = conn.execute("SELECT name FROM operators WHERE id=?", (call["operator_id"],)).fetchone()
    assert op["name"] == "Дильноза"
    assert Path(call["audio_path"]).exists()
    job = conn.execute("SELECT * FROM jobs WHERE call_id=?", (call["id"],)).fetchone()
    assert job["kind"] == "transcribe" and job["status"] == "pending"


def test_ingest_dedup_by_content(cfg, conn, tmp_path):
    src1 = _make_audio(tmp_path, "a.mp3", b"same-bytes")
    src2 = _make_audio(tmp_path, "b.mp3", b"same-bytes")
    r1 = ingest_file(conn, cfg, src1)
    r2 = ingest_file(conn, cfg, src2)
    assert r1["status"] == "created"
    assert r2["status"] == "duplicate"
    assert r2["call_id"] == r1["call_id"]
    assert conn.execute("SELECT COUNT(*) c FROM calls").fetchone()["c"] == 1


def test_ingest_unknown_operator_is_null(cfg, conn, tmp_path):
    src = _make_audio(tmp_path, "somebody_2026-07-02.mp3")
    r = ingest_file(conn, cfg, src)
    call = conn.execute("SELECT operator_id FROM calls WHERE id=?", (r["call_id"],)).fetchone()
    assert call["operator_id"] is None


def test_ingest_delete_source(cfg, conn, tmp_path):
    src = _make_audio(tmp_path, "x.mp3", b"watched-file")
    ingest_file(conn, cfg, src, source="watch", delete_source=True)
    assert not src.exists()
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_ingest.py -q`
Expected: FAIL — no module `app.ingest`.

- [ ] **Step 3: Implement** — `app/ingest.py`:

```python
import hashlib
import re
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import AppConfig


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_filename(settings: dict, filename: str) -> tuple[str | None, str | None]:
    """Return (operator_token, date_str) parsed from the filename, or Nones."""
    m = re.match(settings["filename_pattern"], Path(filename).stem)
    if not m:
        return None, None
    groups = m.groupdict()
    return groups.get("operator"), groups.get("date")


def _find_operator(conn: sqlite3.Connection, token: str | None) -> int | None:
    if not token:
        return None
    row = conn.execute(
        "SELECT id FROM operators WHERE active=1 AND "
        "(LOWER(filename_alias)=LOWER(?) OR LOWER(name)=LOWER(?))",
        (token, token)).fetchone()
    return row["id"] if row else None


def ingest_file(conn: sqlite3.Connection, cfg: AppConfig, src: Path,
                original_name: str | None = None, source: str = "upload",
                delete_source: bool = False) -> dict:
    original_name = original_name or src.name
    file_hash = _sha256(src)

    existing = conn.execute(
        "SELECT id FROM calls WHERE file_hash=?", (file_hash,)).fetchone()
    if existing:
        if delete_source:
            src.unlink(missing_ok=True)
        return {"status": "duplicate", "call_id": existing["id"]}

    op_token, date_str = parse_filename(cfg.load_settings(), original_name)
    if not date_str:
        try:
            date_str = datetime.fromtimestamp(
                src.stat().st_mtime, tz=timezone.utc).date().isoformat()
        except OSError:
            date_str = datetime.now(timezone.utc).date().isoformat()
    operator_id = _find_operator(conn, op_token)

    month_dir = cfg.audio_dir / date_str[:7]
    month_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(original_name).suffix.lower() or ".bin"
    dest = month_dir / f"{file_hash[:16]}{ext}"
    if delete_source:
        shutil.move(str(src), str(dest))
    else:
        shutil.copy2(str(src), str(dest))

    cur = conn.execute(
        "INSERT INTO calls(file_hash, original_filename, audio_path, operator_id,"
        " source, status, uploaded_at, call_date) VALUES (?,?,?,?,?,'queued',?,?)",
        (file_hash, original_name, str(dest), operator_id, source, _now(), date_str))
    call_id = cur.lastrowid
    conn.execute(
        "INSERT INTO jobs(call_id, kind, status, created_at) VALUES (?,'transcribe','pending',?)",
        (call_id, _now()))
    conn.commit()
    return {"status": "created", "call_id": call_id}
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: ingest - content-hash dedup, filename operator/date parsing, transcribe job enqueue"
```

---

### Task 4: Transcriber interface — fake + faster-whisper

**Files:**
- Create: `app/transcriber.py`, `tests/test_transcriber.py`, `scripts/gpu_check.py`

- [ ] **Step 1: Write the failing test** — `tests/test_transcriber.py`:

```python
from app.transcriber import FakeTranscriber, TranscriptResult, TranscriptSegment


def test_fake_transcriber_returns_result(tmp_path):
    t = FakeTranscriber()
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"x")
    result = t.transcribe(audio)
    assert isinstance(result, TranscriptResult)
    assert result.language == "ru"
    assert len(result.segments) == 2
    assert result.segments[0].text
    assert result.duration_sec > 0


def test_fake_transcriber_custom_segments(tmp_path):
    segs = [TranscriptSegment(start=0.0, end=2.5, text="Алло, клиника Мед.")]
    t = FakeTranscriber(segments=segs, language="uz", duration=2.5)
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"x")
    r = t.transcribe(audio)
    assert r.language == "uz"
    assert r.segments == segs
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_transcriber.py -q`
Expected: FAIL — no module `app.transcriber`.

- [ ] **Step 3: Implement** — `app/transcriber.py`:

```python
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptResult:
    language: str
    language_probability: float
    duration_sec: float
    segments: list[TranscriptSegment] = field(default_factory=list)


class FakeTranscriber:
    """Deterministic transcriber for tests — never touches GPU or disk decoding."""

    def __init__(self, segments=None, language="ru", probability=0.95, duration=10.0):
        self._segments = segments or [
            TranscriptSegment(0.0, 4.0, "Здравствуйте, клиника, слушаю вас."),
            TranscriptSegment(4.0, 10.0, "Хочу записаться на УЗИ, сколько стоит?"),
        ]
        self._language = language
        self._probability = probability
        self._duration = duration

    def transcribe(self, audio_path: Path) -> TranscriptResult:
        return TranscriptResult(
            language=self._language,
            language_probability=self._probability,
            duration_sec=self._duration,
            segments=list(self._segments),
        )


class FasterWhisperTranscriber:
    """Real STT. Lazy model load; device 'auto' tries CUDA then falls back to CPU."""

    def __init__(self, model_size: str = "large-v3", device: str = "auto"):
        self.model_size = model_size
        self.device_pref = device
        self.device_used: str | None = None
        self._model = None

    def _load(self):
        if self._model is not None:
            return
        from faster_whisper import WhisperModel
        candidates = (["cuda", "cpu"] if self.device_pref == "auto"
                      else [self.device_pref])
        last_err = None
        for dev in candidates:
            compute = "float16" if dev == "cuda" else "int8"
            try:
                self._model = WhisperModel(self.model_size, device=dev, compute_type=compute)
                self.device_used = dev
                return
            except Exception as e:  # cuda unavailable, missing cudnn, etc.
                last_err = e
        raise RuntimeError(f"could not load whisper model: {last_err}")

    def transcribe(self, audio_path: Path) -> TranscriptResult:
        self._load()
        segments, info = self._model.transcribe(
            str(audio_path), language=None, vad_filter=True, beam_size=5)
        segs = [TranscriptSegment(round(s.start, 1), round(s.end, 1), s.text.strip())
                for s in segments]
        return TranscriptResult(
            language=info.language,
            language_probability=round(info.language_probability, 2),
            duration_sec=round(info.duration, 1),
            segments=segs,
        )
```

`scripts/gpu_check.py` (manual diagnostic, not part of gates):

```python
"""Run manually: .venv\\Scripts\\python.exe scripts\\gpu_check.py
Reports whether CUDA transcription is available and times a tiny synthetic clip."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.transcriber import FasterWhisperTranscriber

t = FasterWhisperTranscriber(model_size="tiny", device="auto")
t._load()
print(f"Model loaded on device: {t.device_used}")
if t.device_used != "cuda":
    print("WARNING: running on CPU. For GPU install: "
          "pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass (FasterWhisperTranscriber is not exercised by gates).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: Transcriber interface - fake for tests, faster-whisper with cuda-to-cpu fallback"
```

---

### Task 5: Prompt assembly + versioning

**Files:**
- Create: `app/prompts.py`, `tests/test_prompts.py`

- [ ] **Step 1: Write the failing test** — `tests/test_prompts.py`:

```python
from app.prompts import assemble_prompt, ensure_prompt_version


def _criteria(conn):
    return [dict(r) for r in conn.execute(
        "SELECT * FROM criteria WHERE active=1 ORDER BY sort")]


def test_assemble_contains_criteria_and_examples(conn):
    conn.execute(
        "INSERT INTO examples(criterion_id, kind, phrase, note, created_at)"
        " VALUES (1, 'good', 'Клиника Здоровье, здравствуйте!', 'называет клинику',"
        " '2026-07-10T00:00:00+00:00')")
    conn.commit()
    examples = [dict(r) for r in conn.execute(
        "SELECT e.*, c.key AS criterion_key FROM examples e"
        " JOIN criteria c ON c.id=e.criterion_id WHERE e.active=1")]
    text = assemble_prompt(_criteria(conn), examples)
    assert "Приветствие" in text
    assert "Клиника Здоровье, здравствуйте!" in text
    assert "называет клинику" in text
    assert "оператора" in text.lower()  # base instructions present


def test_version_created_once_and_bumps_on_change(conn):
    v1 = ensure_prompt_version(conn)
    v2 = ensure_prompt_version(conn)
    assert v1["id"] == v2["id"]  # nothing changed -> same version
    conn.execute(
        "INSERT INTO examples(criterion_id, kind, phrase, created_at)"
        " VALUES (2, 'bad', 'Не знаю, перезвоните позже', '2026-07-10T00:00:00+00:00')")
    conn.commit()
    v3 = ensure_prompt_version(conn)
    assert v3["id"] != v1["id"]
    assert conn.execute("SELECT COUNT(*) c FROM prompt_versions").fetchone()["c"] == 2


def test_inactive_examples_and_criteria_excluded(conn):
    conn.execute(
        "INSERT INTO examples(criterion_id, kind, phrase, active, created_at)"
        " VALUES (1, 'good', 'СКРЫТАЯ ФРАЗА', 0, '2026-07-10T00:00:00+00:00')")
    conn.execute("UPDATE criteria SET active=0 WHERE key='closing'")
    conn.commit()
    v = ensure_prompt_version(conn)
    assert "СКРЫТАЯ ФРАЗА" not in v["assembled_text"]
    assert "Завершение звонка" not in v["assembled_text"]
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_prompts.py -q`
Expected: FAIL — no module `app.prompts`.

- [ ] **Step 3: Implement** — `app/prompts.py`:

```python
import hashlib
import sqlite3
from datetime import datetime, timezone

BASE_PROMPT = """Ты — старший специалист по контролю качества колл-центра \
медицинской клиники в Ташкенте. Звонки могут быть на русском, узбекском или \
смешанном языке. Транскрипт сделан автоматически и может содержать ошибки \
распознавания — учитывай это и не снижай оценку за явные артефакты распознавания.

Оцени работу ОПЕРАТОРА (не пациента) по чек-листу. Каждый критерий: 0, 1 или 2.
  0 = не выполнено, 1 = частично, 2 = полностью.
Для каждого критерия дай короткое обоснование (1 предложение, по-русски).

Также определи:
- booking_result: "записан" | "не записан" | "перезвонит" | "неясно"
- missed_booking: true, если пациента МОЖНО было записать, но оператор не предложил
- summary: 1-2 предложения — суть звонка и главная проблема, если есть
- recommendation: 1 конкретный совет оператору
"""


def assemble_prompt(criteria: list[dict], examples: list[dict]) -> str:
    parts = [BASE_PROMPT, "Критерии:"]
    for i, c in enumerate(criteria, 1):
        parts.append(f"{i}. {c['key']} — {c['label_ru']}: {c['description_ru']}")

    by_key: dict[str, list[dict]] = {}
    for e in examples:
        by_key.setdefault(e["criterion_key"], []).append(e)
    if by_key:
        parts.append("\nПримеры из реальных звонков этой клиники "
                     "(учитывай их при оценке):")
        for c in criteria:
            for e in by_key.get(c["key"], []):
                mark = "ХОРОШО" if e["kind"] == "good" else "ПЛОХО"
                note = f" ({e['note']})" if e.get("note") else ""
                parts.append(f"- [{c['label_ru']}] {mark}: «{e['phrase']}»{note}")
    return "\n".join(parts)


def _load_parts(conn: sqlite3.Connection) -> tuple[list[dict], list[dict]]:
    criteria = [dict(r) for r in conn.execute(
        "SELECT * FROM criteria WHERE active=1 ORDER BY sort")]
    examples = [dict(r) for r in conn.execute(
        "SELECT e.*, c.key AS criterion_key FROM examples e"
        " JOIN criteria c ON c.id=e.criterion_id"
        " WHERE e.active=1 AND c.active=1 ORDER BY e.id")]
    return criteria, examples


def ensure_prompt_version(conn: sqlite3.Connection) -> dict:
    """Assemble the current prompt; insert a new immutable version iff it changed."""
    criteria, examples = _load_parts(conn)
    text = assemble_prompt(criteria, examples)
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    row = conn.execute("SELECT * FROM prompt_versions WHERE hash=?", (h,)).fetchone()
    if row:
        return dict(row)
    cur = conn.execute(
        "INSERT INTO prompt_versions(hash, assembled_text, created_at) VALUES (?,?,?)",
        (h, text, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    return dict(conn.execute(
        "SELECT * FROM prompt_versions WHERE id=?", (cur.lastrowid,)).fetchone())
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: prompt assembly from criteria+examples with immutable hashed versions"
```

---

### Task 6: Analyzer — Claude structured outputs + fake

**Files:**
- Create: `app/analyzer.py`, `tests/test_analyzer.py`

- [ ] **Step 1: Write the failing test** — `tests/test_analyzer.py`:

```python
import json
from types import SimpleNamespace

from app.analyzer import ClaudeAnalyzer, FakeAnalyzer, build_schema

CRITERIA = [
    {"key": "greeting", "label_ru": "Приветствие", "description_ru": "x"},
    {"key": "closing", "label_ru": "Завершение", "description_ru": "y"},
]


def test_build_schema_shape():
    schema = build_schema(CRITERIA)
    assert schema["additionalProperties"] is False
    assert schema["properties"]["greeting"]["properties"]["score"]["enum"] == [0, 1, 2]
    assert "reason" in schema["properties"]["greeting"]["required"]
    assert set(schema["required"]) == {"greeting", "closing", "booking_result",
                                       "missed_booking", "summary", "recommendation"}
    assert schema["properties"]["booking_result"]["enum"] == [
        "записан", "не записан", "перезвонит", "неясно"]


def test_fake_analyzer_covers_all_criteria():
    fake = FakeAnalyzer()
    result = fake.analyze("текст звонка", "ru", 60.0, "system prompt", CRITERIA)
    for c in CRITERIA:
        assert result[c["key"]]["score"] in (0, 1, 2)
        assert result[c["key"]]["reason"]
    assert result["booking_result"] in ("записан", "не записан", "перезвонит", "неясно")
    assert isinstance(result["missed_booking"], bool)


def test_claude_analyzer_parses_text_block(monkeypatch, cfg):
    payload = {
        "greeting": {"score": 2, "reason": "Назвал клинику"},
        "closing": {"score": 1, "reason": "Без резюме"},
        "booking_result": "записан", "missed_booking": False,
        "summary": "Запись на УЗИ", "recommendation": "Резюмировать в конце",
    }
    fake_response = SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="thinking", thinking=""),
                 SimpleNamespace(type="text", text=json.dumps(payload, ensure_ascii=False))])

    analyzer = ClaudeAnalyzer(cfg, api_key="sk-test")
    captured = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return fake_response

    monkeypatch.setattr(analyzer._client.messages, "create", fake_create)
    result = analyzer.analyze("текст", "ru", 60.0, "SYSTEM", CRITERIA)
    assert result["greeting"]["score"] == 2
    assert captured["model"] == cfg.load_settings()["model"]
    assert captured["system"] == "SYSTEM"
    assert captured["output_config"]["format"]["type"] == "json_schema"
    assert "текст" in captured["messages"][0]["content"]


def test_claude_analyzer_raises_on_refusal(monkeypatch, cfg):
    analyzer = ClaudeAnalyzer(cfg, api_key="sk-test")
    monkeypatch.setattr(
        analyzer._client.messages, "create",
        lambda **kw: SimpleNamespace(stop_reason="refusal", content=[]))
    try:
        analyzer.analyze("текст", "ru", 60.0, "SYSTEM", CRITERIA)
        assert False, "expected AnalyzerError"
    except Exception as e:
        assert "refus" in str(e).lower()
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_analyzer.py -q`
Expected: FAIL — no module `app.analyzer`.

- [ ] **Step 3: Implement** — `app/analyzer.py`:

```python
import json

from .config import AppConfig

BOOKING_RESULTS = ["записан", "не записан", "перезвонит", "неясно"]


class AnalyzerError(Exception):
    pass


def build_schema(criteria: list[dict]) -> dict:
    props: dict = {}
    required: list[str] = []
    for c in criteria:
        props[c["key"]] = {
            "type": "object",
            "properties": {
                "score": {"type": "integer", "enum": [0, 1, 2]},
                "reason": {"type": "string"},
            },
            "required": ["score", "reason"],
            "additionalProperties": False,
        }
        required.append(c["key"])
    props["booking_result"] = {"type": "string", "enum": BOOKING_RESULTS}
    props["missed_booking"] = {"type": "boolean"}
    props["summary"] = {"type": "string"}
    props["recommendation"] = {"type": "string"}
    required += ["booking_result", "missed_booking", "summary", "recommendation"]
    return {"type": "object", "properties": props,
            "required": required, "additionalProperties": False}


class FakeAnalyzer:
    """Deterministic analyzer for tests. Optionally fails N times first (retry tests)."""

    def __init__(self, fail_times: int = 0):
        self.fail_times = fail_times
        self.calls = 0
        self.model = "fake-model"

    def analyze(self, transcript_text, language, duration_sec, system_prompt, criteria):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise AnalyzerError("simulated API failure")
        result = {c["key"]: {"score": 2, "reason": f"ок по критерию {c['key']}"}
                  for c in criteria}
        result.update({
            "booking_result": "записан", "missed_booking": False,
            "summary": "Тестовый звонок.", "recommendation": "Продолжать в том же духе.",
        })
        return result


class ClaudeAnalyzer:
    """Scores a transcript with the Claude API using structured outputs."""

    def __init__(self, cfg: AppConfig, api_key: str | None = None):
        import anthropic
        self.cfg = cfg
        key = api_key or cfg.api_key()
        if not key:
            raise AnalyzerError(
                "ANTHROPIC_API_KEY не задан — добавьте ключ на странице Настройки.")
        self._client = anthropic.Anthropic(api_key=key)
        self.model = cfg.load_settings()["model"]

    def analyze(self, transcript_text, language, duration_sec, system_prompt, criteria):
        self.model = self.cfg.load_settings()["model"]
        response = self._client.messages.create(
            model=self.model,
            max_tokens=2000,
            system=system_prompt,
            output_config={"format": {"type": "json_schema",
                                      "schema": build_schema(criteria)}},
            messages=[{
                "role": "user",
                "content": (f"Транскрипт звонка (язык: {language}, "
                            f"длительность: {duration_sec} сек):\n\n{transcript_text}"),
            }],
        )
        if response.stop_reason == "refusal":
            raise AnalyzerError("модель отказалась анализировать звонок (refusal)")
        text = next((b.text for b in response.content if b.type == "text"), None)
        if text is None:
            raise AnalyzerError("в ответе модели нет текстового блока")
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise AnalyzerError(f"невалидный JSON от модели: {e}") from e
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: Claude analyzer with structured-output json_schema, deterministic fake"
```

---

### Task 7: Job worker — claim, process, retry/backoff, recovery

**Files:**
- Create: `app/worker.py`, `tests/test_worker.py`

- [ ] **Step 1: Write the failing test** — `tests/test_worker.py`:

```python
from app.analyzer import FakeAnalyzer
from app.ingest import ingest_file
from app.transcriber import FakeTranscriber
from app.worker import claim_job, process_analyze_job, process_transcribe_job, recover_stuck_jobs


def _ingest(cfg, conn, tmp_path, content=b"audio-bytes"):
    p = tmp_path / "op_2026-07-01.mp3"
    p.write_bytes(content)
    return ingest_file(conn, cfg, p)["call_id"]


def test_full_pipeline_with_fakes(cfg, conn, tmp_path):
    call_id = _ingest(cfg, conn, tmp_path)

    job = claim_job(conn, "transcribe")
    assert job and job["call_id"] == call_id
    process_transcribe_job(conn, cfg, job, FakeTranscriber())

    call = conn.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    assert call["status"] == "analyzing"
    assert call["detected_language"] == "ru"
    segs = conn.execute(
        "SELECT * FROM segments WHERE call_id=? ORDER BY idx", (call_id,)).fetchall()
    assert len(segs) == 2 and segs[0]["text_original"]

    job2 = claim_job(conn, "analyze")
    assert job2 and job2["call_id"] == call_id
    process_analyze_job(conn, cfg, job2, FakeAnalyzer())

    call = conn.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    assert call["status"] == "ready"
    analysis = conn.execute(
        "SELECT * FROM analyses WHERE call_id=?", (call_id,)).fetchone()
    assert analysis["booking_result"] == "записан"
    assert analysis["prompt_version_id"] is not None
    scores = conn.execute(
        "SELECT * FROM analysis_scores WHERE analysis_id=?", (analysis["id"],)).fetchall()
    assert len(scores) == 6  # seeded criteria
    assert all(s["ai_score"] == 2 and s["ai_reason"] for s in scores)


def test_claim_respects_kind_and_marks_running(cfg, conn, tmp_path):
    _ingest(cfg, conn, tmp_path)
    assert claim_job(conn, "analyze") is None
    job = claim_job(conn, "transcribe")
    assert job["status"] == "pending"  # snapshot taken before update
    row = conn.execute("SELECT status FROM jobs WHERE id=?", (job["id"],)).fetchone()
    assert row["status"] == "running"
    assert claim_job(conn, "transcribe") is None  # nothing left


def test_analyze_retry_then_permanent_failure(cfg, conn, tmp_path):
    call_id = _ingest(cfg, conn, tmp_path)
    process_transcribe_job(conn, cfg, claim_job(conn, "transcribe"), FakeTranscriber())
    analyzer = FakeAnalyzer(fail_times=99)

    for expected_attempts in (1, 2):
        job = conn.execute("SELECT * FROM jobs WHERE kind='analyze'").fetchone()
        conn.execute("UPDATE jobs SET next_run_at=NULL WHERE id=?", (job["id"],))
        conn.commit()
        job = claim_job(conn, "analyze")
        process_analyze_job(conn, cfg, job, analyzer)
        row = conn.execute("SELECT * FROM jobs WHERE id=?", (job["id"],)).fetchone()
        assert row["status"] == "pending"
        assert row["attempts"] == expected_attempts
        assert row["next_run_at"] is not None

    conn.execute("UPDATE jobs SET next_run_at=NULL WHERE kind='analyze'")
    conn.commit()
    job = claim_job(conn, "analyze")
    process_analyze_job(conn, cfg, job, analyzer)  # third failure -> permanent
    row = conn.execute("SELECT * FROM jobs WHERE id=?", (job["id"],)).fetchone()
    assert row["status"] == "failed"
    call = conn.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    assert call["status"] == "error"
    assert call["error_msg"]


def test_recover_stuck_jobs(cfg, conn, tmp_path):
    _ingest(cfg, conn, tmp_path)
    job = claim_job(conn, "transcribe")  # now 'running'
    recover_stuck_jobs(conn)
    row = conn.execute("SELECT status FROM jobs WHERE id=?", (job["id"],)).fetchone()
    assert row["status"] == "pending"
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_worker.py -q`
Expected: FAIL — no module `app.worker`.

- [ ] **Step 3: Implement** — `app/worker.py`:

```python
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .config import AppConfig
from .db import get_conn
from .prompts import ensure_prompt_version

MAX_ATTEMPTS = 3
BACKOFF_BASE_SEC = 30


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def claim_job(conn: sqlite3.Connection, kind: str):
    """Atomically claim the oldest runnable pending job of this kind."""
    with conn:
        row = conn.execute(
            "SELECT * FROM jobs WHERE kind=? AND status='pending'"
            " AND (next_run_at IS NULL OR next_run_at<=?)"
            " ORDER BY id LIMIT 1", (kind, _now())).fetchone()
        if row is None:
            return None
        conn.execute("UPDATE jobs SET status='running', started_at=? WHERE id=?",
                     (_now(), row["id"]))
    return row


def _fail_job(conn: sqlite3.Connection, job, err: Exception) -> None:
    attempts = job["attempts"] + 1
    if attempts < MAX_ATTEMPTS:
        next_run = (datetime.now(timezone.utc)
                    + timedelta(seconds=BACKOFF_BASE_SEC * attempts)).isoformat()
        conn.execute(
            "UPDATE jobs SET status='pending', attempts=?, error=?, next_run_at=? WHERE id=?",
            (attempts, str(err), next_run, job["id"]))
    else:
        conn.execute(
            "UPDATE jobs SET status='failed', attempts=?, error=?, finished_at=? WHERE id=?",
            (attempts, str(err), _now(), job["id"]))
        conn.execute(
            "UPDATE calls SET status='error', error_msg=? WHERE id=?",
            (str(err), job["call_id"]))
    conn.commit()


def _finish_job(conn: sqlite3.Connection, job) -> None:
    conn.execute("UPDATE jobs SET status='done', finished_at=? WHERE id=?",
                 (_now(), job["id"]))


def transcript_text(conn: sqlite3.Connection, call_id: int) -> str:
    rows = conn.execute(
        "SELECT text_original, text_corrected FROM segments"
        " WHERE call_id=? ORDER BY idx", (call_id,)).fetchall()
    return "\n".join((r["text_corrected"] or r["text_original"]) for r in rows)


def process_transcribe_job(conn, cfg: AppConfig, job, transcriber) -> None:
    call = conn.execute("SELECT * FROM calls WHERE id=?", (job["call_id"],)).fetchone()
    try:
        conn.execute("UPDATE calls SET status='transcribing', error_msg=NULL WHERE id=?",
                     (call["id"],))
        conn.commit()
        result = transcriber.transcribe(Path(call["audio_path"]))
        conn.execute("DELETE FROM segments WHERE call_id=?", (call["id"],))
        conn.executemany(
            "INSERT INTO segments(call_id, idx, start_sec, end_sec, text_original)"
            " VALUES (?,?,?,?,?)",
            [(call["id"], i, s.start, s.end, s.text)
             for i, s in enumerate(result.segments)])
        conn.execute(
            "UPDATE calls SET status='analyzing', duration_sec=?,"
            " detected_language=?, language_probability=? WHERE id=?",
            (result.duration_sec, result.language,
             result.language_probability, call["id"]))
        conn.execute(
            "INSERT INTO jobs(call_id, kind, status, created_at)"
            " VALUES (?,'analyze','pending',?)", (call["id"], _now()))
        _finish_job(conn, job)
        conn.commit()
    except Exception as e:
        conn.rollback()
        _fail_job(conn, job, e)


def process_analyze_job(conn, cfg: AppConfig, job, analyzer) -> None:
    call = conn.execute("SELECT * FROM calls WHERE id=?", (job["call_id"],)).fetchone()
    try:
        conn.execute("UPDATE calls SET status='analyzing', error_msg=NULL WHERE id=?",
                     (call["id"],))
        conn.commit()
        version = ensure_prompt_version(conn)
        criteria = [dict(r) for r in conn.execute(
            "SELECT * FROM criteria WHERE active=1 ORDER BY sort")]
        text = transcript_text(conn, call["id"])
        result = analyzer.analyze(text, call["detected_language"],
                                  call["duration_sec"], version["assembled_text"],
                                  criteria)
        import json as _json
        cur = conn.execute(
            "INSERT INTO analyses(call_id, prompt_version_id, model, booking_result,"
            " missed_booking, summary, recommendation, raw_json, created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (call["id"], version["id"], analyzer.model, result["booking_result"],
             1 if result["missed_booking"] else 0, result["summary"],
             result["recommendation"], _json.dumps(result, ensure_ascii=False), _now()))
        analysis_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO analysis_scores(analysis_id, criterion_key, ai_score, ai_reason)"
            " VALUES (?,?,?,?)",
            [(analysis_id, c["key"], int(result[c["key"]]["score"]),
              result[c["key"]]["reason"]) for c in criteria])
        conn.execute("UPDATE calls SET status='ready' WHERE id=?", (call["id"],))
        _finish_job(conn, job)
        conn.commit()
    except Exception as e:
        conn.rollback()
        _fail_job(conn, job, e)


def recover_stuck_jobs(conn: sqlite3.Connection) -> None:
    """At startup: jobs left 'running' by a crash go back to 'pending'."""
    conn.execute("UPDATE jobs SET status='pending' WHERE status='running'")
    conn.commit()


class WorkerThread(threading.Thread):
    """Polls one job kind. Owns its own DB connection and engine instance."""

    def __init__(self, kind: str, cfg: AppConfig, engine_factory):
        super().__init__(daemon=True, name=f"worker-{kind}")
        self.kind = kind
        self.cfg = cfg
        self.engine_factory = engine_factory
        self.stop_event = threading.Event()

    def run(self) -> None:
        conn = get_conn(self.cfg.db_path)
        engine = None
        try:
            while not self.stop_event.is_set():
                job = claim_job(conn, self.kind)
                if job is None:
                    self.stop_event.wait(1.0)
                    continue
                if engine is None:
                    try:
                        engine = self.engine_factory()
                    except Exception as e:
                        # e.g. missing API key / missing CUDA: fail THIS job with a
                        # clear message instead of killing the worker thread.
                        _fail_job(conn, job, e)
                        continue
                if self.kind == "transcribe":
                    process_transcribe_job(conn, self.cfg, job, engine)
                else:
                    process_analyze_job(conn, self.cfg, job, engine)
        finally:
            conn.close()

    def stop(self) -> None:
        self.stop_event.set()
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: job worker - atomic claim, pipeline processing, retry with backoff, crash recovery"
```

---

### Task 8: Watched folder

**Files:**
- Create: `app/watcher.py`, `tests/test_watcher.py`

- [ ] **Step 1: Write the failing test** — `tests/test_watcher.py`:

```python
from app.watcher import scan_incoming, wait_for_stable


def test_scan_incoming_ingests_and_removes(cfg, conn):
    (cfg.incoming_dir / "op_2026-07-03.mp3").write_bytes(b"watched-audio-1")
    (cfg.incoming_dir / "notes.txt").write_text("ignore me")  # non-audio ignored
    created = scan_incoming(conn, cfg)
    assert created == 1
    assert not (cfg.incoming_dir / "op_2026-07-03.mp3").exists()
    assert (cfg.incoming_dir / "notes.txt").exists()
    assert conn.execute("SELECT COUNT(*) c FROM calls").fetchone()["c"] == 1


def test_scan_incoming_skips_duplicates(cfg, conn):
    (cfg.incoming_dir / "a.mp3").write_bytes(b"same")
    scan_incoming(conn, cfg)
    (cfg.incoming_dir / "b.mp3").write_bytes(b"same")
    created = scan_incoming(conn, cfg)
    assert created == 0
    assert not (cfg.incoming_dir / "b.mp3").exists()  # duplicate source cleaned up
    assert conn.execute("SELECT COUNT(*) c FROM calls").fetchone()["c"] == 1


def test_wait_for_stable_returns_true_when_size_settles(cfg):
    p = cfg.incoming_dir / "x.mp3"
    p.write_bytes(b"full-content")
    assert wait_for_stable(p, checks=2, interval=0.01) is True


def test_wait_for_stable_false_when_file_vanishes(cfg):
    p = cfg.incoming_dir / "gone.mp3"
    assert wait_for_stable(p, checks=2, interval=0.01) is False
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_watcher.py -q`
Expected: FAIL — no module `app.watcher`.

- [ ] **Step 3: Implement** — `app/watcher.py`:

```python
import sqlite3
import time
from pathlib import Path

from .config import AUDIO_EXTS, AppConfig
from .db import get_conn
from .ingest import ingest_file


def wait_for_stable(path: Path, checks: int = 3, interval: float = 1.0) -> bool:
    """True once the file size stops changing (finished copying); False if it vanishes."""
    last = -1
    stable = 0
    while stable < checks:
        try:
            size = path.stat().st_size
        except OSError:
            return False
        if size == last and size > 0:
            stable += 1
        else:
            stable = 0
            last = size
        time.sleep(interval)
    return True


def scan_incoming(conn: sqlite3.Connection, cfg: AppConfig) -> int:
    """Ingest every audio file currently in incoming/. Returns number of NEW calls."""
    created = 0
    for p in sorted(cfg.incoming_dir.iterdir()):
        if not p.is_file() or p.suffix.lower() not in AUDIO_EXTS:
            continue
        result = ingest_file(conn, cfg, p, source="watch", delete_source=True)
        if result["status"] == "created":
            created += 1
    return created


def start_watcher(cfg: AppConfig):
    """Watchdog observer: on new audio file, wait until stable, then ingest.
    Returns the started observer (call .stop() on shutdown)."""
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    class Handler(FileSystemEventHandler):
        def on_created(self, event):
            if event.is_directory:
                return
            p = Path(event.src_path)
            if p.suffix.lower() not in AUDIO_EXTS:
                return
            if not wait_for_stable(p):
                return
            conn = get_conn(cfg.db_path)
            try:
                ingest_file(conn, cfg, p, source="watch", delete_source=True)
            finally:
                conn.close()

    observer = Observer(timeout=1)
    observer.schedule(Handler(), str(cfg.incoming_dir), recursive=False)
    observer.daemon = True
    observer.start()
    return observer
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass (the watchdog observer itself is exercised at runtime, not in gates — `scan_incoming` covers the ingest path).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: watched incoming folder - startup scan + watchdog handler with stable-size wait"
```

---

### Task 9: FastAPI app factory + calls API

**Files:**
- Create: `app/main.py`, `app/routes/calls.py`, `tests/test_api_calls.py`
- Modify: `tests/conftest.py` (add `client` fixture)

- [ ] **Step 1: Write the failing test** — append to `tests/conftest.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(cfg):
    app = create_app(cfg, start_workers=False, start_watcher=False)
    with TestClient(app) as c:
        yield c
```

`tests/test_api_calls.py`:

```python
import io


def _upload(client, name="op_2026-07-01.mp3", content=b"audio-1"):
    return client.post("/api/calls/upload",
                       files=[("files", (name, io.BytesIO(content), "audio/mpeg"))])


def test_upload_and_duplicate(client):
    r = _upload(client)
    assert r.status_code == 200
    body = r.json()["results"]
    assert body[0]["status"] == "created"

    r2 = _upload(client, name="renamed.mp3")  # same bytes
    assert r2.json()["results"][0]["status"] == "duplicate"


def test_list_and_filters(client):
    _upload(client, "a_2026-07-01.mp3", b"one")
    _upload(client, "b_2026-07-02.mp3", b"two")
    r = client.get("/api/calls")
    assert r.status_code == 200
    assert r.json()["total"] == 2
    r = client.get("/api/calls", params={"status": "queued", "date_from": "2026-07-02"})
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["original_filename"] == "b_2026-07-02.mp3"


def test_detail_includes_segments_and_analysis_placeholders(client):
    call_id = _upload(client).json()["results"][0]["call_id"]
    r = client.get(f"/api/calls/{call_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["call"]["status"] == "queued"
    assert body["segments"] == []
    assert body["analysis"] is None
    assert body["review"] is None
    assert client.get("/api/calls/99999").status_code == 404


def test_audio_served(client):
    call_id = _upload(client, content=b"mp3-bytes-here").json()["results"][0]["call_id"]
    r = client.get(f"/api/calls/{call_id}/audio")
    assert r.status_code == 200
    assert r.content == b"mp3-bytes-here"


def test_patch_operator_assignment(client):
    call_id = _upload(client).json()["results"][0]["call_id"]
    op = client.post("/api/operators", json={"name": "Дильноза"}).json()
    r = client.patch(f"/api/calls/{call_id}", json={"operator_id": op["id"]})
    assert r.status_code == 200
    assert r.json()["operator_id"] == op["id"]


def test_retry_only_from_error(client):
    call_id = _upload(client).json()["results"][0]["call_id"]
    assert client.post(f"/api/calls/{call_id}/retry").status_code == 409
```

Note: `test_patch_operator_assignment` uses `POST /api/operators`, implemented fully in Task 12 — add the minimal operators router in this task (create + list only) so this test passes; Task 12 extends it.

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_api_calls.py -q`
Expected: FAIL — no module `app.main`.

- [ ] **Step 3: Implement** — `app/main.py`:

```python
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import AppConfig
from .db import get_conn, init_db


def get_db(request: Request):
    conn = get_conn(request.app.state.cfg.db_path)
    try:
        yield conn
    finally:
        conn.close()


def create_app(cfg: AppConfig, transcriber_factory=None, analyzer_factory=None,
               tts_engine=None, start_workers: bool = True,
               start_watcher: bool = True) -> FastAPI:
    from .analyzer import ClaudeAnalyzer
    from .transcriber import FasterWhisperTranscriber
    from .watcher import scan_incoming, start_watcher as _start_watcher
    from .worker import WorkerThread, recover_stuck_jobs

    cfg.ensure_dirs()

    settings = cfg.load_settings()
    transcriber_factory = transcriber_factory or (
        lambda: FasterWhisperTranscriber(settings["whisper_model"],
                                         settings["whisper_device"]))
    analyzer_factory = analyzer_factory or (lambda: ClaudeAnalyzer(cfg))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        conn = get_conn(cfg.db_path)
        init_db(conn)
        recover_stuck_jobs(conn)
        if start_watcher and cfg.load_settings()["watch_enabled"]:
            scan_incoming(conn, cfg)
        conn.close()

        workers, observer = [], None
        if start_workers:
            workers = [WorkerThread("transcribe", cfg, transcriber_factory),
                       WorkerThread("analyze", cfg, analyzer_factory)]
            for w in workers:
                w.start()
        if start_watcher and cfg.load_settings()["watch_enabled"]:
            observer = _start_watcher(cfg)
        yield
        for w in workers:
            w.stop()
        if observer:
            observer.stop()

    app = FastAPI(title="Call-Center QA", lifespan=lifespan)
    app.state.cfg = cfg
    app.state.tts_engine = tts_engine  # None -> edge-tts default (Task 13)

    from .routes import calls, operators
    app.include_router(calls.router, prefix="/api")
    app.include_router(operators.router, prefix="/api")

    if (cfg.static_dir / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(cfg.static_dir), html=True),
                  name="static")
    else:
        @app.get("/", response_class=HTMLResponse)
        def index():
            return ("<html><body style='font-family:sans-serif'>"
                    "<h2>Call-Center QA — сервер работает</h2>"
                    "<p>Интерфейс появится после установки (План 2). "
                    "API-документация: <a href='/docs'>/docs</a></p></body></html>")

    return app
```

`app/routes/calls.py`:

```python
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from ..ingest import ingest_file
from ..main import get_db

router = APIRouter(tags=["calls"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/calls/upload")
async def upload_calls(request: Request, files: list[UploadFile] = File(...),
                       db=Depends(get_db)):
    cfg = request.app.state.cfg
    results = []
    for f in files:
        tmp = cfg.tmp_dir / f"upload-{_now().replace(':', '')}-{f.filename}"
        tmp.write_bytes(await f.read())
        try:
            r = ingest_file(db, cfg, tmp, original_name=f.filename,
                            source="upload", delete_source=True)
        finally:
            tmp.unlink(missing_ok=True)
        results.append({"filename": f.filename, **r})
    return {"results": results}


LATEST_ANALYSIS = ("SELECT * FROM analyses WHERE call_id=? "
                   "ORDER BY id DESC LIMIT 1")


def _call_row(db, call_id: int):
    row = db.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "звонок не найден")
    return row


@router.get("/calls")
def list_calls(db=Depends(get_db), status: str | None = None,
               operator_id: int | None = None, date_from: str | None = None,
               date_to: str | None = None, booking_result: str | None = None,
               missed_booking: bool | None = None,
               limit: int = 100, offset: int = 0):
    where, params = ["1=1"], []
    if status:
        where.append("c.status=?"); params.append(status)
    if operator_id:
        where.append("c.operator_id=?"); params.append(operator_id)
    if date_from:
        where.append("c.call_date>=?"); params.append(date_from)
    if date_to:
        where.append("c.call_date<=?"); params.append(date_to)
    if booking_result:
        where.append("a.booking_result=?"); params.append(booking_result)
    if missed_booking is not None:
        where.append("a.missed_booking=?"); params.append(1 if missed_booking else 0)
    base = (
        "FROM calls c"
        " LEFT JOIN operators o ON o.id=c.operator_id"
        " LEFT JOIN analyses a ON a.call_id=c.id AND a.id="
        "  (SELECT MAX(id) FROM analyses WHERE call_id=c.id)"
        f" WHERE {' AND '.join(where)}")
    total = db.execute(f"SELECT COUNT(*) c {base}", params).fetchone()["c"]
    rows = db.execute(
        "SELECT c.*, o.name AS operator_name, a.booking_result, a.missed_booking,"
        " (SELECT SUM(COALESCE(s.reviewer_score, s.ai_score))"
        "  FROM analysis_scores s WHERE s.analysis_id=a.id) AS total_score "
        f"{base} ORDER BY c.id DESC LIMIT ? OFFSET ?",
        params + [limit, offset]).fetchall()
    return {"total": total, "items": [dict(r) for r in rows]}


@router.get("/calls/{call_id}")
def call_detail(call_id: int, db=Depends(get_db)):
    call = _call_row(db, call_id)
    segments = [dict(r) for r in db.execute(
        "SELECT * FROM segments WHERE call_id=? ORDER BY idx", (call_id,))]
    analysis_row = db.execute(LATEST_ANALYSIS, (call_id,)).fetchone()
    analysis = None
    if analysis_row:
        scores = [dict(r) for r in db.execute(
            "SELECT * FROM analysis_scores WHERE analysis_id=?",
            (analysis_row["id"],))]
        analysis = {**dict(analysis_row), "scores": scores}
    review = db.execute("SELECT * FROM reviews WHERE call_id=?",
                        (call_id,)).fetchone()
    return {"call": dict(call), "segments": segments,
            "analysis": analysis, "review": dict(review) if review else None}


@router.get("/calls/{call_id}/audio")
def call_audio(call_id: int, db=Depends(get_db)):
    call = _call_row(db, call_id)
    path = Path(call["audio_path"])
    if not path.exists():
        raise HTTPException(404, "аудиофайл не найден на диске")
    return FileResponse(path)


@router.patch("/calls/{call_id}")
def patch_call(call_id: int, body: dict, db=Depends(get_db)):
    _call_row(db, call_id)
    allowed = {k: body[k] for k in ("operator_id", "call_date") if k in body}
    if allowed:
        sets = ", ".join(f"{k}=?" for k in allowed)
        db.execute(f"UPDATE calls SET {sets} WHERE id=?",
                   [*allowed.values(), call_id])
        db.commit()
    return dict(_call_row(db, call_id))


@router.post("/calls/{call_id}/retry")
def retry_call(call_id: int, db=Depends(get_db)):
    call = _call_row(db, call_id)
    if call["status"] != "error":
        raise HTTPException(409, "повторить можно только звонок со статусом «ошибка»")
    job = db.execute(
        "SELECT * FROM jobs WHERE call_id=? AND status='failed'"
        " ORDER BY id DESC LIMIT 1", (call_id,)).fetchone()
    if job is None:
        raise HTTPException(409, "нет неудачной задачи для повтора")
    db.execute("UPDATE jobs SET status='pending', attempts=0, error=NULL,"
               " next_run_at=NULL WHERE id=?", (job["id"],))
    new_status = "queued" if job["kind"] == "transcribe" else "analyzing"
    db.execute("UPDATE calls SET status=?, error_msg=NULL WHERE id=?",
               (new_status, call_id))
    db.commit()
    return {"ok": True, "kind": job["kind"]}
```

`app/routes/operators.py` (minimal in this task; Task 12 extends it):

```python
from fastapi import APIRouter, Depends, HTTPException

from ..main import get_db

router = APIRouter(tags=["operators"])


@router.get("/operators")
def list_operators(db=Depends(get_db)):
    return [dict(r) for r in db.execute(
        "SELECT * FROM operators WHERE active=1 ORDER BY name")]


@router.post("/operators")
def create_operator(body: dict, db=Depends(get_db)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "имя оператора обязательно")
    cur = db.execute(
        "INSERT INTO operators(name, filename_alias) VALUES (?,?)",
        (name, body.get("filename_alias")))
    db.commit()
    return dict(db.execute("SELECT * FROM operators WHERE id=?",
                           (cur.lastrowid,)).fetchone())
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: FastAPI app factory + calls API (upload, list/filters, detail, audio, retry)"
```

---

### Task 10: Review API — segment edit, score override, review, rescore

**Files:**
- Create: `app/routes/review.py`, `tests/test_api_review.py`
- Modify: `app/main.py` (include router)

- [ ] **Step 1: Write the failing test** — `tests/test_api_review.py`:

```python
import io

from app.analyzer import FakeAnalyzer
from app.db import get_conn
from app.transcriber import FakeTranscriber
from app.worker import claim_job, process_analyze_job, process_transcribe_job


def _ready_call(client, cfg, content=b"call-bytes"):
    """Upload + run the pipeline with fakes so the call reaches 'ready'."""
    r = client.post("/api/calls/upload",
                    files=[("files", ("op_2026-07-01.mp3", io.BytesIO(content),
                                      "audio/mpeg"))])
    call_id = r.json()["results"][0]["call_id"]
    conn = get_conn(cfg.db_path)
    process_transcribe_job(conn, cfg, claim_job(conn, "transcribe"), FakeTranscriber())
    process_analyze_job(conn, cfg, claim_job(conn, "analyze"), FakeAnalyzer())
    conn.close()
    return call_id


def test_edit_segment_keeps_original(client, cfg):
    call_id = _ready_call(client, cfg)
    seg = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    r = client.patch(f"/api/segments/{seg['id']}",
                     json={"text_corrected": "Здравствуйте, клиника Аврора!"})
    assert r.status_code == 200
    updated = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    assert updated["text_corrected"] == "Здравствуйте, клиника Аврора!"
    assert updated["text_original"] == seg["text_original"]
    assert updated["edited_at"]
    # clearing the correction reverts to original
    client.patch(f"/api/segments/{seg['id']}", json={"text_corrected": None})
    reverted = client.get(f"/api/calls/{call_id}").json()["segments"][0]
    assert reverted["text_corrected"] is None


def test_score_override_stored_separately(client, cfg):
    call_id = _ready_call(client, cfg)
    r = client.put(f"/api/calls/{call_id}/scores/greeting",
                   json={"reviewer_score": 0})
    assert r.status_code == 200
    scores = {s["criterion_key"]: s for s in
              client.get(f"/api/calls/{call_id}").json()["analysis"]["scores"]}
    assert scores["greeting"]["reviewer_score"] == 0
    assert scores["greeting"]["ai_score"] == 2  # AI score untouched
    assert client.put(f"/api/calls/{call_id}/scores/greeting",
                      json={"reviewer_score": 5}).status_code == 422
    assert client.put(f"/api/calls/{call_id}/scores/nonexistent",
                      json={"reviewer_score": 1}).status_code == 404


def test_mark_reviewed(client, cfg):
    call_id = _ready_call(client, cfg)
    r = client.put(f"/api/calls/{call_id}/review",
                   json={"comment": "Хороший звонок", "reviewed": True})
    assert r.status_code == 200
    body = client.get(f"/api/calls/{call_id}").json()
    assert body["call"]["status"] == "reviewed"
    assert body["review"]["comment"] == "Хороший звонок"


def test_rescore_creates_new_analysis_job(client, cfg):
    call_id = _ready_call(client, cfg)
    r = client.post(f"/api/calls/{call_id}/rescore")
    assert r.status_code == 200
    conn = get_conn(cfg.db_path)
    jobs = conn.execute(
        "SELECT * FROM jobs WHERE call_id=? AND kind='analyze' AND status='pending'",
        (call_id,)).fetchall()
    assert len(jobs) == 1
    # run it: history keeps BOTH analyses
    process_analyze_job(conn, cfg, claim_job(conn, "analyze"), FakeAnalyzer())
    count = conn.execute("SELECT COUNT(*) c FROM analyses WHERE call_id=?",
                         (call_id,)).fetchone()["c"]
    conn.close()
    assert count == 2
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_api_review.py -q`
Expected: FAIL — 404s (routes don't exist yet).

- [ ] **Step 3: Implement** — `app/routes/review.py`:

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..main import get_db

router = APIRouter(tags=["review"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.patch("/segments/{segment_id}")
def edit_segment(segment_id: int, body: dict, db=Depends(get_db)):
    seg = db.execute("SELECT * FROM segments WHERE id=?", (segment_id,)).fetchone()
    if seg is None:
        raise HTTPException(404, "строка транскрипта не найдена")
    if "text_corrected" not in body:
        raise HTTPException(422, "text_corrected обязателен")
    corrected = body["text_corrected"]
    db.execute("UPDATE segments SET text_corrected=?, edited_at=? WHERE id=?",
               (corrected, _now() if corrected is not None else None, segment_id))
    db.commit()
    return dict(db.execute("SELECT * FROM segments WHERE id=?",
                           (segment_id,)).fetchone())


def _latest_analysis(db, call_id: int):
    row = db.execute("SELECT * FROM analyses WHERE call_id=?"
                     " ORDER BY id DESC LIMIT 1", (call_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "звонок ещё не проанализирован")
    return row


@router.put("/calls/{call_id}/scores/{criterion_key}")
def override_score(call_id: int, criterion_key: str, body: dict, db=Depends(get_db)):
    score = body.get("reviewer_score")
    if score is not None and score not in (0, 1, 2):
        raise HTTPException(422, "оценка должна быть 0, 1 или 2 (или null для сброса)")
    analysis = _latest_analysis(db, call_id)
    row = db.execute(
        "SELECT id FROM analysis_scores WHERE analysis_id=? AND criterion_key=?",
        (analysis["id"], criterion_key)).fetchone()
    if row is None:
        raise HTTPException(404, "критерий не найден в этом анализе")
    db.execute("UPDATE analysis_scores SET reviewer_score=? WHERE id=?",
               (score, row["id"]))
    db.commit()
    return {"ok": True}


@router.put("/calls/{call_id}/review")
def set_review(call_id: int, body: dict, db=Depends(get_db)):
    call = db.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    if call is None:
        raise HTTPException(404, "звонок не найден")
    db.execute(
        "INSERT INTO reviews(call_id, comment, reviewed_at) VALUES (?,?,?)"
        " ON CONFLICT(call_id) DO UPDATE SET comment=excluded.comment,"
        " reviewed_at=excluded.reviewed_at",
        (call_id, body.get("comment"), _now()))
    if body.get("reviewed") and call["status"] in ("ready", "reviewed"):
        db.execute("UPDATE calls SET status='reviewed' WHERE id=?", (call_id,))
    db.commit()
    return dict(db.execute("SELECT * FROM reviews WHERE call_id=?",
                           (call_id,)).fetchone())


@router.post("/calls/{call_id}/rescore")
def rescore(call_id: int, db=Depends(get_db)):
    call = db.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    if call is None:
        raise HTTPException(404, "звонок не найден")
    if call["status"] not in ("ready", "reviewed"):
        raise HTTPException(409, "переоценка доступна после завершения анализа")
    db.execute("INSERT INTO jobs(call_id, kind, status, created_at)"
               " VALUES (?,'analyze','pending',?)", (call_id, _now()))
    db.execute("UPDATE calls SET status='analyzing' WHERE id=?", (call_id,))
    db.commit()
    return {"ok": True}
```

Add to `app/main.py` after the existing router includes:

```python
    from .routes import review
    app.include_router(review.router, prefix="/api")
```

(Add the import alongside the existing `from .routes import calls, operators` line: `from .routes import calls, operators, review`.)

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: review API - transcript fixes with preserved originals, score overrides, mark-reviewed, rescore"
```

---

### Task 11: Scorecard API — criteria, examples, prompt preview

**Files:**
- Create: `app/routes/scorecard.py`, `tests/test_api_scorecard.py`
- Modify: `app/main.py` (include router)

- [ ] **Step 1: Write the failing test** — `tests/test_api_scorecard.py`:

```python
def test_criteria_list_and_patch(client):
    r = client.get("/api/criteria")
    assert r.status_code == 200
    crits = r.json()
    assert len(crits) == 6
    cid = crits[0]["id"]
    r2 = client.patch(f"/api/criteria/{cid}",
                      json={"description_ru": "Новое описание", "active": False})
    assert r2.status_code == 200
    assert r2.json()["description_ru"] == "Новое описание"
    assert r2.json()["active"] == 0


def test_examples_crud(client):
    crits = client.get("/api/criteria").json()
    r = client.post("/api/examples", json={
        "criterion_id": crits[0]["id"], "kind": "good",
        "phrase": "Клиника Аврора, здравствуйте!", "note": "эталон"})
    assert r.status_code == 200
    ex_id = r.json()["id"]
    listed = client.get("/api/examples",
                        params={"criterion_id": crits[0]["id"]}).json()
    assert any(e["id"] == ex_id for e in listed)
    assert client.post("/api/examples", json={
        "criterion_id": crits[0]["id"], "kind": "meh", "phrase": "x"
    }).status_code == 422
    assert client.delete(f"/api/examples/{ex_id}").status_code == 200
    listed2 = client.get("/api/examples",
                         params={"criterion_id": crits[0]["id"]}).json()
    assert not any(e["id"] == ex_id for e in listed2)  # soft-deleted


def test_prompt_preview_shows_current_and_versions(client):
    r = client.get("/api/scorecard/prompt")
    assert r.status_code == 200
    body = r.json()
    assert "Критерии:" in body["current_text"]
    v1 = body["version_id"]
    crits = client.get("/api/criteria").json()
    client.post("/api/examples", json={
        "criterion_id": crits[1]["id"], "kind": "bad", "phrase": "Не знаю."})
    body2 = client.get("/api/scorecard/prompt").json()
    assert body2["version_id"] != v1
    assert len(body2["versions"]) == 2
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_api_scorecard.py -q`
Expected: FAIL — 404s.

- [ ] **Step 3: Implement** — `app/routes/scorecard.py`:

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..main import get_db
from ..prompts import ensure_prompt_version

router = APIRouter(tags=["scorecard"])


@router.get("/criteria")
def list_criteria(db=Depends(get_db)):
    return [dict(r) for r in db.execute("SELECT * FROM criteria ORDER BY sort")]


@router.patch("/criteria/{criterion_id}")
def patch_criterion(criterion_id: int, body: dict, db=Depends(get_db)):
    row = db.execute("SELECT * FROM criteria WHERE id=?", (criterion_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "критерий не найден")
    allowed = {}
    for k in ("label_ru", "description_ru", "sort"):
        if k in body:
            allowed[k] = body[k]
    if "active" in body:
        allowed["active"] = 1 if body["active"] else 0
    if allowed:
        sets = ", ".join(f"{k}=?" for k in allowed)
        db.execute(f"UPDATE criteria SET {sets} WHERE id=?",
                   [*allowed.values(), criterion_id])
        db.commit()
    return dict(db.execute("SELECT * FROM criteria WHERE id=?",
                           (criterion_id,)).fetchone())


@router.post("/examples")
def create_example(body: dict, db=Depends(get_db)):
    if body.get("kind") not in ("good", "bad"):
        raise HTTPException(422, "kind должен быть 'good' или 'bad'")
    if not body.get("phrase") or not body.get("criterion_id"):
        raise HTTPException(422, "criterion_id и phrase обязательны")
    crit = db.execute("SELECT id FROM criteria WHERE id=?",
                      (body["criterion_id"],)).fetchone()
    if crit is None:
        raise HTTPException(404, "критерий не найден")
    cur = db.execute(
        "INSERT INTO examples(criterion_id, kind, phrase, note, call_id,"
        " segment_id, created_at) VALUES (?,?,?,?,?,?,?)",
        (body["criterion_id"], body["kind"], body["phrase"], body.get("note"),
         body.get("call_id"), body.get("segment_id"),
         datetime.now(timezone.utc).isoformat()))
    db.commit()
    return dict(db.execute("SELECT * FROM examples WHERE id=?",
                           (cur.lastrowid,)).fetchone())


@router.get("/examples")
def list_examples(db=Depends(get_db), criterion_id: int | None = None):
    q = ("SELECT e.*, c.key AS criterion_key, c.label_ru AS criterion_label"
         " FROM examples e JOIN criteria c ON c.id=e.criterion_id WHERE e.active=1")
    params: list = []
    if criterion_id:
        q += " AND e.criterion_id=?"
        params.append(criterion_id)
    return [dict(r) for r in db.execute(q + " ORDER BY e.id DESC", params)]


@router.delete("/examples/{example_id}")
def delete_example(example_id: int, db=Depends(get_db)):
    row = db.execute("SELECT id FROM examples WHERE id=?", (example_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "пример не найден")
    db.execute("UPDATE examples SET active=0 WHERE id=?", (example_id,))
    db.commit()
    return {"ok": True}


@router.get("/scorecard/prompt")
def prompt_preview(db=Depends(get_db)):
    version = ensure_prompt_version(db)
    versions = [dict(r) for r in db.execute(
        "SELECT id, hash, created_at FROM prompt_versions ORDER BY id DESC")]
    return {"version_id": version["id"], "current_text": version["assembled_text"],
            "versions": versions}
```

Add to `app/main.py`: extend the routes import to `from .routes import calls, operators, review, scorecard` and add `app.include_router(scorecard.router, prefix="/api")`.

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: scorecard API - criteria editing, teaching examples CRUD, prompt preview + versions"
```

---

### Task 12: Operators + coaching + dashboard API

**Files:**
- Create: `tests/test_api_operators.py`
- Modify: `app/routes/operators.py` (extend), `app/main.py` (no change needed — router already included)

- [ ] **Step 1: Write the failing test** — `tests/test_api_operators.py`:

```python
import io

from app.analyzer import FakeAnalyzer
from app.db import get_conn
from app.transcriber import FakeTranscriber
from app.worker import claim_job, process_analyze_job, process_transcribe_job


def _ready_call(client, cfg, name, content):
    r = client.post("/api/calls/upload",
                    files=[("files", (name, io.BytesIO(content), "audio/mpeg"))])
    call_id = r.json()["results"][0]["call_id"]
    conn = get_conn(cfg.db_path)
    process_transcribe_job(conn, cfg, claim_job(conn, "transcribe"), FakeTranscriber())
    process_analyze_job(conn, cfg, claim_job(conn, "analyze"), FakeAnalyzer())
    conn.close()
    return call_id


def test_operator_patch_and_deactivate(client):
    op = client.post("/api/operators",
                     json={"name": "Азиз", "filename_alias": "aziz"}).json()
    r = client.patch(f"/api/operators/{op['id']}", json={"name": "Азиз Каримов"})
    assert r.json()["name"] == "Азиз Каримов"
    client.patch(f"/api/operators/{op['id']}", json={"active": False})
    assert all(o["id"] != op["id"] for o in client.get("/api/operators").json())


def test_coaching_lifecycle(client, cfg):
    op = client.post("/api/operators", json={"name": "Дильноза"}).json()
    call_id = _ready_call(client, cfg, "dilnoza_2026-07-01.mp3", b"c1")
    r = client.post("/api/coaching", json={
        "call_id": call_id, "operator_id": op["id"],
        "note": "Послушай с 1:32 — не предложила запись."})
    assert r.status_code == 200
    item = r.json()
    assert item["status"] == "open"
    listed = client.get("/api/coaching", params={"operator_id": op["id"],
                                                 "status": "open"}).json()
    assert len(listed) == 1
    r2 = client.post(f"/api/coaching/{item['id']}/resolve")
    assert r2.json()["status"] == "resolved"
    assert client.get("/api/coaching",
                      params={"status": "open"}).json() == []


def test_operator_stats(client, cfg):
    op = client.post("/api/operators",
                     json={"name": "Дильноза", "filename_alias": "dilnoza"}).json()
    _ready_call(client, cfg, "dilnoza_2026-07-01.mp3", b"s1")
    _ready_call(client, cfg, "dilnoza_2026-07-02.mp3", b"s2")
    r = client.get(f"/api/operators/{op['id']}/stats")
    assert r.status_code == 200
    stats = r.json()
    assert stats["calls_total"] == 2
    assert stats["avg_total"] == 12.0  # FakeAnalyzer scores 2 on all 6 criteria
    assert stats["open_coaching"] == 0
    assert len(stats["by_criterion"]) == 6


def test_dashboard(client, cfg):
    _ready_call(client, cfg, "x_2026-07-01.mp3", b"d1")
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert body["by_status"].get("ready") == 1
    assert body["avg_total"] == 12.0
    assert body["missed_bookings"] == 0
    assert body["calls_total"] == 1
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_api_operators.py -q`
Expected: FAIL — 404/405 on the new endpoints.

- [ ] **Step 3: Implement** — replace `app/routes/operators.py` with:

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..main import get_db

router = APIRouter(tags=["operators"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _operator(db, operator_id: int):
    row = db.execute("SELECT * FROM operators WHERE id=?", (operator_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "оператор не найден")
    return row


@router.get("/operators")
def list_operators(db=Depends(get_db)):
    return [dict(r) for r in db.execute(
        "SELECT * FROM operators WHERE active=1 ORDER BY name")]


@router.post("/operators")
def create_operator(body: dict, db=Depends(get_db)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "имя оператора обязательно")
    cur = db.execute(
        "INSERT INTO operators(name, filename_alias) VALUES (?,?)",
        (name, body.get("filename_alias")))
    db.commit()
    return dict(db.execute("SELECT * FROM operators WHERE id=?",
                           (cur.lastrowid,)).fetchone())


@router.patch("/operators/{operator_id}")
def patch_operator(operator_id: int, body: dict, db=Depends(get_db)):
    _operator(db, operator_id)
    allowed = {}
    for k in ("name", "filename_alias"):
        if k in body:
            allowed[k] = body[k]
    if "active" in body:
        allowed["active"] = 1 if body["active"] else 0
    if allowed:
        sets = ", ".join(f"{k}=?" for k in allowed)
        db.execute(f"UPDATE operators SET {sets} WHERE id=?",
                   [*allowed.values(), operator_id])
        db.commit()
    return dict(_operator(db, operator_id))


EFFECTIVE_SCORE = "COALESCE(s.reviewer_score, s.ai_score)"


@router.get("/operators/{operator_id}/stats")
def operator_stats(operator_id: int, db=Depends(get_db)):
    _operator(db, operator_id)
    latest = ("a.id=(SELECT MAX(id) FROM analyses WHERE call_id=c.id)")
    calls_total = db.execute(
        "SELECT COUNT(*) c FROM calls c WHERE c.operator_id=?",
        (operator_id,)).fetchone()["c"]
    avg_total = db.execute(
        f"SELECT AVG(t.total) v FROM (SELECT SUM({EFFECTIVE_SCORE}) total"
        " FROM calls c JOIN analyses a ON a.call_id=c.id"
        " JOIN analysis_scores s ON s.analysis_id=a.id"
        f" WHERE c.operator_id=? AND {latest} GROUP BY c.id) t",
        (operator_id,)).fetchone()["v"]
    by_criterion = [dict(r) for r in db.execute(
        f"SELECT s.criterion_key, ROUND(AVG({EFFECTIVE_SCORE}), 2) avg_score,"
        " COUNT(*) n FROM calls c JOIN analyses a ON a.call_id=c.id"
        " JOIN analysis_scores s ON s.analysis_id=a.id"
        f" WHERE c.operator_id=? AND {latest}"
        " GROUP BY s.criterion_key ORDER BY avg_score",
        (operator_id,))]
    weekly_sql = (
        "SELECT strftime('%Y-%W', c.call_date) week, ROUND(AVG(t.total),1) avg_total,"
        " COUNT(*) n FROM (SELECT c2.id cid, SUM(" + EFFECTIVE_SCORE + ") total"
        " FROM calls c2 JOIN analyses a ON a.call_id=c2.id"
        " JOIN analysis_scores s ON s.analysis_id=a.id"
        " WHERE c2.operator_id=:op"
        "  AND a.id=(SELECT MAX(id) FROM analyses WHERE call_id=c2.id)"
        " GROUP BY c2.id) t JOIN calls c ON c.id=t.cid"
        " GROUP BY week ORDER BY week")
    weekly = [dict(r) for r in db.execute(weekly_sql, {"op": operator_id})]
    open_coaching = db.execute(
        "SELECT COUNT(*) c FROM coaching WHERE operator_id=? AND status='open'",
        (operator_id,)).fetchone()["c"]
    missed = db.execute(
        "SELECT COUNT(*) c FROM calls c JOIN analyses a ON a.call_id=c.id"
        f" WHERE c.operator_id=? AND {latest} AND a.missed_booking=1",
        (operator_id,)).fetchone()["c"]
    return {"calls_total": calls_total,
            "avg_total": round(avg_total, 2) if avg_total is not None else None,
            "by_criterion": by_criterion, "weekly": weekly,
            "open_coaching": open_coaching, "missed_bookings": missed}


@router.post("/coaching")
def create_coaching(body: dict, db=Depends(get_db)):
    for field in ("call_id", "operator_id", "note"):
        if not body.get(field):
            raise HTTPException(422, f"{field} обязателен")
    _operator(db, body["operator_id"])
    if db.execute("SELECT id FROM calls WHERE id=?",
                  (body["call_id"],)).fetchone() is None:
        raise HTTPException(404, "звонок не найден")
    cur = db.execute(
        "INSERT INTO coaching(call_id, operator_id, note, script_id, created_at)"
        " VALUES (?,?,?,?,?)",
        (body["call_id"], body["operator_id"], body["note"],
         body.get("script_id"), _now()))
    db.commit()
    return dict(db.execute("SELECT * FROM coaching WHERE id=?",
                           (cur.lastrowid,)).fetchone())


@router.get("/coaching")
def list_coaching(db=Depends(get_db), operator_id: int | None = None,
                  status: str | None = None):
    q = ("SELECT co.*, o.name AS operator_name, c.original_filename"
         " FROM coaching co JOIN operators o ON o.id=co.operator_id"
         " JOIN calls c ON c.id=co.call_id WHERE 1=1")
    params: list = []
    if operator_id:
        q += " AND co.operator_id=?"
        params.append(operator_id)
    if status:
        q += " AND co.status=?"
        params.append(status)
    return [dict(r) for r in db.execute(q + " ORDER BY co.id DESC", params)]


@router.post("/coaching/{item_id}/resolve")
def resolve_coaching(item_id: int, db=Depends(get_db)):
    row = db.execute("SELECT * FROM coaching WHERE id=?", (item_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "запись коучинга не найдена")
    db.execute("UPDATE coaching SET status='resolved', resolved_at=? WHERE id=?",
               (_now(), item_id))
    db.commit()
    return dict(db.execute("SELECT * FROM coaching WHERE id=?",
                           (item_id,)).fetchone())


@router.get("/dashboard")
def dashboard(db=Depends(get_db), date_from: str | None = None,
              date_to: str | None = None):
    where, params = ["1=1"], []
    if date_from:
        where.append("c.call_date>=?"); params.append(date_from)
    if date_to:
        where.append("c.call_date<=?"); params.append(date_to)
    w = " AND ".join(where)
    latest = "a.id=(SELECT MAX(id) FROM analyses WHERE call_id=c.id)"
    by_status = {r["status"]: r["n"] for r in db.execute(
        f"SELECT status, COUNT(*) n FROM calls c WHERE {w} GROUP BY status", params)}
    calls_total = sum(by_status.values())
    avg_total = db.execute(
        f"SELECT AVG(t.total) v FROM (SELECT SUM({EFFECTIVE_SCORE}) total"
        " FROM calls c JOIN analyses a ON a.call_id=c.id"
        " JOIN analysis_scores s ON s.analysis_id=a.id"
        f" WHERE {w} AND {latest} GROUP BY c.id) t", params).fetchone()["v"]
    missed = db.execute(
        "SELECT COUNT(*) n FROM calls c JOIN analyses a ON a.call_id=c.id"
        f" WHERE {w} AND {latest} AND a.missed_booking=1", params).fetchone()["n"]
    failed_jobs = db.execute(
        "SELECT COUNT(*) n FROM jobs WHERE status='failed'").fetchone()["n"]
    return {"calls_total": calls_total, "by_status": by_status,
            "avg_total": round(avg_total, 2) if avg_total is not None else None,
            "missed_bookings": missed, "failed_jobs": failed_jobs}
```

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: operators CRUD + stats, coaching lifecycle, dashboard aggregates"
```

---

### Task 13: TTS + scripts + settings + backup API

**Files:**
- Create: `app/tts.py`, `app/routes/misc.py`, `tests/test_api_misc.py`
- Modify: `app/main.py` (include router)

- [ ] **Step 1: Write the failing test** — `tests/test_api_misc.py`:

```python
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.tts import VOICES


@pytest.fixture
def client(cfg):
    """Client with a fake TTS engine — gates never hit the network."""
    def fake_engine(text: str, voice_id: str, out_path: Path) -> None:
        out_path.write_bytes(b"ID3-fake-mp3:" + voice_id.encode())

    app = create_app(cfg, tts_engine=fake_engine,
                     start_workers=False, start_watcher=False)
    with TestClient(app) as c:
        yield c


def test_voices_cover_ru_and_uz():
    assert VOICES["ru"]["female"] == "ru-RU-SvetlanaNeural"
    assert VOICES["uz"]["male"] == "uz-UZ-SardorNeural"


def test_tts_generate_and_serve(client):
    r = client.post("/api/tts", json={"text": "Здравствуйте!",
                                      "language": "ru", "voice": "female"})
    assert r.status_code == 200
    url = r.json()["audio_url"]
    audio = client.get(url)
    assert audio.status_code == 200
    assert audio.content.startswith(b"ID3-fake-mp3:ru-RU-Svetlana")
    assert client.post("/api/tts", json={"text": "", "language": "ru",
                                         "voice": "female"}).status_code == 422
    assert client.post("/api/tts", json={"text": "x", "language": "en",
                                         "voice": "female"}).status_code == 422


def test_scripts_crud_with_voicing(client):
    r = client.post("/api/scripts", json={
        "name": "Приветствие", "text": "Клиника Аврора, здравствуйте!",
        "language": "ru", "voice": "female"})
    assert r.status_code == 200
    script = r.json()
    assert script["audio_path"]
    listed = client.get("/api/scripts").json()
    assert len(listed) == 1
    r2 = client.patch(f"/api/scripts/{script['id']}",
                      json={"text": "Клиника Аврора, добрый день!"})
    assert r2.json()["text"] == "Клиника Аврора, добрый день!"
    assert client.delete(f"/api/scripts/{script['id']}").status_code == 200
    assert client.get("/api/scripts").json() == []


def test_settings_get_masks_key_and_put_saves(client, cfg):
    r = client.get("/api/settings")
    assert r.status_code == 200
    assert "anthropic_api_key" not in r.json()
    assert r.json()["has_api_key"] is False
    r2 = client.put("/api/settings", json={
        "model": "claude-haiku-4-5", "anthropic_api_key": "sk-test-123"})
    assert r2.status_code == 200
    assert client.get("/api/settings").json()["has_api_key"] is True
    assert cfg.load_settings()["model"] == "claude-haiku-4-5"
    assert cfg.api_key() == "sk-test-123"


def test_backup_zips_database(client, cfg):
    r = client.post("/api/backup")
    assert r.status_code == 200
    backup_file = Path(r.json()["path"])
    assert backup_file.exists()
    with zipfile.ZipFile(backup_file) as z:
        assert "ccqa.sqlite3" in z.namelist()
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv\Scripts\python.exe -m pytest tests/test_api_misc.py -q`
Expected: FAIL — no module `app.tts` / 404s.

- [ ] **Step 3: Implement** — `app/tts.py`:

```python
import asyncio
from pathlib import Path

VOICES = {
    "ru": {"female": "ru-RU-SvetlanaNeural", "male": "ru-RU-DmitryNeural"},
    "uz": {"female": "uz-UZ-MadinaNeural", "male": "uz-UZ-SardorNeural"},
}


def edge_engine(text: str, voice_id: str, out_path: Path) -> None:
    """Synthesize with Microsoft Edge neural voices (needs internet)."""
    import edge_tts

    async def _run():
        communicate = edge_tts.Communicate(text, voice_id)
        await communicate.save(str(out_path))

    asyncio.run(_run())


def synthesize(text: str, language: str, voice: str, out_path: Path,
               engine=None) -> Path:
    if language not in VOICES:
        raise ValueError("язык должен быть 'ru' или 'uz'")
    if voice not in ("female", "male"):
        raise ValueError("голос должен быть 'female' или 'male'")
    voice_id = VOICES[language][voice]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    (engine or edge_engine)(text, voice_id, out_path)
    return out_path
```

`app/routes/misc.py`:

```python
import hashlib
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from ..main import get_db
from ..tts import synthesize

router = APIRouter(tags=["misc"])


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _tts_generate(request: Request, text: str, language: str, voice: str) -> Path:
    cfg = request.app.state.cfg
    text = (text or "").strip()
    if not text:
        raise HTTPException(422, "текст пуст")
    try:
        name = hashlib.sha256(
            f"{language}|{voice}|{text}".encode()).hexdigest()[:20] + ".mp3"
        return synthesize(text, language, voice, cfg.tts_dir / name,
                          engine=request.app.state.tts_engine)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/tts")
def tts(request: Request, body: dict):
    path = _tts_generate(request, body.get("text", ""),
                         body.get("language", "ru"), body.get("voice", "female"))
    return {"audio_url": f"/api/tts/audio/{path.name}"}


@router.get("/tts/audio/{name}")
def tts_audio(request: Request, name: str):
    path = request.app.state.cfg.tts_dir / Path(name).name  # basename only
    if not path.exists():
        raise HTTPException(404, "аудио не найдено")
    return FileResponse(path, media_type="audio/mpeg")


@router.post("/scripts")
def create_script(request: Request, body: dict, db=Depends(get_db)):
    for field in ("name", "text"):
        if not (body.get(field) or "").strip():
            raise HTTPException(422, f"{field} обязателен")
    language = body.get("language", "ru")
    voice = body.get("voice", "female")
    audio = _tts_generate(request, body["text"], language, voice)
    cur = db.execute(
        "INSERT INTO scripts(name, text, language, voice, audio_path, updated_at)"
        " VALUES (?,?,?,?,?,?)",
        (body["name"], body["text"], language, voice, str(audio),
         datetime.now(timezone.utc).isoformat()))
    db.commit()
    return dict(db.execute("SELECT * FROM scripts WHERE id=?",
                           (cur.lastrowid,)).fetchone())


@router.get("/scripts")
def list_scripts(db=Depends(get_db)):
    return [dict(r) for r in db.execute("SELECT * FROM scripts ORDER BY name")]


@router.patch("/scripts/{script_id}")
def patch_script(request: Request, script_id: int, body: dict, db=Depends(get_db)):
    row = db.execute("SELECT * FROM scripts WHERE id=?", (script_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "скрипт не найден")
    merged = {**dict(row), **{k: body[k] for k in
                              ("name", "text", "language", "voice") if k in body}}
    audio = _tts_generate(request, merged["text"], merged["language"],
                          merged["voice"])
    db.execute(
        "UPDATE scripts SET name=?, text=?, language=?, voice=?, audio_path=?,"
        " updated_at=? WHERE id=?",
        (merged["name"], merged["text"], merged["language"], merged["voice"],
         str(audio), datetime.now(timezone.utc).isoformat(), script_id))
    db.commit()
    return dict(db.execute("SELECT * FROM scripts WHERE id=?",
                           (script_id,)).fetchone())


@router.delete("/scripts/{script_id}")
def delete_script(script_id: int, db=Depends(get_db)):
    if db.execute("SELECT id FROM scripts WHERE id=?",
                  (script_id,)).fetchone() is None:
        raise HTTPException(404, "скрипт не найден")
    db.execute("DELETE FROM scripts WHERE id=?", (script_id,))
    db.commit()
    return {"ok": True}


SETTINGS_KEYS = ("model", "model_low_cost", "whisper_model", "whisper_device",
                 "port", "watch_enabled", "filename_pattern")


@router.get("/settings")
def get_settings(request: Request):
    cfg = request.app.state.cfg
    s = cfg.load_settings()
    return {**{k: s[k] for k in SETTINGS_KEYS},
            "has_api_key": bool(cfg.api_key())}


@router.put("/settings")
def put_settings(request: Request, body: dict):
    cfg = request.app.state.cfg
    updates = {k: body[k] for k in SETTINGS_KEYS if k in body}
    if body.get("anthropic_api_key"):
        updates["anthropic_api_key"] = body["anthropic_api_key"]
    cfg.save_settings(updates)
    return get_settings(request)


@router.post("/backup")
def backup(request: Request, db=Depends(get_db)):
    cfg = request.app.state.cfg
    db.execute("PRAGMA wal_checkpoint(FULL)")
    out = cfg.backup_dir / f"backup-{_now_stamp()}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(cfg.db_path, arcname=cfg.db_path.name)
    return {"path": str(out)}
```

Add to `app/main.py`: extend imports to `from .routes import calls, misc, operators, review, scorecard` and add `app.include_router(misc.router, prefix="/api")`.

- [ ] **Step 4: Run tests**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: all pass (fake TTS engine — no network).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: TTS with ru/uz Edge voices (injectable engine), scripts library, settings, backup"
```

---

### Task 14: Server entrypoint, Start.bat, README, final gate

**Files:**
- Create: `app/server.py`, `Start.bat`, `README.md`
- Test: full suite + manual server smoke

- [ ] **Step 1: Implement** — `app/server.py`:

```python
from pathlib import Path

from .config import AppConfig
from .main import create_app

BASE_DIR = Path(__file__).resolve().parent.parent

app = create_app(AppConfig(BASE_DIR))
```

`Start.bat`:

```bat
@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Первый запуск: установка окружения, подождите...
  py -3.13 -m venv .venv || py -3.12 -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
start "" http://localhost:8787
.venv\Scripts\python.exe -m uvicorn app.server:app --host 127.0.0.1 --port 8787
```

`README.md` (replaces the v1 one, now in `legacy/`):

```markdown
# Контроль качества колл-центра (V2T + T2V)

Система для клиники: загрузка записей звонков → расшифровка (на видеокарте)
→ оценка Claude по чек-листу → проверка и исправления в браузере.

## Запуск

Дважды кликните **Start.bat**. Откроется браузер (http://localhost:8787).
Первый запуск скачивает модель распознавания (~3 ГБ) — потерпите.

## Как пользоваться

1. Перетащите записи звонков на страницу загрузки, ИЛИ просто кладите
   файлы в папку `incoming/` — система заберёт их сама.
2. Звонки проходят стадии: в очереди → расшифровка → оценка → готов к проверке.
3. Откройте звонок: слушайте, исправляйте текст, меняйте оценки,
   отмечайте хорошие/плохие фразы (они учат систему), отправляйте
   замечания операторам.

## Ключ API

Оценка звонков использует Claude API. Введите ключ на странице «Настройки»
(он хранится в вашем профиле Windows, не в этой папке).

## Данные

Всё лежит в `data/` (база, аудио). Кнопка «Резервная копия» в настройках
создаёт архив базы в `data/backups/`.

## Диагностика видеокарты

`.venv\Scripts\python.exe scripts\gpu_check.py` — покажет, работает ли CUDA.

## Для разработчика

- Тесты: `.venv\Scripts\python.exe -m pytest -q`
- API-документация: http://localhost:8787/docs
- Старые скрипты v1 — в `legacy/`
```

- [ ] **Step 2: Full test suite**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: ALL tests pass — this is the commit gate.

- [ ] **Step 3: Manual server smoke (background, then kill)**

```powershell
$p = Start-Process -PassThru -NoNewWindow .venv\Scripts\python.exe -ArgumentList "-m","uvicorn","app.server:app","--port","8787"
Start-Sleep 5
(Invoke-WebRequest http://127.0.0.1:8787/api/dashboard).StatusCode   # expect 200
(Invoke-WebRequest http://127.0.0.1:8787/).StatusCode                # expect 200
Stop-Process $p.Id
```

Expected: both 200. Note: this starts real workers; with no jobs queued they idle harmlessly. The transcribe worker only loads Whisper when a job exists.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: server entrypoint, Start.bat launcher, owner README"
```

- [ ] **Step 5: Report**

Summarize for the owner (plain language): backend engine complete — upload/watch → transcribe → score pipeline, review/fix/teach/coach APIs, TTS, settings, backup; all tests green. Next: Plan 2 (the browser interface) and then the real-audio acceptance test with 5–10 recordings from the owner.

---

## Verification gate (whole plan)

- `.venv\Scripts\python.exe -m pytest -q` → 100% pass, no skips in the default run.
- `git log --oneline` shows one commit per task.
- Server starts and serves `/api/dashboard` (Task 14 Step 3).
- NOT verified by this plan (deliberately): real GPU transcription quality (needs owner's real recordings — acceptance step after Plan 2), real Claude API scoring (needs API key — first live batch), real edge-tts audio (needs internet — first use).

## Out of scope for this plan

React frontend (Plan 2), diarization, auth, PBX integration, Sheets export, server deployment.


