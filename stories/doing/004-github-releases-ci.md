# Story 004: Automated GitHub Releases with cross-platform builds

**Epic:** Distribution
**Status:** Doing
**Priority:** High
**Estimate:** Medium

## Summary

Set up GitHub Actions to automatically build standalone executables for Windows, macOS, and Linux, and publish them as GitHub Releases. This allows testers to download and run the app without any development setup.

## Current state

- `build.bat` — Windows PyInstaller build script (exists)
- `build-mac.sh` — macOS PyInstaller build script (exists)
- `build-rpi.sh` — Raspberry Pi build script (exists)
- `VoxtralTranscribe.spec` — PyInstaller spec file (exists)
- No GitHub Actions workflow
- No automated release process

## Proposed solution

### GitHub Actions workflow (`.github/workflows/release.yml`)

Trigger: push a git tag like `v1.0.0`

**Jobs:**

1. **build-windows** (runs-on: `windows-latest`)
   - Install Python 3.11+
   - `pip install -r requirements.txt pyinstaller`
   - `pyinstaller VoxtralTranscribe.spec`
   - Zip output as `VoxtralTranscribe-windows.zip`

2. **build-macos** (runs-on: `macos-latest`)
   - Install Python 3.11+
   - `pip install -r requirements.txt pyinstaller`
   - Run `build-mac.sh`
   - Zip output as `VoxtralTranscribe-macos.zip`

3. **build-linux** (runs-on: `ubuntu-latest`)
   - Install Python 3.11+
   - `pip install -r requirements.txt pyinstaller`
   - `pyinstaller VoxtralTranscribe.spec`
   - Tar output as `VoxtralTranscribe-linux.tar.gz`

4. **release** (needs: all build jobs)
   - Create GitHub Release from tag
   - Upload all 3 platform artifacts
   - Auto-generate release notes from commits

### Release process

1. Developer tags a commit: `git tag v1.0.0 && git push --tags`
2. GitHub Actions builds all 3 platforms in parallel (~5 min)
3. Release appears at `github.com/maxonamission/voxtral-transcribe/releases`
4. Testers download the zip for their platform

## Acceptance criteria

- [ ] GitHub Actions workflow builds on all 3 platforms
- [ ] Artifacts are uploaded to GitHub Releases
- [ ] Windows .exe runs without Python installed
- [ ] macOS .app runs without Python installed
- [ ] Linux binary runs without Python installed
- [ ] Release notes are auto-generated
- [ ] System tray icon works in bundled builds

## Notes

- macOS builds may need code signing for Gatekeeper (unsigned apps show warnings). For testing this is fine, for production consider Apple Developer certificate.
- Consider adding a `latest` release that always points to the most recent build
- The user doesn't have a Mac — GitHub Actions macOS runners solve this
