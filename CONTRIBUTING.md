# Contributing to Voxtral Transcribe

Thanks for taking an interest in the project. This guide covers the
development setup for the whole monorepo: the Python server, the
Obsidian plugin, and the shared TypeScript modules.

## Repository layout

```
voxtral-transcribe/
├── server.py              # FastAPI backend (transcription, streaming, correction)
├── static/                # PWA frontend (HTML/CSS/JS, no build step)
├── shared/                # Shared TS modules (voice commands, transcript parsing)
│   ├── src/
│   └── __tests__/
├── obsidian-plugin/       # Obsidian plugin (TypeScript, esbuild)
│   ├── src/
│   └── scripts/
└── vscode-extension/      # VS Code extension (experimental)
```

The Obsidian plugin is distributed via a separate repo
(`maxonamission/obsidian-voxtral`), populated automatically by the
`sync-obsidian-plugin` workflow. Do not commit there directly —
everything is overwritten on each sync.

## Filing issues

Open issues at
https://github.com/maxonamission/voxtral-transcribe/issues. Helpful
information to include:

- Voxtral Transcribe version (server) and/or plugin version
- Obsidian version, OS, desktop vs. mobile (if plugin)
- Console / server log output around the failure
- Reproduction steps, ideally with the smallest possible input

## Development setup

### Python backend

Requires Python 3.10+ and a [Mistral API key](https://console.mistral.ai/api-keys).

```bash
python -m venv venv
source venv/bin/activate              # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                  # add your MISTRAL_API_KEY
python server.py
```

The PWA is served at `http://127.0.0.1:8000`. Static assets live in
`static/` and have no build step — edit and refresh.

### Shared modules

```bash
cd shared
npm ci
npm test                              # vitest
```

The `shared/` package is consumed by both `obsidian-plugin/` and
`vscode-extension/`. Run its tests before changing anything used
across consumers.

### Obsidian plugin

```bash
cd obsidian-plugin
npm ci
npm run dev                           # watch mode
npm run build                         # production build → main.js
```

To test inside Obsidian:

1. Build the plugin.
2. Symlink or copy `main.js`, `manifest.json`, and `styles.css` to
   `<vault>/.obsidian/plugins/voxtral-transcribe/`.
3. Enable the plugin in Settings → Community plugins.

The `Hot Reload` community plugin picks up rebuilt `main.js`
automatically.

## Tests & lint

Before opening a PR:

```bash
# Shared
cd shared && npm test

# Plugin
cd obsidian-plugin
npm test
npx eslint src/
npx tsc -noEmit -skipLibCheck
```

CI runs the same checks (`.github/workflows/plugin-ci.yml`).

## Pull requests

- Branch off `main`, target `main`.
- Keep PRs focused; split unrelated changes.
- Match the existing code style — no extra formatter config to wrestle
  with, just stay consistent with surrounding code.
- Reference any related issue in the description.
- Apply one of the labels below so the PR lands in the right section
  of the auto-generated release notes:

  | Label | Section |
  |---|---|
  | `feature`, `enhancement` | ✨ Features |
  | `bug`, `fix` | 🐛 Bug fixes |
  | `documentation` | 📚 Documentation |
  | `internal`, `chore`, `refactor`, `ci`, `tests`, `dependencies` | 🧹 Internal |
  | *(no label)* | 📦 Other changes |
  | `skip-changelog` | *hidden from release notes* |

  Labels are configured in `.github/release.yml`. The PR title is what
  shows up in the notes — write it as you want users to read it.

## Releasing the Obsidian plugin

Maintainer flow, for reference:

1. Trigger `sync-obsidian-plugin` via Actions → Run workflow.
2. Provide the new version (e.g. `1.0.2`).
3. The workflow bumps `package.json` / `manifest.json` /
   `versions.json`, runs lint + tests + build, commits the bump to
   `main`, then syncs the pre-built artifacts to `obsidian-voxtral`
   and tags the release there. The release workflow on `obsidian-voxtral`
   produces a GitHub Release with attestations and auto-generated notes.

`dry_run: true` skips both pushes and just prints the diff — useful
for sanity-checking the bump.

## License

This project is GPL-3.0. By contributing you agree your contributions
will be licensed under the same terms.
