# Drag Into Place — Test Specification

**Last updated:** 2026-09-02

> This TESTSPEC defines how to verify the DEVSPEC (behavior) and UISPEC
> (presentation). Every test case traces to a DEVSPEC section (`1.n`/`2.n`)
> and/or a UISPEC section (`§n`). Method tags: `AUTO-EXISTS` (runs today, in
> this repo), `AUTO-TARGET` (worth building, not built), `MANUAL` (needs a
> human or real hardware).

**Reference chain:** PRD → DEVSPEC → UISPEC → **TESTSPEC**.

---

## 1. Test approach & levels

1. **Static checks (exist today).** `pnpm typecheck` — strict TypeScript, must
   pass on any change.
2. **Unit tests (exist today).** Vitest + jsdom. Pure logic (`src/utils/`) tested
   directly; hooks via `@testing-library/react`'s `renderHook`; components via
   React Testing Library, user-centric queries (role/label, not implementation
   detail).
3. **Integration tests (exist today).** Full `<GameBoard>` render, simulating
   real pointer sequences against `tests/integration/`, covering the gameplay
   loop end-to-end and offline compliance.
4. **Accessibility / performance audits (target — not built).** Automated
   axe-core scan and FPS/memory/CLS measurement. See §4.5.
5. **Device & manual QA (target — not built).** Scripted playthrough on real
   iOS/Android tablets. See §4.6.

## 2. Fixtures & test data

- **F-WORDS** — the shipped 10-word CVC list (`public/lang/english/data/words.json`,
  mirrored at `tests/fixtures/words.json`): cat, dog, sun, hat, pig, bed, cup,
  fox, bug, mat. Also used inline (2-3 word subsets) in most test files.
- **Fetch stub** (`tests/gameBoardTestHelpers.ts`) — serves F-WORDS for
  `lang/*/data/words.json` requests, an empty `ArrayBuffer` for every other
  path (audio/image stand-ins).
- **AudioContext stub** — a fake `AudioContext`/`AudioBufferSourceNode` so audio
  tests run without real decode/playback.
- **PointerEvent polyfill** (`tests/setup.ts`) — jsdom has no `PointerEvent`
  implementation; without this, `fireEvent.pointerDown/Move/Up` carry
  `clientX`/`clientY` as `undefined`. Standard RTL + jsdom workaround.
- **`getBoundingClientRect` mock** (`installDomMocks`) — gives answer slots
  distinguishable, spaced-out rects so a simulated drop can target a specific
  slot by coordinate.
- **`window.cr_event` spy** — captures posted event payloads for assertion.

## 3. Build-and-test sequence

```bash
pnpm typecheck                  # A. static — must pass on every change
pnpm test                       # B. unit + integration (Vitest)
pnpm test:coverage              # C. same, with coverage report
pnpm build && pnpm build:bundle # D. production build + Layout A ZIPs
pnpm dev                        # E. manual QA — see §4.6
```

## 4. Test cases

### 4.1 Utilities (`src/utils/`)

- **TC-WLL-01..06** `wordListLoader`: fetches `lang/<code>/data/words.json` (relative,
  no leading `/`); parses and sorts by `level_id`; throws a friendly error on a
  404, a network failure, malformed data, or an empty list. `AUTO-EXISTS`.
  Trace: DEVSPEC 1.8.
- **TC-DRG-01..23** `dragUtils`: rect collision (overlap/no-overlap); slot lookup by
  point (hit/miss); nearest-slot lookup (hit/empty-list); seeded RNG is
  deterministic per seed and differs across seeds; `generateRandomPositions`
  returns the requested count, is deterministic per level index, and never
  overlaps the answer-area rect or other generated tiles (12 cases); plus
  `alignPositionsToSlots` — one position per slot, each centered within its
  slot's bounds (2 cases); `centerOfTile` — returns the center of a
  tile-sized box at a given position (1 case); `resolveOverlaps` — leaves a clear position untouched, pushes an
  overlapping one clear (including the pathological case of two obstacles
  exactly level with each other), clamps to bounds (4 cases); `bounceAwayFromSlot`
  — moves further from the slot center, clamps to bounds, picks a default
  direction when dropped exactly on the slot center, and chooses a clear side
  when viewport clamping blocks that direction (4 cases). `AUTO-EXISTS`.
  Trace: DEVSPEC 1.3, 1.4.
- **TC-AUD-01..06** `audioManager`: loads a file from a relative path; handles a
  missing/failing file without throwing; preloads multiple files concurrently;
  stops the current sound before playing the next; playing an unloaded path is
  a silent no-op; resumes a suspended `AudioContext`. `AUTO-EXISTS`.
  Trace: DEVSPEC 1.6.
- **TC-OFF-01..06** `offlineChecker`: a `null` or `file://` origin is
  offline-compliant; an `http(s)` origin is flagged; missing `cr_lang` or
  `cr_user_id` warns; a present `navigator.serviceWorker` warns. `AUTO-EXISTS`.
  Trace: DEVSPEC 2.5.
- **TC-EVT-01..05** `crEventReporter`: calls `window.cr_event` when present with
  the built payload; no-op (no throw) when absent; doesn't throw if `cr_event`
  itself throws; payload has the required fields; never touches `fetch`/XHR.
  `AUTO-EXISTS`. Trace: DEVSPEC 1.7.

### 4.2 Hooks (`src/hooks/`)

- **TC-LOGIC-01..08** `useGameLogic`: initializes on the first word with
  `status: 'playing'`; session id is a UUID; a correct placement validates and
  locks the tile; an incorrect one validates false and doesn't lock; word
  completion is detected once every tile is locked; `nextWord()` advances the
  index and increments score; completing the last word sets `status: 'won'`;
  `setError` transitions to `status: 'error'`. `AUTO-EXISTS`. Trace: DEVSPEC 1.5.
- **TC-DRAG-01..07** `useDragState`: start records the pointer offset from the
  tile's position; move updates the tracked position; position clamps to
  viewport bounds; drop emits `onTileDrop` with the final, offset-corrected
  tile position (not the raw pointer); a plain click (down then up with no
  move) reports the tile unmoved rather than jumping to wherever it was
  clicked; the drop position clamps to viewport bounds same as during drag; a
  locked tile cannot start a drag. `AUTO-EXISTS`. Trace: DEVSPEC 1.3.
- **TC-UAUD-01..03** `useAudio`: exposes `preload`/`play`/`playSequence`/`resume`;
  preload fetches once per relative path; resume resolves without throwing.
  `AUTO-EXISTS`. Trace: DEVSPEC 1.6.

### 4.3 Components (`src/components/`)

- **TC-ANS-01..06** `AnswerArea`: renders one slot per letter; a correct slot
  shows the locked, uppercase letter; drag-over applies the hover class; an
  invalid drop applies the error class; empty slots are labeled for screen
  readers; measured slot rects are reported to the parent on mount.
  `AUTO-EXISTS`. Trace: DEVSPEC 1.4, UISPEC §3.2.
- **TC-TILE-01..17** `LetterTiles`: renders one tile per letter; a locked tile is
  disabled and styled locked, and centers on its answer slot rather than the
  slot's raw top-left corner, while unlocked siblings stay enabled (5 cases);
  **combined/reveal:** starts assembled with a tap-hint class and a
  "tap the word..." group label, each tile centers on its matching answer slot,
  tapping a tile calls `onSmash` instead of
  starting a drag, tapping reveals (loses the assembled class, group label
  becomes "Letter tiles: ...") (4 cases); **after reveal:** a full
  pointerdown→move→up sequence follows the pointer and emits `onTileDrop` with
  the tile's visual center, the same sequence on a locked tile does nothing, a plain
  click (no movement) leaves the tile exactly where it was, a drop
  that only comes near another tile (not truly overlapping it) lands exactly
  where released, dropping one tile onto another resolves clear of it, and
  reports the *resolved* (post-push) center rather than the raw drop point
  when overlap resolution moves the tile (6
  cases); **bounce:** the
  `bounceTileId`/`bounceSlot` props apply the bounce class and move that tile
  only, not other tiles (2 cases). `AUTO-EXISTS`. Trace: DEVSPEC 1.3, UISPEC §3.3.
- **TC-CTRL-01..04** `GameControls`: displays `Score: x/y` and `Word n of total`;
  Help and Settings buttons fire their callbacks; replay appears only when its
  callback is available and fires it. `AUTO-EXISTS`. Trace: UISPEC
  §3.1.
- **TC-HELP-01..02** `HelpModal`: renders the how-to-play copy; both close
  affordances call `onClose`. `AUTO-EXISTS`. Trace: UISPEC §5.3.
- **TC-LOAD-01** `LoadingScreen`: renders with `role="status"` and visible
  loading copy. `AUTO-EXISTS`. Trace: UISPEC §5.1.
- **TC-ERR-01..03** `ErrorScreen`: shows the passed-in message; Retry and Home
  buttons fire their callbacks. `AUTO-EXISTS`. Trace: UISPEC §5.2.
- **TC-BOARD-01..05** `GameBoard`: reads `cr_lang` from the URL and fetches that
  language's word list; renders the answer-area + combined letter tiles for
  the first word once loaded, with no `<img>` anywhere; shows a loading screen
  before resolution; shows an error screen with Retry/Home on a failed load;
  defaults `cr_lang`/`cr_user_id` when the URL omits them, without crashing.
  `AUTO-EXISTS`. Trace: DEVSPEC 1.2.

### 4.4 Integration (`tests/integration/`)

- **TC-PLAY-01..05** Gameplay flow: starts combined with no image/text solution
  shown, tapping reveals it (group label + class change, header replay-sound
  button appears); a full two-word session reaches the game-end screen with the
  correct final score; an earlier incorrect placement doesn't block completing
  the word; `session_start`/`word_started`/`placement_correct`/`word_completed`
  all fire via `cr_event` in the right order; incorrect placement and word
  completion/score feedback are announced through a live region. `AUTO-EXISTS`. Trace: DEVSPEC
  1.2, 1.3, 1.5, 1.7; UISPEC §3.3, §4, §9 (Tap to Reveal, Core Gameplay).
- **TC-OFFI-01..05** Offline compliance: every `fetch` call is a relative path
  (no leading `/`, no `http(s)://`, no CDN); the revealed word's audio path is
  fetched and is relative; `cr_lang`/`cr_user_id` are read from the URL;
  `offlineChecker` correctly distinguishes `http(s)` from `file://`/`null`
  origins; no Service-Worker dependency. `AUTO-EXISTS`. Trace: DEVSPEC 2.5;
  UISPEC §9 (Offline Compliance).

### 4.5 Accessibility & performance (target — not built)

- **TC-A11Y-01** Automated WCAG AA scan (axe-core) of the play screen: 4.5:1
  text contrast, no missing/redundant ARIA, proper heading hierarchy.
  `AUTO-TARGET`. Trace: DEVSPEC 2.2, UISPEC §6.
- **TC-A11Y-02** All interactive elements measure ≥44×44px. `AUTO-TARGET`.
  Trace: DEVSPEC 2.2.
- **TC-A11Y-03** The live-region content for word completion, score change, and
  incorrect placement is automated by TC-PLAY-05; actual announcement behavior
  remains `MANUAL` (NVDA/VoiceOver). Trace: UISPEC §6.
- **TC-PERF-01** First word visible within 2s of load. `AUTO-TARGET`. Trace:
  DEVSPEC 2.1.
- **TC-PERF-02** Drag maintains ≥55fps average, no dropped frames. `MANUAL`
  (profiled on a target device). Trace: DEVSPEC 2.1.
- **TC-PERF-03** Audio latency <100ms from action to sound; peak memory
  <100MB; layout shift (CLS) <0.1. `MANUAL`. Trace: DEVSPEC 2.1.

### 4.6 Device & manual QA (target — not built)

- **TC-DEV-01** Full playthrough on iPad Safari 14+ and Android Chrome/WebView:
  load, drag, correct/incorrect feedback, celebration, game end — no crashes,
  no console errors. `MANUAL`. Trace: PRD §9 (Constraints, device support).
- **TC-DEV-02** Airplane-mode smoke test: game already loaded, play a full
  word with networking disabled. `MANUAL`. Trace: DEVSPEC 2.5.

### 4.7 Packaging (`scripts/build-bundle.ts`)

`build-bundle.ts` zips the build output; it doesn't assert anything about the
result. All four cases below are checked by hand today (`unzip -l`, file
sizes) rather than by a script — none are truly `AUTO-EXISTS` yet.

- **TC-PKG-01** Core ZIP has `index.html` at its root and no `lang/`
  directory. `MANUAL` (verified once during this build). `AUTO-TARGET`
  (should be a script assertion). Trace: DEVSPEC 3.3.
- **TC-PKG-02** Language ZIP contains `lang/<code>/...` at its root. `MANUAL`.
  `AUTO-TARGET`. Trace: DEVSPEC 3.3.
- **TC-PKG-03** Core ZIP <50MB; language ZIP <30MB. `MANUAL`. `AUTO-TARGET`.
  Trace: PRD §9 (Constraints).
- **TC-PKG-04** No source maps, no `node_modules`, no absolute paths in the
  built bundle. `AUTO-TARGET`. Trace: DEVSPEC 2.5.

## 5. Validation criteria (release gate)

A build is releasable when:

- **G1** `pnpm typecheck` passes.
- **G2** `pnpm test` passes (currently 112/112).
- **G3** `pnpm build && pnpm build:bundle` succeeds; a manual check of both
  ZIPs (TC-PKG-01..03) confirms structure and size limits.
- **G4** Manual playthrough (TC-DEV-01) shows no console errors and no failed
  network requests beyond relative same-origin paths.
- **G5** Once built: TC-A11Y-01/02 and TC-PERF-01 pass automated, and
  TC-A11Y-03/TC-PERF-02/03/TC-DEV-01/02 pass manual review.

## 6. Coverage matrix

| DEVSPEC / UISPEC area | Test cases |
|---|---|
| 1.2 GameBoard | TC-BOARD-01..05, TC-PLAY-01..05 |
| 1.3 LetterTiles (incl. reveal, overlap, bounce) | TC-TILE-01..17, TC-DRAG-01..07, TC-DRG-01..23 |
| 1.4 AnswerArea | TC-ANS-01..06, TC-DRG-01..12 (slot lookup) |
| 1.5 Validation Engine | TC-LOGIC-01..08, TC-PLAY-01..02, TC-PLAY-05 |
| 1.6 Audio Manager | TC-AUD-01..06, TC-UAUD-01..03, TC-PLAY-01 (reveal audio) |
| 1.7 Event Reporting | TC-EVT-01..05, TC-PLAY-04 |
| 1.8 Language Loader | TC-WLL-01..06, TC-BOARD-01 |
| 2.5 Offline compliance | TC-OFF-01..06, TC-OFFI-01..05, TC-DEV-02 |
| 2.2 Accessibility | TC-A11Y-01..03, TC-ANS-05, TC-PLAY-05 |
| 2.1 Performance | TC-PERF-01..03 |
| 3.3 Packaging | TC-PKG-01..04 (currently manual) |
| UISPEC §3.1 Header/Controls | TC-CTRL-01..03 |
| UISPEC §3.3 Tap-to-reveal | TC-TILE-05..07, TC-PLAY-01 |
| UISPEC §5 Loading/Error/Help screens | TC-HELP-01..02, TC-LOAD-01, TC-ERR-01..03 |

## 7. Current reality vs. target

- **Exists today:** the full unit + integration suite (112 tests, all
  `AUTO-EXISTS` cases above) and `pnpm typecheck`, both enforceable on every
  change. `build:bundle` works but asserts nothing about its own output.
- **Not built:** automated accessibility (axe-core) and performance (FPS/
  memory/CLS) checks, the device test matrix, and an automated bundle-content
  checker (TC-PKG-01..04). These need either a browser-automation setup
  (Playwright) or real hardware, both outside this repo's current scope.

---

## Notes

- 2026-09-02: Initial spec (TypeScript `describe`/`it` pseudocode per test case).
- 2026-09-02: Implemented the automatable core (88 tests). Rewritten in a
  compact ID/trace format instead of embedding near-complete test code.
- 2026-09-02: Updated all trace references to DEVSPEC's/UISPEC's new numbered
  sections, harmonizing with [word-smash's TESTSPEC](https://github.com/tinsleygalyean/word-smash/blob/main/docs/specs/TESTSPEC.md).
- 2026-09-02: Removed TC-IMG (component deleted); added the combined/reveal,
  overlap-resolution, and bounce-on-error cases to TC-TILE and three new
  `dragUtils` function groups to TC-DRG; extended TC-PLAY and TC-OFFI for the
  tap-to-reveal flow. 88 → 104 tests, all still `AUTO-EXISTS`.
- 2026-09-02: Playtesting fixes: replaced `computeCombinedPositions` cases with
  `alignPositionsToSlots` cases in TC-DRG (24 → 21); added a "lands exactly
  where released" regression case and a slot-alignment case to TC-TILE (12 →
  14). 104 → 103 tests, all still `AUTO-EXISTS`.
- 2026-09-02: Fixed a second playtesting bug: a plain click (no drag) on a
  scattered tile was reported at the raw click point instead of the tile's
  actual position, "pushing" it there. Added regression cases to TC-DRAG (5 →
  7) and TC-TILE (14 → 15); fixed `dropLetter`'s test helper, which had been
  grabbing tiles at the slot's coordinates rather than the tile's own
  position — it happened to still pass under the old (buggy) raw-pointer
  behavior. 103 → 106 tests, all still `AUTO-EXISTS`.
- 2026-09-02: Fixed a third playtesting bug: a locked (correctly-placed) tile
  rendered at its slot's raw top-left corner instead of centered — visibly
  misaligned, since slots are larger than tiles. Added a centering regression
  case to TC-TILE (15 → 16). 106 → 107 tests, all still `AUTO-EXISTS`.
- 2026-09-03: Added automated live-region content coverage for incorrect
  placement and word completion/score feedback (TC-PLAY-05). Portrait remains
  playable rather than being blocked by a rotation overlay. 107 → 108 tests.
- 2026-09-03: Corrected the LetterTiles drop contract and gameplay helper to
  target slots using the tile's visual center rather than its top-left corner;
  existing component and integration cases now regress the missed-drop bug.
- 2026-09-03: Added the viewport-edge bounce regression case
  (TC-DRG-22). 108 → 109 tests.
- 2026-09-03: Moved replay sound into GameControls and added its conditional
  visibility/callback case (TC-CTRL-04). 109 → 110 tests.
- 2026-09-03: Code review fixes: `onTileDrop` now reports the center of the
  overlap-*resolved* position instead of the raw (pre-resolution) drop point,
  so a drop that gets pushed clear of a neighboring tile is validated against
  the slot it actually renders near, not the one under the original release
  point (TC-TILE gains a regression case, 16 → 17); `centerOfTile` was
  extracted into `dragUtils.ts` as a shared export (it was being computed
  inline in three places) and gained its own case (TC-DRG 22 → 23); fixed the
  G2 release-gate line and CLAUDE.md's mirrored count, both of which had been
  left at 107 despite the suite already being at 110; also fixed the
  coverage-matrix row, which still said `TC-DRG-01..21` after the previous
  round bumped the real range to `01..22`. 110 → 112 tests.
