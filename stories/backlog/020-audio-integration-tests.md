# Story 020: Audio integration tests — end-to-end voice command validation

**Epic:** Testing
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Current tests validate the text matching pipeline (normalized string → command), but the critical failure point is the transcription step (audio → text). Mishearing corrections and phonetic normalization exist specifically to handle ASR errors, but are tested only with hand-crafted strings — not with actual Voxtral output.

This story adds a test suite with real audio recordings that validates the full pipeline: audio file → Voxtral API → transcribed text → command matching → expected result.

## Proposed structure

```
tests/
  audio-integration/
    ├── manifest.json         # test definitions
    ├── samples/
    │   ├── nl/
    │   │   ├── nieuwe-alinea.wav
    │   │   ├── stop-opname.wav
    │   │   ├── kop-een.wav
    │   │   ├── nieuw-todo-item.wav
    │   │   └── gewone-zin.wav        # negative: should NOT match
    │   ├── en/
    │   │   ├── new-paragraph.wav
    │   │   └── stop-recording.wav
    │   └── fr/
    │       └── nouveau-paragraphe.wav
    └── run.test.js           # vitest integration test
```

### Manifest format

```json
{
  "samples": [
    {
      "file": "nl/nieuwe-alinea.wav",
      "lang": "nl",
      "expectedCommand": "newParagraph",
      "expectedTextBefore": "",
      "description": "Clear 'nieuwe alinea' spoken in quiet room"
    },
    {
      "file": "nl/gewone-zin.wav",
      "lang": "nl",
      "expectedCommand": null,
      "description": "Negative: regular sentence, should not match any command"
    },
    {
      "file": "nl/tekst-met-commando.wav",
      "lang": "nl",
      "expectedCommand": "newParagraph",
      "expectedTextBefore": "dit is wat tekst",
      "description": "Command at end of sentence with preceding text"
    }
  ]
}
```

### Test flow

1. Read audio file from disk
2. Send to Voxtral batch API (`/v1/audio/transcriptions`)
3. Run transcribed text through `findCommand()` with the specified language
4. Assert: matched command ID equals `expectedCommand`
5. Assert: `textBefore` matches (if specified)
6. Log: actual transcription for debugging mismatches

### Recording guidelines

- Format: WAV, 16kHz mono, 16-bit PCM (native Voxtral input format)
- Duration: 2-5 seconds per sample
- Environment: quiet room, clear speech
- Speaker variety: at least 2 different speakers per language (if possible)
- Include edge cases: fast speech, accent, background noise samples

## What this catches

- ASR mishearings that the current mishearing rules don't cover
- Regression when updating Voxtral model versions
- Language-specific pronunciation issues
- Compound word detection failures (e.g. "stopopname")
- False positives on normal speech

## Practical considerations

- **Requires API key** — cannot run in CI without credentials
- **Rate-limited** — batch API has rate limits, test suite should be small (~20-30 samples)
- **Deterministic-ish** — ASR output can vary slightly between runs; tests should allow fuzzy matching on `textBefore` but exact match on `expectedCommand`
- **Git LFS** — audio files are binary; use Git LFS or store outside repo
- **Cost** — ~$0.003/min × 30 samples × 3 sec = ~$0.005 per run (negligible)

## Acceptance criteria

- [ ] At least 5 audio samples per supported language (nl, en, fr, de)
- [ ] At least 3 negative samples (normal speech that should NOT match)
- [ ] Manifest with expected results per sample
- [ ] Integration test that runs full pipeline (audio → API → matching)
- [ ] Test is skipped when no API key is available (CI-safe)
- [ ] Documentation on how to add new samples
