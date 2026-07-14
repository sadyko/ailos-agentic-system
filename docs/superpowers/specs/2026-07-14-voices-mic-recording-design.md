# Голоса — Live Microphone Recording + Sample Transcription Preview — Design

**Date:** 2026-07-14
**Status:** Approved by owner (brainstorming session)
**Builds on:** the completed Uzbek-flywheel Phase 1 (Plan 4 — Russian voice cloning) in `C:\Users\user\Desktop\V2T T2V`. The «Голоса» (Voices) page already enrolls a cloned voice from an **uploaded file**, behind a written-consent gate.
**Owner:** non-technical; UI + all user-facing text in Russian; no emojis, lucide icons, existing medical palette.
**Hardware of record:** owner PC — RTX 2060 SUPER (8 GB), Python 3.13. App runs at `http://127.0.0.1` (localhost = a browser "secure context", so `getUserMedia`/microphone works with no HTTPS/certificate).

## 1. What this adds

On the «Голоса» page, let the owner **record a voice with their microphone right in the browser** (instead of only uploading a file), and — after recording — **see the transcription of what they said** so they can confirm the mic captured their speech, then **save** the voice. The written-consent gate is unchanged: no voice is enrolled without consent.

Decisions locked during brainstorming:

| Question | Decision |
|---|---|
| Where does the microphone go? | **«Голоса» page only** (voice enrollment). NOT the calls flow — recording a real call is out of scope here. |
| What does "start transcription" mean? | **Record → show the text → save.** After recording, transcribe the clip so the user verifies the mic worked, then enroll. (Mirrors the project's "voice → text → review → confirm" idea, applied to the enrollment sample.) |
| Preview mechanism | **A quick synchronous endpoint** that transcribes the short sample and returns text — NOT the background calls pipeline (which would clutter the Calls list and require polling). |
| File upload | **Kept alongside** the new recorder — the user picks either "record" or "upload a file". |
| Consent | **Unchanged** — a recorded voice is still a person's voice; the consent checkbox stays a hard gate on «Сохранить голос». |

## 2. User flow (Голоса page)

1. User fills in **Имя голоса** and picks a **language** (as today).
2. User chooses a sample by **either**:
   - **Recording:** press **«Записать голос»** → browser asks mic permission (one time) → records with a live **timer** → **«Остановить»** → a small `<audio>` player appears to hear it back; **«Записать заново»** discards and re-records. **or**
   - **Uploading a file** (the existing input) — unchanged.
3. **«Распознать»** (enabled once a recording/file exists): sends the clip to the sample-transcription endpoint and shows the returned **text** (or a calm note if the recognizer isn't installed yet). This step is optional and never blocks saving.
4. User ticks the **consent checkbox** (required).
5. **«Сохранить голос»** (disabled until **name** + **a sample (recording OR file)** + **consent** are all present) → enrolls via the existing `POST /api/voices`, with the recording sent as the `sample`.

## 3. Architecture (how it slots in)

Extends the existing seams; no rearchitecture.

- **Recording (browser).** A small, self-contained recorder module wraps `navigator.mediaDevices.getUserMedia({audio:true})` + `MediaRecorder`. It exposes start/stop and yields the recorded audio as a **Blob**. The browser APIs are kept behind this thin module boundary so tests can mock them (jsdom has no real microphone).
- **Format normalization (browser).** MediaRecorder records in the browser's native compressed format (typically `audio/webm;opus`). On stop, the module decodes it with the Web Audio API (`AudioContext.decodeAudioData`) and **encodes a mono 16 kHz 16-bit PCM WAV** in the browser. The uploaded/enrolled sample is therefore always a real `.wav` that both the recognizer (faster-whisper) and the voice-cloning (XTTS) accept — **no server-side ffmpeg or extra install needed**. Target browser = Chromium (Chrome/Edge) on the owner's Windows PC. The existing file-upload path is unchanged (the user's own wav/mp3 is sent as-is).
- **Sample transcription (backend).** New `POST /api/voices/transcribe-sample` (multipart `sample`): saves the clip to a temp file, runs a **plain** transcription (single speaker — no diarization needed), joins the segment texts, and returns `{ available: true, text, language }`. It uses a dedicated **plain** transcriber (`FasterWhisperTranscriber`), independent of the diarization/HF-token setting, so the mic check needs only faster-whisper — not pyannote/HF. The transcriber is obtained from an injectable factory on app state (fake in tests) and cached after first build (model loads once).
- **Graceful degradation.** If transcription is unavailable (recognizer/deps not installed, or model load fails), the endpoint returns **HTTP 200** with `{ available: false, message: "Распознаватель ещё не установлен." }` (Russian). The UI shows the note; recording, playback, and **saving the voice still work**. Transcription failures never block enrollment.
- **Enrollment (unchanged).** Saving still calls `POST /api/voices` with `name`, `language`, `consent_text`, `consent_given_by`, `sample`. The only change: `sample` may now be the recorded WAV Blob instead of a chosen file. The consent gate and all backend validation are untouched.

## 4. Backend additions (summary)

- `app/main.py` `create_app(...)`: add `sample_transcriber_factory=None`; default to `lambda: FasterWhisperTranscriber(<same model/device settings the worker factory uses>)`; store on `app.state.sample_transcriber_factory`. (Mirrors the existing `transcriber_factory` seam so tests inject a fake.)
- `app/routes/voices.py`: add `POST /api/voices/transcribe-sample` — multipart `sample: UploadFile`; write to a temp path under `cfg.tmp_dir`; lazily build+cache the plain transcriber from `app.state.sample_transcriber_factory`; `text = " ".join(s.text for s in result.segments).strip()`; return `{available, text, language}`; on any transcription/import/runtime error return `{available: False, message: "..."}` (200, logged). Clean up the temp file.
- No DB or schema change. No change to `POST/GET/DELETE /api/voices`.

## 5. Frontend additions (summary)

- `web/src/lib/recorder.ts` (new): the getUserMedia/MediaRecorder + WAV-encode module — `startRecording()`, `stopRecording(): Promise<Blob>` (WAV), plus the WAV encoder. Browser APIs isolated here for mockability.
- `web/src/lib/api.ts`: add `transcribeSample(sample: Blob): Promise<{available: boolean; text: string; language?: string; message?: string}>` → POST `/api/voices/transcribe-sample` (multipart, no JSON header — mirrors `enrollVoice`).
- `web/src/pages/VoicesPage.tsx`: add the recorder UI (Записать/Остановить/Записать заново, timer, playback), the «Распознать» button + text/notice area, and make the sample source be "recording OR uploaded file". The «Сохранить голос» disabled-rule becomes `name && (file || recordingBlob) && consent`. Everything else (list, playback of enrolled samples, delete-with-confirm, consent copy) unchanged.
- No new nav or route (same page).

## 6. Testing & gates (same discipline — no commit without green gates; no GPU/mic in the suite)

- **Backend:** `POST /api/voices/transcribe-sample` with an **injected fake** `sample_transcriber_factory` (a `FakeTranscriber`) returns the joined text; the **unavailable** path (factory/transcribe raises) returns `{available: false}` with a message and HTTP 200; enrollment via recording is the existing `POST /api/voices` (already covered). Real faster-whisper is never loaded by the suite.
- **Frontend:** mock `navigator.mediaDevices.getUserMedia` + a fake `MediaRecorder` (and the WAV-encode boundary) — record→stop yields a recording, which (with name + consent) enables «Сохранить голос»; «Распознать» calls `api.transcribeSample` and renders the returned text; «Сохранить голос» calls `enrollVoice` with a FormData carrying the recorded sample. Real `tsc -b` type gate; existing VoicesPage tests stay green.
- **Full gate:** `pytest`, `tsc -b`, vitest, `vite build` → `static/`, emoji sweep, server smoke — all green before commit.
- **Acceptance (manual, owner):** allow the mic in the browser, record 10–20 s, see it play back and (once the recognizer is installed) see the text, save the voice, and confirm it appears in «Озвучка».

## 7. Explicitly out of scope

- Recording a **call** (operator↔client) from the mic — this is Голоса/enrollment only.
- Real-time/streaming transcription while recording.
- Any change to the **consent** model, the cloning engine, or the calls pipeline.
- Server deployment / non-Chromium browser polish (owner is on Windows Chrome/Edge).

## 8. Honest risks & mitigations

- **Transcription needs the recognizer installed.** The "show me the text" step works only once faster-whisper is set up (the same one-time ML install real call transcription needs). Mitigation: graceful "Распознаватель ещё не установлен." note; record/playback/**save still work** without it — so the recorder is useful on day one.
- **Browser codec support for `decodeAudioData`.** Reliable on Chromium (owner's browser); the module targets Chrome/Edge. Mitigation: if decode/record fails, show a clear Russian error and fall back to the file-upload path (still fully functional).
- **Mic permission denied.** Show a clear message «Доступ к микрофону запрещён — разрешите его в браузере»; upload remains available.
- **Consent bypass.** None — the consent checkbox still gates «Сохранить голос» exactly as today; a recorded voice is treated identically to an uploaded one.

## 9. Deliverable beyond code

A short, plain-English (Russian-facing where the owner reads UI, but the how-to written for the owner) **instruction sheet** — how to allow the microphone in the browser, record, check the text, and save the voice — delivered at the end and saved into the V2T T2V repo (e.g. `docs/` or a `HOWTO-voices-mic.md`).
