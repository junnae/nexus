# Drag Into Place

A drag-and-drop spelling game for early readers (ages 5-8), built for Curious Learning's
Curious Reader container. Built per the SDAD specs in [`context/`](context/) — see
[`context/PRD.md`](context/PRD.md), [`context/DEVSPEC.md`](context/DEVSPEC.md),
[`context/UISPEC.md`](context/UISPEC.md), and [`context/TESTSPEC.md`](context/TESTSPEC.md)
for the full product/technical/UI/test specification this implementation follows.

## Setup

Requires Node.js 24+ and pnpm 9+.

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Opens on http://localhost:5173. Pass the Curious Reader URL parameters manually during
local dev, e.g. `http://localhost:5173/?cr_lang=english&cr_user_id=test-123`.

## Testing

```bash
pnpm typecheck        # TypeScript, no emit
pnpm test             # unit + integration tests (Vitest)
pnpm test:coverage     # with coverage report
```

## Production build

```bash
pnpm build             # -> dist/
pnpm build:bundle       # -> dist-bundles/drag-into-place-core.zip
                        #    dist-bundles/drag-into-place-lang-english.zip
```

The core ZIP contains `dist/` (engine, minus `lang/`); the language ZIP contains
`lang/<code>/` (words, audio) at its root — Curious Reader's "Layout A" packaging model.
Neither ZIP is uploaded automatically; that requires MCP access to Curious Reader,
which is a separate step outside this repo.

## Placeholder assets

`public/assets/images/*.png` and `public/lang/english/audios/**/*.wav` are **generated
placeholders** (see [`scripts/generate-placeholder-assets.ts`](scripts/generate-placeholder-assets.ts)),
not real illustrations or voice recordings:

- Images are a solid color with the word rendered in a blocky pixel font.
- Audio is a short synthesized tone, pitched differently per letter/word/feedback
  category, so playback is at least distinguishable during manual testing.
- Audio is **WAV, not MP3** — DEVSPEC's example paths use `.mp3`, but encoding real MP3
  needs a native/ffmpeg dependency this project doesn't otherwise require. WAV decodes
  identically via the Web Audio API (`decodeAudioData`), so this is a drop-in, purely
  file-extension-level substitution; swapping in real MP3 recordings later just means
  updating the paths in `lang/english/data/words.json` — no code changes.

Regenerate with `pnpm generate:assets`. Both are meant to be replaced with real art and
voice recordings from Curious Learning before a production release — see DEVSPEC's Open
Questions (word list, foil letters, art style) for what's still pending stakeholder input.

## What this build covers

Implements DEVSPEC Milestone M2 (full working MVP — all 8 modules) plus the
`build:bundle` packaging step. Explicitly out of scope for this pass (see TESTSPEC Parts
IV-VII): automated WCAG/axe-core accessibility scans, FPS/memory/CLS performance tests,
the device test matrix (needs real iOS/Android hardware), and bundle-verification test
scripts — the bundle *build* script itself is included, just not an automated checker.
Curious Reader upload (M4) and field deployment (M5-M6) need MCP credentials and
Curious Learning coordination, both outside this repo's scope.

## Word list

Ships with 10 CVC words (cat, dog, sun, hat, pig, bed, cup, fox, bug, mat) — a default
pending Curious Learning's word-list decision (see PRD's Open Questions).
