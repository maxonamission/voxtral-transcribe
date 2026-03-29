# Story 021: Audio test diversity — voice variation, accents, and background noise

**Epic:** Testing
**Status:** Backlog
**Priority:** Low
**Estimate:** Medium
**Depends on:** Story 020 (audio integration tests)

## Summary

Story 020 provides baseline TTS-generated test audio with a single voice per language. For robust speech recognition testing, the samples need variation in:
- **Voices** — male/female, different ages, different timbres
- **Accents** — regional variants (e.g. Belgian Dutch vs. Netherlands Dutch, Latin American Spanish vs. Castilian)
- **Background noise** — café, office, street, wind, keyboard typing
- **Speaking speed** — normal, fast, slow
- **Edge cases** — whispering, slight mumbling, trailing off mid-command

## Voice variation

### ElevenLabs voice options

ElevenLabs supports multiple voices per language. The generate-test-audio.mjs script currently uses a single default voice for all languages. To add variation:

1. **Select 2-3 voices per language** from the ElevenLabs voice library
2. **Update VOICE_MAP** in generate-test-audio.mjs with alternative voice IDs
3. **Generate separate sample sets** per voice: `samples-voice-{name}/`
4. **Add voice metadata** to manifest.json

### Voice selection criteria
- At least one male and one female voice per language
- Prefer "conversational" style voices over "narration" style
- Include at least one voice with a slight accent or regional variant if available
- Avoid overly dramatic or expressive voices (we want natural command speech)

### ElevenLabs voice cloning (optional)
- Clone the actual product owner's voice for NL/EN — most realistic baseline
- Requires ~1 minute of reference audio
- Tests would then validate against the voice Voxtral will actually encounter

## Accent variation

| Language | Primary accent | Variants to test |
|----------|---------------|------------------|
| nl | Netherlands (Randstad) | Belgian Dutch, Southern Dutch |
| en | General American | British, Australian, Indian English |
| fr | Metropolitan French | Canadian French, Belgian French |
| de | Standard German | Austrian, Swiss German |
| es | Castilian | Latin American (Mexico, Argentina) |
| pt | Brazilian | European Portuguese |
| ar | Modern Standard | Egyptian, Gulf |
| zh | Mandarin (standard) | Taiwanese Mandarin |

ElevenLabs Multilingual v2 handles accent variation within the same voice, but dedicated accent voices would give more realistic coverage.

## Background noise

### Infrastructure (already built)

The `generate-test-audio.mjs` script supports `--background` mixing:
```bash
# Place background audio in tests/audio-integration/backgrounds/
# Mix all samples with backgrounds at -15dB
node scripts/generate-test-audio.mjs --background
```

### Recommended background recordings

Place these files in `tests/audio-integration/backgrounds/`:

| File | Description | Where to get |
|------|-------------|--------------|
| `cafe.mp3` | Coffee shop ambient | ElevenLabs Sound Effects, Freesound.org |
| `office.mp3` | Open office (typing, murmuring) | ElevenLabs Sound Effects |
| `street.mp3` | Light street traffic | Freesound.org |
| `wind.mp3` | Outdoor wind | Freesound.org |
| `keyboard.mp3` | Mechanical keyboard typing | Record locally |
| `music-soft.mp3` | Soft background music | Any royalty-free source |

### Volume levels to test

| Level | ffmpeg volume | Scenario |
|-------|---------------|----------|
| Light | 0.10 | Quiet office |
| Medium | 0.18 (default) | Café |
| Heavy | 0.30 | Busy street |

Consider generating multiple volume levels per background to test the threshold where commands stop being recognized.

## Speaking speed variation

ElevenLabs does not have a direct speed parameter, but:
- **Slow**: Add commas in the text ("nieuwe, alinea") to create pauses
- **Fast**: Not directly controllable — may need real recordings
- **Alternative**: Use ffmpeg `atempo` filter to speed up/slow down generated audio:
  ```bash
  ffmpeg -i input.mp3 -filter:a "atempo=1.3" fast.mp3    # 30% faster
  ffmpeg -i input.mp3 -filter:a "atempo=0.8" slow.mp3    # 20% slower
  ```

## Test matrix

The full matrix is: `languages × commands × voices × backgrounds × speeds`

For practical purposes, prioritize:
1. **NL + EN**: full matrix (3 voices × 3 backgrounds × 3 speeds)
2. **FR + DE + ES**: primary voice, café background, normal speed
3. **Other languages**: primary voice, clean audio only

## Acceptance criteria

- [ ] At least 2 voices per primary language (NL, EN)
- [ ] At least 3 background noise files in backgrounds/
- [ ] Background-mixed samples generated and included in manifest.json
- [ ] Speed-varied samples for NL + EN
- [ ] Integration test handles `background` field in manifest (tests clean and noisy separately)
- [ ] Test report shows pass rate per voice, per background level
- [ ] Documentation on how to add new voices and backgrounds
