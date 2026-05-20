# Story 028: First-run model download flow

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Medium

## Summary

Het Voxtral `.pte` artefact is ~1.8 GB. Te groot om mee te bundelen in de APK
(Play Store cap, F-Droid policy, en algemeen onhandig). Bouw een first-run
download-flow met progress, resumable downloads, sha256-verificatie en
afdoende storage-checks.

## Acceptance criteria

- [x] First-launch detectie via `ModelStorage.isPresent()`; UI toont download-knop
- [x] Storage-check vóór download (2× modelgrootte vrij)
- [ ] WiFi-only optie — **niet in v1**, overweeg in 033 settings. INTERNET-
  permissie is gedeclareerd; netwerk-type-check kan eenvoudig worden toegevoegd
- [x] Progress: MB done / total, percentage, MB/s, ETA — in `ModelStatus.Downloading`
- [x] Resumable via `Range`-header; valt netjes terug op restart bij HTTP 200
- [x] SHA256 streaming-hash (geen RAM-blow); mismatch → partial file weggegooid
- [x] Model in `Context.filesDir/models/` (privé, niet cacheDir)
- [ ] "Verwijder model"-knop — komt in 033 (settings); helper
  `ModelStorage.delete()` is al beschikbaar

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

## Notes from implementation

- **OkHttp** in plaats van `HttpURLConnection` of `WorkManager`. Voor de
  user-driven download in MainActivity is een gecancelbare Flow voldoende;
  WorkManager voegt meer waarde toe als we de download mogen voortzetten
  zonder UI (kan in een latere iteratie als gebruikers daar om vragen).
- **Placeholder URL en SHA256** in `ModelRegistry` — moet vervangen worden
  door de echte artefact-locatie wanneer story 036 de release-pipeline
  oplevert.
- **Verwijder model** zit in `ModelStorage.delete()` maar wordt nog niet
  ontsloten in de UI — komt in 033.
- **WiFi-only / mobile data**: gedragen v1 onafhankelijk van netwerktype. Een
  toggle in settings (033) is een eenvoudige toevoeging.

## References

- Story 017 — model size rationale
- https://developer.android.com/topic/libraries/architecture/workmanager
