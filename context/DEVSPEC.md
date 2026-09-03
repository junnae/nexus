# Drag Into Place — Development Specification

**Last updated:** 2026-09-02 — implemented; see [Notes](#notes) for what changed during the build.

> This DEVSPEC is the **source of truth for behavior**. It realizes the product
> intent defined in the PRD. UISPEC references this document for behavior
> rather than restating it; TESTSPEC verifies it. Where a numeric constant
> appears here, it is authoritative and must match the code and the other specs.

**Reference chain:** PRD → **DEVSPEC** → UISPEC → TESTSPEC.

---

# 1. Functional Requirements

## 1.0 Overview

Drag Into Place is a React-based, offline-first literacy game that runs in Curious Reader's WebView from a `file://` protocol. The game loads word lists, renders letter tiles, validates placement, and reports events via the `cr_event` bridge. All assets are embedded in ZIP files; no network access is required or available.

**Core flow:**
1. Game loads with `cr_lang` + `cr_user_id` from URL parameters
2. Word list is fetched from relative path `lang/<cr_lang>/data/words.json`
3. Current word's letters render **combined**: sitting directly on the answer slots (not yet scattered), one tile per slot; no picture or text spells out the answer
4. Child taps the combined word → the word plays aloud and the letters animate apart into random draggable positions ("smash")
5. User drags letter → drop validation checks position
6. Correct drop: lock + play sound + check completion
7. Incorrect drop: bounce away from the slot + play error sound; dropping a tile onto another tile pushes it clear rather than letting them overlap
8. On word completion: celebration + advance to next word (which starts combined again)
9. On game end: final score + app-ready for next session

## 1.1 Data schema

### 1.1.1 Word data (`Word` object + `words.json`)

```typescript
interface Word {
  level_id: number              // Unique per language; sequence determines play order
  target_word: string           // Lowercase, 2-8 characters, A-Z only
  letters: string[]             // Correct letters composing word (lowercase)
  foils: string[]               // Incorrect letters (empty for MVP, added in v1.1)
  image_path: string            // Relative path to word illustration; kept in the schema but currently unused by the UI (see 4.4) — the word is presented via combined letter-tiles + audio instead, not a picture
  audio_word_path: string       // Relative path to full word pronunciation
  audio_letters: {              // Per-letter pronunciation map
    [letter: string]: string    // Letter → relative audio path
  }
  difficulty: 'easy' | 'medium' | 'hard'  // UI hint; does not affect gameplay
  celebration_animation: 'pop' | 'bounce' | 'confetti'  // Celebration style
}
```

**File:** `lang/<langCode>/data/words.json` — array of `Word`, sorted by `level_id`, ~50-100KB uncompressed.

```json
[
  {
    "level_id": 1,
    "target_word": "cat",
    "letters": ["c", "a", "t"],
    "foils": [],
    "image_path": "assets/images/cat.png",
    "audio_word_path": "lang/english/audios/words/cat.mp3",
    "audio_letters": {
      "c": "lang/english/audios/letters/c.mp3",
      "a": "lang/english/audios/letters/a.mp3",
      "t": "lang/english/audios/letters/t.mp3"
    },
    "difficulty": "easy",
    "celebration_animation": "pop"
  }
]
```

### 1.1.2 Game session state

```typescript
interface GameState {
  currentLevelIndex: number           // 0-based index into words array
  currentWord: Word | null
  allTiles: Tile[]                    // Letters + foils, randomized order
  lockedTiles: Set<string>            // Tile IDs in correct position
  tilePositions: Map<string, Vec2>    // Tile ID → {x, y} on screen
  correctPositions: Map<number, string> // Answer slot index → letter
  score: number                       // Cumulative correct placements
  sessionId: string                   // UUID v4 for event reporting
  status: 'loading' | 'playing' | 'won' | 'error'
  errorMessage: string | null
}

interface Tile {
  id: string                          // Unique ID (letter + index if duplicate)
  letter: string                      // A-Z
  isCorrect: boolean                  // Appears in target word?
  expectedPosition: number | null     // Position in word (if correct)
}

interface Vec2 { x: number; y: number }
```

### 1.1.3 Curious Reader integration

URL parameters (from `window.location.search`):
- `cr_lang` — Language code (e.g., `english`), always present
- `cr_user_id` — User identity, always present, opaque, for event reporting only

`cr_event` bridge payload:

```typescript
interface CrEventPayload {
  sessionId: string
  userId: string                      // From cr_user_id
  timestamp: number
  eventType: 'session_start' | 'word_started' | 'word_completed'
            | 'placement_correct' | 'placement_incorrect' | 'session_end'
  wordId?: number
  word?: string
  metadata?: Record<string, unknown>
}
```

## 1.2 Module: GameBoard (core container)

**Goal:** Orchestrate game lifecycle, load words, manage session state, coordinate child components.

**Tasks:**
1. Read and parse `cr_lang` and `cr_user_id` from URL
2. Load word list from `lang/<cr_lang>/data/words.json` (relative fetch)
3. Initialize GameState with session UUID
4. Render LetterTiles, AnswerArea, GameControls
5. On the child's tap-to-reveal gesture: play `audio_word_path` aloud (the read-aloud "solution") and show a replay-sound control in the header for the rest of the round
6. Listen for tile placement events from LetterTiles
7. Validate placement, update state, trigger audio/celebration
8. Advance to next word on completion or provide "Game Over" screen

**Exit criterion:** GameBoard loads, displays the first word combined (no picture, no spelled-out text) with tiles + answer area, handles the tap-to-reveal gesture and all drag interactions end-to-end until word completion and progression to next word.

## 1.3 Module: LetterTiles (draggable letter component)

**Goal:** Render letter tiles at random positions, handle drag interactions, constrain to viewport.

**Tasks:**
1. Render N tiles (N = word length + foils count), initially **combined**: each tile centered directly on its matching answer slot, not draggable — tapping any tile plays the word aloud and reveals (see 1.2 task 5)
2. On reveal, position tiles randomly (must be inside viewport, not overlapping answer area)
3. Register pointer handlers (pointerdown, pointermove, pointerup)
4. Track drag state (which tile, current position, dragging vs idle)
5. Lock tiles that are in correct position (no further dragging)
6. Constrain movement to viewport bounds
7. Emit `onTileDrop` with the tile ID and its visual center; hover and release validation use that same center point, independent of where on the tile the child grabbed it
8. On any drop (correct or not), resolve overlap against every other tile's current position so dropped tiles never rest on top of one another — only a genuine overlap is corrected (zero padding at drop time), so an ordinary drop into open space never nudges
9. On an incorrect drop specifically, push the tile away from the slot it was dropped on ("bounce") and play a bounce sound, then re-resolve overlap against other tiles

**Non-functional requirements:**
- Drag must be smooth at 60 FPS
- Touch support is primary (Pointer Events, not separate touch/mouse handlers)
- No text selection during drag (`user-select: none`)
- Minimum tile size: 50×50px (44×44px minimum touch target respected)

**Exit criterion:** Word starts combined and non-draggable; tapping reveals it (audio + scatter animation). Once scattered, all tiles draggable, movement smooth, tiles stay within bounds and never overlap each other, locked tiles cannot be dragged, an incorrect drop visibly bounces the tile away from that slot, tile position updates flow to parent component.

## 1.4 Module: AnswerArea (drop zone container)

**Goal:** Render answer slots, detect drops, validate placement, communicate results.

**Tasks:**
1. Render N slots (N = word length), arranged in a row
2. Each slot represents one position in target word
3. Detect when a tile is dropped over a slot (point-in-rect collision)
4. On drop: compare dropped tile's letter against `word[slotIndex]`
5. Emit validation result to parent (correct / incorrect)
6. Update visual state (slot highlights on hover, fills on correct placement)
7. Display locked letters if placement is correct

**Drop validation logic:**
```
onTileDrop(tileId, dropPosition):
  slot = findSlotAtPosition(dropPosition)
  if slot exists:
    tile = getTileById(tileId)
    wordPosition = slot.index
    isCorrect = (currentWord.target_word[wordPosition] === tile.letter)
    emit({tileId, wordPosition, isCorrect})
```

**Exit criterion:** Drops are detected, validation works correctly, visual feedback updates on drop (locked or bounced), parent receives validation events.

## 1.5 Module: Validation Engine (core logic)

**Goal:** Check letter placement, manage state transitions, coordinate feedback.

**Tasks:**
1. On tile drop at position: check if `word[position] === tile.letter`
2. If correct: lock tile, play success audio, increment score, check word completion
3. If incorrect: emit bounce animation, play error audio, leave tile unlocked
4. Track `correctPositions` map (position → letter)
5. On word completion: trigger celebration, pause 1.5s, load next word
6. On final word: display "Game Over" + final score

**Exit criterion:** Validation works for all tiles, state updates correctly, completion is detected and progresses properly.

## 1.6 Module: Audio Manager (sound playback)

**Goal:** Play audio files with low latency, no overlapping playback.

**Tasks:**
1. Pre-load all audio files on word load (Web Audio API)
2. Use a single `AudioContext` for playback control
3. Stop current sound before playing next (prevent overlap)
4. On tap-to-reveal: resume the `AudioContext` (first real user gesture) and play `audio_word_path` — the read-aloud "solution"; a replay-sound control in the header repeats this on demand for the rest of the round
5. Playback sequence on correct placement: success chime (100ms) → letter sound → full word
6. On incorrect placement: play error sound and bounce sound together
7. Celebration: play bonus sound

**Audio file locations:**
```
lang/<langCode>/audios/
├── words/{word}.mp3
├── letters/{letter}.mp3
├── feedback/{correct,incorrect,bounce}.mp3
└── celebration/victory.mp3
```

**Exit criterion:** Audio plays on actions with < 100ms latency, no overlaps, word + letter combo flows properly.

## 1.7 Module: Event Reporting (Curious Reader bridge)

**Goal:** Report user events via `cr_event` for Curious Learning analytics.

**Tasks:**
1. On app load: report `session_start` with sessionId, userId
2. On word load: report `word_started` with word ID + word
3. On correct placement: report `placement_correct` with word + position
4. On incorrect placement: report `placement_incorrect` with word
5. On word completion: report `word_completed` with word ID
6. On app close: report `session_end` with final score

**Fire-and-forget pattern:**
```typescript
function reportEvent(event: CrEventPayload): void {
  if (window.cr_event && typeof window.cr_event === 'function') {
    try {
      window.cr_event(event)  // No-op outside container
    } catch (err) {
      console.debug('cr_event unavailable')
    }
  }
}
```

**Exit criterion:** Events fire on actions, include required fields, function gracefully outside container.

## 1.8 Module: Language Loader

**Goal:** Load language-specific content (words, assets) based on URL parameter.

**Tasks:**
1. Extract `cr_lang` from URL
2. Load `lang/<cr_lang>/data/words.json`
3. Verify all audio files exist in `lang/<cr_lang>/audios/`
4. Verify all image files exist in `assets/images/`
5. Handle missing language gracefully (fallback to English or error)

**Exit criterion:** Words and assets load correctly for specified language, missing language handled gracefully.

---

# 2. Non-Functional Requirements

## 2.1 Performance

- App must load and display first word within 2 seconds
- Drag interactions must run at 60 FPS consistently
- Audio playback latency < 100ms from user action
- Memory usage < 100MB at peak
- No janky animations or frame drops during drag

## 2.2 Accessibility

- ARIA labels on all interactive elements
- Semantic HTML (proper heading hierarchy)
- Screen reader support for status updates
- High contrast colors (WCAG AA minimum)
- Touch targets ≥ 44×44px
- Keyboard navigation support (optional for MVP, required for v1.1)

## 2.3 Security & privacy

- No network calls outside of `file://` protocol (violations logged as NETGUARD_BLOCK)
- No external CDN dependencies
- No tracking libraries or analytics SDKs
- `cr_user_id` treated as opaque identifier (never logged or exposed)
- No sensitive data in localStorage or cookies

## 2.4 Reliability

- Zero crashes during normal play
- Graceful error handling for missing assets (placeholder or skip)
- Session recovery if app is backgrounded
- Offline-first (game fully playable without internet)

## 2.5 Offline compliance (Curious Reader v1.8)

- All asset paths relative to `index.html` (no absolute paths)
- Bundler `base` set to `./`
- No CDN URLs or external dependencies
- No Service Workers or network APIs
- All data embedded in ZIP files (< 50MB core, < 30MB per language)
- No `.map` source files in ZIPs
- Must run from `file://` protocol

## 2.6 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Placeholder audio/images ship instead of real recordings/art | Swapping in real assets only requires updating paths in `words.json` — no code change. See README's "Placeholder assets" section. |
| A parent DOM ref read inside a child's first `useLayoutEffect` is `null` (React attaches a host element's own ref *after* its descendants' effects) | Pass the DOM node itself down as state (`useState` + `ref={setEl}`) instead of a ref object, so the child's effect re-runs once the node is attached. Caught by AnswerArea's mount-measurement test. |
| jsdom has no `PointerEvent` implementation — drag tests would silently see `undefined` coordinates | Minimal `PointerEvent extends MouseEvent` polyfill in `tests/setup.ts` (standard RTL/jsdom workaround). |
| Real MP3 encoding needs a native/ffmpeg dependency this project doesn't otherwise pull in | Placeholder audio ships as WAV, which `decodeAudioData` handles identically. |
| No automated device testing (iOS Safari / Android WebView quirks) | Manual pass required before release (TESTSPEC TC-DEV-01/02); tracked as an open gap, not assumed fine. |
| `cr_lang`/`cr_user_id` absent outside the real Curious Reader container | GameBoard defaults to `english` / `unknown-user` instead of crashing. |

---

# 3. Implementation Guide

## 3.1 Technology stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | 5.0+ | Type safety, IDE support, reduces bugs |
| Runtime | Node.js | 24+ | Modern ES2024 features |
| Package Manager | pnpm | 9+ | Faster, stricter isolation |
| Framework | React | 18+ | Component-based, strong ecosystem |
| Build Tool | Vite | 5+ | Fast HMR, small bundle, offline support |
| Testing | Vitest | Latest | React Testing Library compatible |
| Styling | CSS3 + CSS Variables | - | Theming, no build dependency |
| Audio | Web Audio API | - | Native browser, low latency |
| Input | Pointer Events | - | Unified mouse/touch/pen handling |

## 3.2 Directory structure

```
drag-into-place/
├── src/
│   ├── components/   GameBoard, LetterTiles, AnswerArea, GameControls, GardenBackdrop, Flower, *.test.tsx
│   ├── hooks/        useGameLogic, useAudio, useDragState, *.test.ts
│   ├── utils/        wordListLoader, dragUtils, audioManager, offlineChecker, crEventReporter, *.test.ts
│   ├── types/        game.ts, word.ts, audio.ts
│   ├── styles/       variables.css, index.css, components.css
│   ├── App.tsx, App.css, main.tsx
├── tests/
│   ├── integration/  gameplay.test.tsx, offline.test.tsx
│   └── fixtures/     words.json
├── scripts/          generate-placeholder-assets.ts, build-bundle.ts
├── public/
│   ├── assets/images/ (word illustrations)
│   └── lang/<langCode>/
│       ├── audios/{words,letters,feedback,celebration}/*.wav
│       └── data/words.json
├── index.html, vite.config.ts, vitest.config.ts, tsconfig.json, package.json
```

**Artifact lifecycle:**
- **Versioned (committed):** `src/`, `tests/`, `scripts/`, `public/`, config files, `package.json`
- **Ephemeral (gitignored):** `dist/`, `dist-bundles/`, `node_modules/`
- **Durable:** none for MVP (no on-device persistence)

## 3.3 Build configuration

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // CRITICAL: relative paths for file:// protocol
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: false,  // No .map files in ZIPs
    minify: 'terser',
  },
})
```

## 3.4 Environment

- Node.js 24+, pnpm 9+
- Target browsers: iOS Safari 12+, Android Chrome/WebView 8+
- No external API keys or credentials required; build is reproducible from a clean checkout

## 3.5 Runbook

```bash
pnpm install                 # 1. install dependencies
pnpm run typecheck           # 2. type check
pnpm run test                # 3. unit + integration tests
pnpm run dev                 # 4. dev server, http://localhost:5173
pnpm run build                # 5. production build → dist/
pnpm run build:bundle         # 6. offline bundle → dist-bundles/*.zip
```

---

# 4. Appendices

## 4.1 Open questions

| Question | Impact | Owner | Status |
|----------|--------|-------|--------|
| Should MVP include foil letters (incorrect options)? | Difficulty / scope | Curious Learning | Pending user testing |
| How many total words in English word list? | Progression pace | Curious Learning | Pending curriculum alignment |
| Preferred word list: CVC only or mixed difficulties? | Content scope | Curious Learning | Pending pedagogical input |
| Should celebration animation be different per word? | Visual variety / asset creation | Design | Pending style guide |
| Event reporting frequency/detail level? | Analytics | Curious Learning | Pending stakeholder requirements |

## 4.2 Resolved decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| React + TypeScript over Vue/Svelte | Type safety, maturity, team familiarity | 2026-09-02 |
| Vite over webpack | Build speed, HMR, small bundle | 2026-09-02 |
| Web Audio API over HTML5 `<audio>` | Low latency, playback control, no overlaps | 2026-09-02 |
| Pointer Events over separate touch/mouse | Unified handler, better performance | 2026-09-02 |
| Fire-and-forget `cr_event` reporting | Simplicity, no blocking on reporting | 2026-09-02 |
| No Service Workers (rely on container stub) | Offline works without SW; simpler code | 2026-09-02 |
| Relative paths only (no absolute) | Curious Reader compliance, future-proof | 2026-09-02 |
| Tap-to-reveal (combined word → audio + scatter) instead of an always-visible picture | The placeholder `WordImage` was generated pixel-font text — literally the answer, shown the whole round. Reading the word aloud on a deliberate tap, then scattering, removes the persistent solution without needing real illustrated art. | 2026-09-02 |
| `WordImage` component removed rather than kept unused | Dead code the moment its render call was removed; `image_path` stays in the schema for a possible future reintroduction, but nothing references it today. | 2026-09-02 |

## 4.3 Out of scope (v1.0)

- Foil letters (v1.1)
- Hint images (v1.1)
- Scrolling letter mechanic (v2.0)
- Adaptive difficulty (v2.0)
- Teacher dashboards (v2.0)
- Multiple languages (v2.0)
- Speech recognition (v2.0+)
- Progress persistence across sessions (v2.0)

## 4.4 Lessons log

- Assumption: CSS Grid would auto-position tiles → Reality: need explicit random positioning + collision detection
- Assumption: `fetch()` works the same offline as online → Reality: must use explicit relative paths, no `./` prefix assumed
- Assumption: Audio context creation is sync → Reality: must handle async resumption, especially on mobile
- Assumption: a ref attached to a parent DOM node is already set by the time a child component's own `useLayoutEffect` runs on first mount → Reality: React attaches a host element's ref *after* committing that element's descendants, so a child reading a parent's ref object in its first layout effect sees `null`. Fix: pass the DOM node itself down as state (`useState<HTMLElement|null>`, set via `ref={setEl}`) rather than a ref object, and include it in the child's effect dependency array so the effect re-runs once the node is actually attached. Caught by a component test asserting the initial slot-measurement callback fired on mount — would otherwise have silently broken first-word tile positioning in production. (See 2.6.)
- Assumption: jsdom implements `PointerEvent` → Reality: it doesn't (only `MouseEvent`/`TouchEvent`); `fireEvent.pointerDown/Move/Up` in tests silently produced events with `clientX`/`clientY` as `undefined`. Fixed with a small `PointerEvent extends MouseEvent` polyfill in the test setup file — a known, standard workaround for RTL + pointer-events testing in jsdom.
- Real MP3 encoding needs a native/ffmpeg dependency; placeholder audio ships as WAV instead (decodes identically via `decodeAudioData`, just a path-extension difference) — see README's "Placeholder assets" section.
- Assumption: a circular (Euclidean center-to-center distance) push was an adequate way to separate two square tiles → Reality: the actual collision test (`isCollision`) is an axis-aligned bounding-box check, and the two disagree near the boundary — a resolution could converge to "clear" by the circular measure while still AABB-colliding. Fixed by switching `resolveOverlaps` to proper minimum-translation-vector resolution (push along whichever axis needs the smaller correction), which matches `isCollision` exactly instead of approximating it.
- Assumption: a normal-flow element appearing/disappearing (the reveal's replay-sound button) would naturally keep sibling layouts in sync → Reality: `AnswerArea`/`LetterTiles` measure their own layout independently and have no reason to re-measure just because an unrelated sibling's visibility changed elsewhere in the tree — the button pushed the answer slots down without anything re-measuring them, so drops silently missed every slot. Fixed at the root by making the button `position: absolute` (it was never meant to affect layout, per the UISPEC description) rather than patching the symptom with more remeasurement triggers.
- Assumption: `window`'s `resize` event is sufficient to catch every layout change worth re-measuring for → Reality: it doesn't fire when only a *container* resizes (the common case in an embedded WebView, which is exactly the deployment target here). Added a `ResizeObserver` on the play-area element itself in both `AnswerArea` and `LetterTiles`, alongside the existing `resize` listener, for genuine container-resize robustness — this turned out not to be the cause of the bug above, but is still a real correctness gap it's worth having fixed regardless.
- Assumption: a small buffer padding (8px) around the drop-time overlap check would make separation feel natural → Reality: it made ordinary drops into open space visibly snap away whenever they landed merely *near* another tile, not just on top of it — reported by playtesting as tiles "bouncing if you just let them go anywhere." Fixed by using zero padding for the drop-time `resolveOverlaps` call specifically (only a true AABB overlap gets corrected); the scatter-generation padding and the wrong-slot bounce's own resolve pass are unaffected.
- Design change: the combined (pre-reveal) word now sits directly on the answer slots (one tile centered per slot, via a new `alignPositionsToSlots`) instead of in a separate row below the answer area (`computeCombinedPositions`, removed). This reads more clearly as "the word, about to shatter" and also sidesteps needing to reserve layout space above the slots for anything.
- Assumption: an absolutely-positioned element that reserves no layout space is a complete fix once it stops *shifting* siblings → Reality: it can still visually *overlap* them if placed at a fixed offset that doesn't account for what's actually below it. The replay-sound button's `top: 16px` overlapped the answer slots once the combined-row layout changed. Fixed by positioning it from the measured `answerRect` (`answerRect.y + answerRect.height + 12`) instead of a guessed constant, so it always sits just clear of the slots regardless of viewport size.
- Assumption: reporting a drag's drop position as the raw release-time pointer coordinate is equivalent to reporting the tile's position → Reality: `moveDrag` renders the tile at `pointer - dragOffset` throughout the drag (preserving the exact point grabbed), but `endDrag` forwarded the *raw* pointer straight through. For a plain click (down/up with no movement), that raw point is wherever the tile was clicked — typically its center — so the tile's top-left silently snapped there, i.e. a tap "pushed" the tile even with zero actual dragging. Fixed by making `endDrag` apply the same offset + clamp math as `moveDrag`, so the reported drop position always matches where the tile is actually rendered at release. Caught a test helper (`dropLetter`) that had been grabbing tiles at the *slot's* coordinates rather than the tile's own — it only worked because of the bug it was inadvertently relying on.
- Assumption: snapping a locked tile to `{x: slot.x, y: slot.y}` (the slot's raw top-left) was "close enough" → Reality: slots (70px) are larger than tiles (60px), so this left every correctly-placed tile visibly offset toward the slot's top-left corner instead of centered — "the circles don't align." It also duplicated the centering formula already written for the combined (pre-reveal) state, as two separate computations (one in `GameBoard`, one in `LetterTiles`) that could drift apart. Fixed by having `LetterTiles` compute locked positions itself via the same `alignPositionsToSlots` used for the combined state, and removing the now-redundant `lockedPositions` prop/computation from `GameBoard` entirely — one formula for "tile centered on slot N," not two.
- Assumption: the tile's top-left position was a suitable point for answer-slot hit testing → Reality: a letter could visibly overlap or sit inside a circle while its top-left remained just outside, so no correct/error feedback fired. Drop and hover targeting now use the tile's visual center, independent of the child's grab offset.
- Assumption: pushing a wrong tile away and then clamping it to the viewport always cleared the answer slot → Reality: the answer row is near the top edge, so an upward bounce could clamp against that edge while still overlapping the circle. Bounce resolution now falls back to the nearest clear side when the preferred direction is blocked.
- Assumption: reporting the *pre*-overlap-resolution drop point was equivalent to reporting where a tile ends up → Reality: `handleInternalDrop` renders the tile at `resolved` (the overlap-corrected position) but was reporting `centerOfTile(dropPosition, ...)` — the raw, unresolved point — to `onTileDrop`. Whenever a drop genuinely overlapped a neighboring tile (plausible with ~10px slot gaps and a young target audience's imprecise drags), the tile could visually land somewhere the slot-hit-test never evaluated. Fixed by reporting `centerOfTile(resolved, ...)` instead, so validation always matches the rendered position. Caught during a PR code review; verified independently before fixing since the failure mode is condition-dependent (only manifests when a drop actually triggers overlap resolution).
- Reuse: `centerOfTile` (position + half tile size) was being computed inline in three separate places (`resolveOverlaps`, `bounceAwayFromSlot`, and a component-local copy in `LetterTiles.tsx`). Extracted into a single exported `dragUtils.ts` function so there's one formula, not three that could drift.
- Assumption: hardcoding `state.score + 1` in a screen-reader announcement was a safe shortcut since MVP always awards exactly one point per word → Reality: this duplicated `useGameLogic.nextWord`'s own scoring rule in a second, unenforced place. Extracted a shared `POINTS_PER_WORD` constant so both sites reference the same value instead of two independently-typed literals.

---

## Notes

- 2026-09-02: Initial spec.
- 2026-09-02: MVP implemented (Modules 1.2-1.9) in React 18 + TypeScript + Vite per this spec, with 88 automated tests. See Lessons Log above for what changed along the way.
- 2026-09-02: Numbered sections (`1.`/`1.1`/`1.1.1`) and added a Risks & Mitigations table (2.6), harmonizing with [word-smash's DEVSPEC](https://github.com/tinsleygalyean/word-smash/blob/main/docs/specs/DEVSPEC.md) structure — plain Arabic numbering throughout, not the Roman-numeral `Part`/`I.x` scheme word-smash uses, to match this project's other three specs and stay easier on the eye. No behavioral content changed.
- 2026-09-02: Removed the WordImage module (1.5, renumbering 1.6-1.9 → 1.5-1.8) — the word is now presented via tap-to-reveal combined letter-tiles + audio read-aloud instead of an always-visible picture that (with placeholder assets) literally spelled out the answer. Added tile-overlap resolution and incorrect-drop bounce to LetterTiles' tasks. 104 tests now pass (was 88).
- 2026-09-02: Playtesting bug fixes: drop-time overlap resolution now only fires on a genuine overlap (was nudging ordinary open-space drops); combined letters now sit directly on the answer slots instead of a separate row (`computeCombinedPositions` replaced by `alignPositionsToSlots`); the replay-sound button now positions itself from the measured answer-area rect instead of a fixed offset, fixing a visual overlap with the slots; added a dedicated bounce sound played alongside the existing error sound on an incorrect drop. 103 tests pass (net -1: removed 5 `computeCombinedPositions` tests, added 2 `alignPositionsToSlots` tests + 2 new LetterTiles regression tests).
- 2026-09-02: Fixed a second playtesting bug: `useDragState`'s `endDrag` reported the raw release-time pointer as the drop position instead of the offset-corrected tile position, so a plain click (no drag at all) could "push" a tile to wherever it was clicked. Fixed to mirror `moveDrag`'s offset + clamp math. 106 tests pass.
- 2026-09-02: Fixed a third playtesting bug: a correctly-placed (locked) tile rendered at the answer slot's raw top-left corner instead of centered within it, visibly misaligned since slots are larger than tiles. `LetterTiles` now computes locked positions itself via `alignPositionsToSlots` (the same function already used for the combined/pre-reveal state) instead of receiving a separately-computed `lockedPositions` prop from `GameBoard`. 107 tests pass.
- 2026-09-03: Added live announcements for incorrect placements and word completion/score updates, plus reduced-motion CSS. Portrait remains playable because embedded browser panels may be portrait-shaped without offering device rotation. 108 tests pass.
- 2026-09-03: Fixed intermittent missed answer-slot drops by validating the tile's visual center instead of its top-left position; updated drag simulation to match real center-to-center placement. 108 tests pass.
- 2026-09-03: Fixed edge-clamped wrong-answer bounces that could leave a tile overlapping its circle; bounce resolution now selects the nearest clear side. 109 tests pass.
- 2026-09-03: Moved the post-reveal replay-sound control from below the answer row into the header beside Help, reducing play-area clutter. 110 tests pass.
- 2026-09-03: Code review fixes on the above round: `onTileDrop` now reports the overlap-*resolved* tile center rather than the raw pre-resolution drop point, so slot validation matches where the tile actually renders; extracted a shared `centerOfTile` utility (was duplicated inline in three places) and a shared `POINTS_PER_WORD` constant (was a bare `+1` duplicated between `useGameLogic` and the completion announcement); fixed a test-count mismatch left in TESTSPEC's own release-gate line and coverage-matrix row, plus CLAUDE.md's stale mirrored count. 112 tests pass.
