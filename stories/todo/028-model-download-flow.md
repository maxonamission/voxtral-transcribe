# Story 028: First-run model download flow

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

Het Voxtral `.pte` artefact is ~1.8 GB. Te groot om mee te bundelen in de APK
(Play Store cap, F-Droid policy, en algemeen onhandig). Bouw een first-run
download-flow met progress, resumable downloads, sha256-verificatie en
afdoende storage-checks.

## Acceptance criteria

- [ ] First-launch detectie: model ontbreekt → toon download-scherm
- [ ] Storage-check vóór download: minstens 2× modelgrootte vrij (download + verify)
- [ ] Network-check: alleen downloaden op WiFi tenzij gebruiker "ook op mobiel"
  expliciet aanvinkt
- [ ] Progress (MB / totaal MB, percentage, snelheid, ETA)
- [ ] Resumable: pauzeren en hervatten ondersteund (Range-header)
- [ ] SHA256-verificatie na download tegen een meegeleverde hash-constant in code
- [ ] Bij hash-mismatch: opgeslagen file verwijderen en duidelijke foutmelding
- [ ] Model wordt opgeslagen in `Context.filesDir` (privé, niet `cacheDir`)
- [ ] "Verwijder model"-knop in settings (033)

## Proposed approach

1. Host het `.pte` (en tokenizer als apart bestand) op GitHub Releases als asset
   van de voxtral-transcribe repo, of mirroren vanaf HuggingFace
2. `ModelDownloadWorker : CoroutineWorker` met `setForeground()` voor
   download-notificatie
3. OkHttp met `Range`-headers voor resume; schrijf naar `*.partial`, hernoem
   na verify
4. SHA256 stream-hash (geen 1.8 GB in RAM)
5. UI: simpel Compose-scherm met cancel/pause-knop

## Open questions

- **Hosting**: GitHub Releases (gratis, snelheid OK) of HuggingFace mirror? Plan:
  GitHub Releases voor versie-pinning aan de app-versie.
- Wat als Mistral het model update? We pinnen aan een specifieke versie/SHA in
  de app-build. Upgrade = nieuwe app-versie.
- Mogen we model delen tussen gebruikers op één device? **Nee** — `filesDir` is
  per-app sandbox; multi-user-Android isolation respecteren.

## Dependencies

- 024 (scaffold), 027 (engine consumeert het model)

## References

- Story 017 — model size rationale
- https://developer.android.com/topic/libraries/architecture/workmanager
