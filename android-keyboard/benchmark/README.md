# Benchmark — on-device Voxtral measurement

> Story 035. Not part of regular CI — requires a real Android device with
> the model file already downloaded into the app's `filesDir/models/`.

## What it measures

For each audio sample in the corpus:

- **Word Error Rate (WER)** vs the ground-truth transcript
- **First-token latency** (ms from feed to first delta)
- **Total decode time** (ms)

Each sample is run twice: once with the **QNN** backend (Snapdragon NPU)
and once with **XNNPACK** (CPU). The runner writes a Markdown summary to
`/sdcard/Android/data/<package>/files/benchmark/<date>-<device>.md`.

## Corpus layout

```
app/src/androidTest/assets/benchmark/
├── manifest.json          # ID → audio + reference transcript
├── nl/
│   ├── sample-001.wav     # 16 kHz mono PCM
│   └── ...
└── en/
    └── ...
```

The placeholder `manifest.json` ships with two TODO entries. Replace with
real recordings before measuring:

- 10 NL samples (5–30 s each)
- 10 EN samples (5–30 s each)
- Quiet room, single speaker, conversational pace

The recording guide in `../../tests/audio-integration/RECORDING-GUIDE.md`
(webapp tests) describes the expected style.

## Running

```bash
# Connect a device with USB debugging.
# Ensure the model file is present at filesDir/models/voxtral-mini-3b-realtime.pte
adb shell am instrument -w \
  -e class io.github.maxonamission.voxtral.keyboard.benchmark.BenchmarkRunnerTest \
  io.github.maxonamission.voxtral.keyboard.test/androidx.test.runner.AndroidJUnitRunner
```

## Reading the report

Acceptable v1 thresholds (passing criterion in story 035):

- WER (NL, quiet audio): **< 0.10**
- First-token latency (QNN): **< 800 ms**
- 5-minute continuous dictation: **< 8% battery drop** on Snapdragon 8 Elite
  / S25 Ultra reference device

Values above these are signals to tune chunk size, delay setting, or escalate
back to the ExecuTorch / Mistral teams.
