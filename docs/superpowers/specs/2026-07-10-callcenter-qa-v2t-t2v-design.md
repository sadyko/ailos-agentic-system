# Call-Center QA System (V2T + T2V) — Design

**Date:** 2026-07-10
**Status:** Approved by owner (brainstorming session)
**Build location:** `C:\Users\user\Desktop\V2T T2V` (separate folder from this vault; will get its own git repo)
**Owner:** non-technical; UI and all user-facing text in Russian; no emojis in UI, lucide icons, professional medical-adjacent style per ailos design principles.

## 1. What it is

A local web application for call-center quality control at a medical clinic in Tashkent. Recordings of phone calls (Russian / Uzbek / mixed) go in; the system transcribes them (voice-to-text on the local GPU), scores each call with Claude against a clinic QA scorecard, and gives the owner a browser UI to review calls, fix transcripts, override scores, curate teaching examples that improve future scoring, and run operator coaching. A separate page provides text-to-voice (Russian + Uzbek) for voicing ideal operator scripts and arbitrary text.

Upgrades the existing v1 CLI pipeline in the same folder (`transcribe.py` + `analyze.py` + `results.csv`), whose scorecard prompt seeds the new system's criteria. The v1 scripts stay as reference until the app is verified, then are retired.

## 2. Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Deployment | Local web app on the owner's Windows PC now; architected to move to a Linux server later without rebuild |
| Users | Single user (owner) in v1; no login |
| Volume | 100+ calls/day |
| Ingest | Both: browser bulk drag-and-drop upload AND a watched `incoming/` folder |
| Fixations | All four: transcript corrections, score overrides + comments, teach-the-system examples, operator coaching log |
| Text-to-voice | Both: free-text read-aloud tool AND a saved scripts library with voiced audio; RU + UZ |
| Approach | Single local web app (Option A) — chosen over desktop app and thin-scripts alternatives |

Owner's hardware (verified): i5-12400F, 15.8 GB RAM, **NVIDIA RTX 2060 SUPER (8 GB)**, Python 3.13.3. GPU transcription is the plan of record.

## 3. Architecture

One Python process serves everything. Owner starts it by double-clicking `Start.bat`, which launches the server and opens the browser at a fixed local port.

- **Backend:** FastAPI + uvicorn (Python). Python is required for Whisper anyway; one language, one process.
- **Database:** SQLite (WAL mode), single file under `data/`. All state — calls, transcripts, scores, fixations, examples, coaching — lives here.
- **Background worker:** in-process worker consuming a job queue table. Transcription jobs are serialized (one GPU job at a time); analysis (Claude API) jobs may run a few in parallel. Queue state is in SQLite, so it survives restarts.
- **STT:** faster-whisper `large-v3` on CUDA. Wrapped behind a narrow `Transcriber` interface so it can later be swapped for a CPU build or a cloud STT API (the future server has no GPU). Setup verifies GPU availability and falls back to CPU int8 with a visible warning. Language auto-detect per file, VAD filter on, timestamped segments kept.
- **Analysis:** Claude API via `anthropic` SDK. Model configurable in Settings (default: the current Sonnet-class model — exact id pinned at implementation time from the live API docs; cheaper Haiku offered as the low-cost option). System prompt is **assembled** from scorecard criteria + curated examples (see §6), versioned; every analysis records which prompt version and model produced it. Structured JSON output with per-criterion score **and one-line reason**.
- **TTS:** `edge-tts` (Microsoft neural voices, free, needs internet). Voices: ru-RU female/male, uz-UZ female/male. Output MP3s stored under `data/tts/`.
- **Watched folder:** `incoming/` monitored via `watchdog`; new audio files are ingested (moved into managed storage) and queued automatically.
- **Frontend:** React + TypeScript + Tailwind, built once to static files and served by FastAPI — the owner never runs node. UI language: Russian. Design: ailos medical style (calm clinical palette, lucide icons, no emojis).
- **File storage:** audio under `data/audio/YYYY-MM/`, content-addressed by hash to the original filename mapping in DB. Upload dedup by SHA-256 of file content.
- **Secrets:** ANTHROPIC_API_KEY stored in a user-level config outside the project folder (e.g. `%APPDATA%\callcenter-qa\config`), settable from the Settings page; never committed, never inside the shareable project folder.

### Pipeline states

`queued → transcribing → analyzing → ready → reviewed`, plus `error` (with message and Retry button) reachable from any processing stage. Claude failures retry automatically (2 attempts, backoff) before landing in `error`. Nothing is silently dropped.

## 4. Screens

1. **Dashboard** — today/this week: calls processed, average score, missed bookings, queue status (N transcribing / N analyzing / N failed).
2. **Calls** — filterable table (date range, operator, status, score range, booking result, missed-booking flag). Row click → review screen.
3. **Call review** — the core workspace, see §5.
4. **Operators** — operator list; per-operator score trend over time, weakest criteria, open/resolved coaching items.
5. **Scorecard** — criteria editor (labels, descriptions, 0–2 scale, active flag) + example library (see §6) + preview of the currently assembled scoring prompt + version history.
6. **Text-to-voice** — free-text → language + voice → generate/play/download MP3; Scripts library below (named scripts with saved voiced audio).
7. **Settings** — API key, model choice, watched-folder path, Whisper model size, filename→operator pattern, Backup button (dated zip of the database — which holds all transcripts, scores, fixations, examples, coaching; bulky call audio excluded).

## 5. Call review screen (fixations)

Two panes.

**Left — conversation:** audio player; transcript as timestamped lines. Click a line → audio seeks there; during playback the current line highlights. Inline edit of any line's text; the machine original is preserved alongside the correction (edits stored as `text_corrected`, original immutable). A **Re-score** button re-runs Claude analysis on the corrected transcript (new analysis row; history kept).

**Right — scorecard:** per criterion: AI score (0–2) + AI's one-line reason; reviewer may set an override score stored **separately** from the AI score (never overwrites — enables later AI-vs-human agreement measurement). Below: booking result, missed-booking flag, AI summary and recommendation, reviewer free-text comment, **Mark reviewed** button.

**Teaching:** selecting a phrase in the transcript opens a small menu: Good example / Bad example → pick related criterion → optional note. Saved into the example library with a link back to the source call/segment.

**Coaching:** "Send to operator" → pick operator, write note, optionally attach a script from the Scripts library → creates a coaching item (open/resolved lifecycle) visible on the Operators page.

**Known v1 limitation (accepted):** no speaker separation (operator vs patient) in the transcript; Claude infers roles from context when scoring. Diarization is a possible later phase.

## 6. How "learning" works (honest model)

No model retraining. The scoring system prompt = base QA instructions + active criteria + curated good/bad examples from the library (with notes). Each assembled prompt is stored as an immutable numbered version; each analysis references its version. Curating examples therefore directly changes how all *future* calls are scored, and the effect is auditable. The Scorecard screen makes the current prompt visible so the owner always knows what the AI has been told. Seed criteria come from v1 `analyze.py`: greeting, need_identified, info_accuracy, booking_offer, politeness, closing (0–2 each) + booking_result and missed_booking.

## 7. Operator identity

`operators` table managed in the UI. On ingest, a configurable filename pattern (e.g. `operator3_2026-07-01.mp3`) auto-assigns the operator; unmatched calls remain unassigned and can be assigned at upload or on the review screen.

## 8. Data model (summary)

- `operators(id, name, active, filename_alias)`
- `calls(id, file_hash UNIQUE, original_filename, audio_path, operator_id?, source, status, error_msg?, duration_sec, detected_language, uploaded_at, call_date)` — `call_date` parsed from the filename when the pattern allows, else the audio file's modified time, else upload time
- `segments(id, call_id, idx, start_sec, end_sec, text_original, text_corrected?, edited_at?)`
- `analyses(id, call_id, prompt_version_id, model, booking_result, missed_booking, summary, recommendation, raw_json, created_at)` — latest analysis is the display one; history kept
- `analysis_scores(analysis_id, criterion_key, ai_score, ai_reason, reviewer_score?)`
- `reviews(call_id, comment, reviewed_at)`
- `criteria(id, key, label_ru, description_ru, active, sort)`
- `examples(id, criterion_id, kind good|bad, phrase, note?, call_id?, segment_id?, active, created_at)`
- `prompt_versions(id, assembled_text, hash, created_at)`
- `coaching(id, call_id, operator_id, note, script_id?, status open|resolved, created_at, resolved_at?)`
- `scripts(id, name, text, language, voice, audio_path?, updated_at)`
- `jobs(id, call_id, kind, status, attempts, error?, timestamps)`
- `settings(key, value)`

## 9. Error handling & reliability

- Dedup on upload/watch by content hash; duplicate → friendly "already in system" notice linking to the existing call.
- Per-stage error status with message + Retry; automatic retry with backoff for Claude API calls.
- Queue and all state in SQLite → restart-safe; `Start.bat` resumes pending work.
- Backup button produces a dated zip of the database file (transcripts included, since they live in the DB; audio excluded).
- Whisper/CUDA unavailability degrades to CPU with a visible banner, never a crash.

## 10. Testing

Standard machine discipline — no commit without green gates:
- Unit tests per pipeline stage with faked STT/LLM (ingest/dedup, queue transitions, retry, transcript storage, score parsing including malformed LLM output, prompt assembly + versioning, filename→operator parsing).
- API tests for the FastAPI endpoints (upload, review actions, overrides, examples, coaching, TTS request validation).
- Frontend: type-check + component tests for the review interactions (line edit, override, phrase-tagging).
- Final end-to-end smoke on **real sample calls provided by the owner (5–10 recordings)** — this is the acceptance step that proves RU/UZ transcription quality on real phone-line audio; Uzbek quality on real audio is the main open risk (mitigations if poor: fine-tuned Uzbek Whisper model from Hugging Face, or cloud STT — swappable per §3).

## 11. Costs (owner-facing facts)

Transcription and TTS: free. Claude scoring ≈ $0.01/call → roughly $20–30/month at 100 calls/day (less with the Haiku option). Internet required for scoring and TTS; transcription is fully local.

## 12. Out of scope for v1 (explicit)

Login/auth (single-user local), speaker diarization, PBX/telephony integration, real-time transcription, Google Sheets export, automatic operator identification by voice. Server migration is a later phase; the design keeps it cheap (web app + swappable Transcriber + config-driven paths).
