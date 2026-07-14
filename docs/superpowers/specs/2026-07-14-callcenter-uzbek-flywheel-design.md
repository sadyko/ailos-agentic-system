# Call-Center QA — Uzbek Speech Flywheel, Phase 1 (Dialogue Correction Loop + Russian Voice Cloning) — Design

**Date:** 2026-07-14
**Status:** Approved by owner (brainstorming session)
**Builds on:** the completed V2T T2V system (Plan 1 backend + Plan 2 React UI, in `C:\Users\user\Desktop\V2T T2V`).
**Owner:** non-technical; UI + all user-facing text in Russian; no emojis, lucide icons, Aurora medical palette (per the existing app).
**Hardware of record:** owner PC — i5-12400F, 16 GB RAM, **NVIDIA RTX 2060 SUPER (8 GB)**, Python 3.13.

## 1. What this is (and the bigger idea it serves)

The owner wants a **flywheel that makes the system's Uzbek better over time**: real operator↔client calls get transcribed as a two-speaker dialogue, a human corrects them, and the accumulated corrections improve both how the system *understands* Uzbek (recognition) and, eventually, how it *produces* Uzbek (text-to-voice). This Phase 1 builds the **foundation of that flywheel plus an early win on voices**; it deliberately stops short of the heavy model-retraining that only becomes possible once enough corrected data exists.

Phase 1 delivers two things:
- **Part A — the dialogue correction loop:** speaker separation (Оператор vs Клиент), a review/correct/confirm flow that produces trusted two-speaker transcripts, a glossary that improves recognition *immediately* (no training), and an exportable dataset of confirmed dialogues.
- **Part C — Russian voice cloning:** a consent-gated voice-enrollment flow so a few operators' voices become selectable text-to-voice voices, giving the clinic several real call-center voices.

("Part B", pronunciation *coaching of the human*, was explicitly rejected by the owner — the goal is the machine improving, not a language-practice tool. The numbering keeps A/C to match the original three-capability framing.)

## 2. Decisions locked during brainstorming

| Question | Decision |
|---|---|
| What "training pronunciation" means | The **system** improves at Uzbek from human-corrected dialogue — NOT a human-coaching tool. |
| First build scope | Correction loop **and** Russian voice cloning together (owner chose the combined option). |
| Voice-cloning source | **A few consenting operators/staff** — an enrollment flow with a written-consent gate. |
| Diarization | Split each call into **Оператор / Клиент** turns; reviewer can flip a wrong label. |
| Recognition improvement, near-term | **Glossary/hint biasing** fed to the recognizer per call — immediate, no training. |
| Recognition retraining | **Deferred** to a later phase (needs bulk data + likely a rented cloud GPU). |
| Natural Uzbek TTS | **Deferred** — hardest piece; its own future project. Uzbek cloned voices will be rough. |
| AI that answers routine calls | **Out of scope** — parked as a separate, much larger product. |

## 3. Architecture (how it slots into the existing system)

The existing system already has the right seams: a **swappable `Transcriber` interface**, a **job queue + workers**, a **swappable TTS engine (injectable)**, SQLite state, and a React SPA. Phase 1 extends those seams; it does not rearchitect.

- **Transcription → diarizing pipeline.** Replace the `FakeTranscriber`/`FasterWhisperTranscriber` *implementation* behind the existing `Transcriber` interface with a diarizing one (recommended: a WhisperX-style pipeline = Whisper transcription + word-level alignment + `pyannote` speaker diarization, on CUDA with CPU fallback). The interface's `TranscriptResult`/`TranscriptSegment` gain a `speaker` label per segment. The `FakeTranscriber` is extended to emit labeled two-speaker fixtures so tests never touch GPU/network. `pyannote` needs a one-time Hugging Face access token, stored like the API key (user config, outside the repo).
- **Operator/Client labeling.** Diarization yields anonymous speaker clusters (e.g. `SPEAKER_00/01`). We map them to Оператор/Клиент by heuristic (greeting/first-substantial-turn = operator; the clinic-side speaker), store the mapping, and let the reviewer flip it. Once operator voices are enrolled (Part C), an optional voice-match step can auto-assign the operator cluster.
- **Glossary → recognizer hint.** A `glossary` table (owner-editable terms). On each transcribe job, active glossary terms are assembled into the recognizer's `initial_prompt`/hotwords input. Correction diffs feed **suggested** glossary terms (never auto-added).
- **Confirmed dataset.** A `dialogue_datasets`/verified-snapshot concept: confirming a call freezes its corrected, speaker-labeled segments + a pointer to the audio into an immutable dataset entry. An export endpoint packages verified entries into a standard on-disk layout (per-utterance audio clips + text + speaker + language manifest) suitable for future ASR/TTS training.
- **Voice cloning.** A new `voices` concept (enrolled cloned voices) + a cloning TTS engine (recommended: **XTTS v2**, Coqui community fork — multilingual zero-shot cloning incl. Russian, runs on the 2060, slower than edge-tts) added behind the existing injectable TTS seam. edge-tts stays the default and fallback. Enrollment stores a reference sample + consent metadata; synthesis with a cloned voice passes the reference to XTTS.
- **GPU serialization.** Diarization and XTTS are both GPU-heavy; they run through the existing one-at-a-time worker discipline (transcribe worker serialized; cloning synthesis is on-demand and brief). Acceptable on the 2060; both add latency, neither blocks.

## 4. Data model additions (summary)

- `segments`: add `speaker` (e.g. 'operator'|'client'|raw cluster) and keep existing `text_original`/`text_corrected`.
- `glossary(id, term, language, note, active, created_at, source 'manual'|'suggested')`.
- `glossary_suggestions` (or a flag on glossary): terms proposed from correction diffs, pending owner accept/dismiss.
- `dialogue_datasets(id, call_id, confirmed_at, manifest_json)` — immutable snapshot of the confirmed two-speaker corrected transcript + audio reference; the export reads these.
- `voices(id, name, language, kind 'builtin'|'cloned', reference_audio_path, consent_text, consent_given_by, consent_at, active, created_at)` — enrolled cloned voices carry consent fields.
- `scripts`/TTS: `voice` may now reference a `voices.id` (cloned) in addition to the built-in female/male options.

## 5. Screens / UX (Russian, existing app)

- **Call review screen (extended):** each transcript line shows an Оператор/Клиент tag with a one-click flip; a **«Подтвердить диалог»** action freezes a verified dataset entry (and a visible "проверено" state); correction still preserves originals. Glossary "suggested terms" surface here after edits with an **«Добавить в словарь»** action.
- **Словарь (Glossary) — new page or Scorecard-adjacent section:** editable term list (term, language, note, active), plus a review queue of suggested terms to accept/dismiss.
- **Данные (Dataset) — new small page or Settings section:** count of verified dialogues, and an **«Экспорт данных»** button producing the training package (with a plain-language note that this is raw material for future Uzbek improvements, not an automatic trainer).
- **Голоса (Voices) — new page or part of «Озвучка»:** list of voices (built-in + cloned); **«Записать голос»** enrollment (record/upload a 1–2 min sample, name it, tick the written-consent statement) → creates a cloned voice; deactivate/revoke removes it from selection. The «Озвучка» text-to-voice controls and the scripts library gain cloned voices as options.
- **Settings:** a field for the Hugging Face token (needed by the diarization model), alongside the existing Claude API key — same "stored in your Windows profile, not the app folder" handling.

## 6. What Phase 1 explicitly excludes

- Recognition model **retraining/fine-tuning** (later phase; bulk data + probable cloud GPU).
- Natural **Uzbek TTS** / custom Uzbek voice training (hardest; separate future project).
- An **AI phone agent** that answers routine calls (separate, much larger product).
- Real-time/live transcription; multi-user auth; server deployment (unchanged from the base system's out-of-scope list).

## 7. Testing & gates

Same machine discipline as the base system — no commit without green gates, fakes for GPU/network:
- Diarization: unit-test the operator/client mapping heuristic and the `speaker`-carrying `FakeTranscriber`; the real WhisperX/pyannote path is exercised only in a manual GPU smoke, never in the suite.
- Glossary: prompt-assembly from active terms; suggestion extraction from a correction diff.
- Dataset: confirm→snapshot immutability; export manifest shape (verified against a temp dir).
- Voices: enrollment persists consent metadata; cloned voice selectable in TTS with an **injected fake cloning engine** (gates never load XTTS or hit the GPU); consent-revoke removes it from options.
- Frontend: the extended review (speaker flip, confirm), glossary accept/dismiss, voices enrollment, export button — component tests with a mocked API; the real `tsc -b` type gate.
- Acceptance (manual, owner + real data): diarization quality and Uzbek recognition lift on 5–10 real calls; a cloned Russian voice that's recognizably the enrolled operator.

## 8. Honest risks & mitigations

- **Diarization accuracy on noisy phone audio** — imperfect; mitigated by the one-click operator/client flip and by keeping segments editable.
- **Russian-good / Uzbek-rough cloning** — set expectations in the UI; Uzbek cloned output is explicitly labeled as experimental.
- **GPU headroom (8 GB)** — large-v3 + pyannote + XTTS are heavy; run serialized, fall back to CPU/edge-tts, and pick model sizes that fit (may use a smaller Whisper for the diarizing pipeline if large-v3 + diarization won't co-reside).
- **Consent** — cloning is gated behind a recorded written-consent statement and is revocable; no voice is cloned without it.
- **"Learning" expectation** — the glossary gives immediate wins; genuine retraining is a later phase. The Dataset page's copy states this plainly so the owner isn't surprised that confirming dialogues doesn't instantly retrain anything.

## 9. Suggested build order (each its own spec→plan→build later; this spec covers Phase 1 as one coherent feature set)

Within Phase 1, implement in this dependency order: (1) diarizing transcriber + speaker labels on the review screen; (2) confirm-dialogue + dataset + export; (3) glossary + suggestions + recognizer biasing; (4) voice enrollment + consent + XTTS cloning in «Озвучка». Steps 1–3 are the flywheel foundation; step 4 (cloning) is independent and can proceed in parallel.
