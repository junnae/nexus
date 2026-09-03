# Drag Into Place

A drag-and-drop spelling game for early readers (ages 5-8), built for Curious Learning's
Curious Reader container. React 18 + TypeScript + Vite, offline-first.

## Specs — read before making product or behavior changes

This project is spec-driven. The specs in [`context/`](context/) are binding, not background reading:

- [`context/PRD.md`](context/PRD.md) — product intent, personas, KPIs, non-goals. Read this to understand *why* a feature exists before changing it.
- [`context/DEVSPEC.md`](context/DEVSPEC.md) — **source of truth for behavior.** Data schemas, module specs, non-functional requirements, tech stack, build config. If code and this spec disagree, that's a bug in one of them — fix deliberately, don't just pick one.
- [`context/UISPEC.md`](context/UISPEC.md) — source of truth for presentation: layouts, colors, states, animations, accessibility.
- [`context/TESTSPEC.md`](context/TESTSPEC.md) — what "done" means: test cases and the MVP release gate.

When you change behavior, UI, or scope, update the relevant spec's **Notes** section (a short
dated bullet, not a version bump — we dropped formal spec versioning as unnecessary process
overhead for a project without separate spec owners). If you learn something that contradicts
a stated assumption, add it to DEVSPEC's **Lessons Log**.

## Things worth knowing

- **Placeholder assets:** `public/assets/images/*.png` and `public/lang/english/audios/**/*.wav`
  are generated placeholders (see `scripts/generate-placeholder-assets.ts`), not real art/audio.
  Real MP3 recordings need a code+data change (just update paths in `words.json`); see README.
- **Test scope:** only the automatable core of TESTSPEC is implemented (unit + integration,
  107 tests). Automated a11y/perf scans, the device matrix, and bundle-verification scripts are
  intentionally not built — see TESTSPEC's Notes.
- **Curious Reader upload** (packaging beyond `pnpm build:bundle`) needs MCP credentials this
  repo doesn't have — that step is manual/external.

See [`README.md`](README.md) for setup, dev, test, and build commands.
