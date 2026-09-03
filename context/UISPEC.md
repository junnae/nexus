# Drag Into Place — UI Specification

**Last updated:** 2026-09-02 — implemented as specified.

> This UISPEC defines the **user-facing surface**: layout, visual system,
> every screen/state, and the acceptance criteria for the key interactions.
> It realizes the PRD and **references the DEVSPEC for behavior** rather than
> restating it — where a rule concerns *how it works*, this document cites the
> DEVSPEC section; where it concerns *how it looks/moves/feels*, the rule
> lives here.

**Reference chain:** PRD → DEVSPEC → **UISPEC** → TESTSPEC.

---

## 1. Layout system

**Screen Size:** 7-10" tablets (1024×768 to 2560×1440 typical)
**Orientation:** Landscape primary (games usually played landscape on tablets)
**Viewport:** 100vw × 100vh (fullscreen, no chrome)
**Touch Target Minimum:** 44×44px (WCAG AA)
**Color Scheme:** High contrast, accessibility-first

## 2. Color palette & typography

```css
:root {
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;

  /* Text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #4a4a4a;

  /* Status */
  --color-success: #2ecc71;     /* Green: correct placements */
  --color-error: #e74c3c;       /* Red: incorrect placements */
  --color-warning: #f39c12;     /* Orange: attention needed */
  --color-info: #3498db;        /* Blue: informational */

  /* UI Elements */
  --color-tile-bg: #ecf0f1;
  --color-tile-text: #2c3e50;
  --color-tile-locked: #2ecc71;
  --color-slot-empty: #bdc3c7;
  --color-slot-filled: #2ecc71;
  --color-slot-hover: #3498db;

  /* Shadows & Depth */
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.2);
}
```

```css
/* Headings */
--font-size-h1: 2.5rem;    /* Game title */
--font-size-h2: 1.8rem;    /* Score, status */
--font-size-h3: 1.4rem;    /* Labels */

/* Body */
--font-size-body: 1rem;
--font-size-small: 0.875rem;

/* Letter Tiles (primary interaction) */
--font-size-tile: 2.5rem;
--font-weight-tile: 700;

/* Font Family */
--font-family: 'Segoe UI', 'Roboto', sans-serif;
--font-family-mono: 'Courier New', monospace;  /* For debug/testing */
```

## 3. Core game screen

**Screen name:** GamePlayScreen. Visible when `status: 'playing'` (DEVSPEC 1.1.2). Triggers on app load and after word-completion transitions; exits on game end or error.

**Composition (top to bottom):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (48px height)                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Score: 12/20 | Word 5 of 10 | [Sound] [Help] [Settings] │ │
│  └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Main Play Area (remaining height) — no picture, no spelled-out │
│  text; the word is the tiles themselves.                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Before reveal — combined letters sit on the answer slots:│ │
│  │        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐            │ │
│  │        │   [c] [a] [t]   (pulsing, one per slot)         │ │
│  │        └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘            │ │
│  │                                                           │ │
│  │  After tap — audio plays, letters scatter off the slots,  │ │
│  │  a replay-sound button appears in the header:             │ │
│  │        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐            │ │
│  │        │      [ ] [ ] [ ]      (empty, awaiting drops)   │ │
│  │        └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘            │ │
│  │    [a]  [t]  [c]                                          │ │
│  │      (draggable, scattered elsewhere in the play area)    │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Header

- **Score Display:** `"Score: {correctCount}/{totalWords}"`. Always visible; updates on word completion. Font size h2, color text-primary.
- **Progress Indicator:** `"Word {currentIndex + 1} of {totalWords}"`. Always visible; updates on word change. Font size body, color text-secondary.
- **Replay Button:** speaker icon, 40×40px. Appears beside Help after reveal and replays `audio_word_path`; hidden before reveal.
- **Help Button:** `[?]` icon, 40×40px. Opens the Help modal (§5.3).
- **Settings Button:** `[⚙]` icon, 40×40px. Stubbed for MVP (v1.1+).

```gherkin
Given I am playing the game
When I complete a word correctly
Then the score display updates immediately
And no network request is made
```

### 3.2 AnswerArea

**Layout:** N slots in a row (N = word length), 70×70px each, 10px gap, centered.

| State | Visual | Interaction |
|-------|--------|-------------|
| **Empty** | Border: 2px dashed, color-slot-empty; Background: white | Drag target |
| **Hover (drag-over)** | Border: 2px solid, color-slot-hover; Background: color-slot-hover (low opacity) | Highlight drop zone |
| **Filled (correct)** | Border: 2px solid, color-slot-filled; Background: color-success (light); letter locked | No change (locked) |
| **Error (bounce)** | Border: 2px solid, color-error; slot shakes; background flashes red | Auto-reset to empty after 500ms |

Validation itself is DEVSPEC 1.4/1.5; this section only covers the visual response to it.

```gherkin
Given I have a 3-letter word
When I reveal it (§3.3)
Then 3 empty slots appear in a row, each at least 44×44px

When I drag a correct letter into a slot
Then the letter appears, the slot turns green, and the letter locks in place

When I drag an incorrect letter into a slot
Then the slot shakes, the letter bounces away, and the slot returns to empty
```

### 3.3 LetterTiles

**Tile size:** 60×60px minimum (scales up per §6). Single uppercase letter, font-size-tile.

**Combined state (before reveal):** each of the N tiles renders centered directly on its matching answer slot (one tile per slot, visually covering the empty slot beneath it) — this is the word's only presentation; there is no picture and nothing else spells it out. Tiles pulse gently (`tile-pulse`, ~1.6s loop, scale 1↔1.06) as a "tap me" affordance. Tapping **any** tile: plays `audio_word_path` aloud, then the tiles animate apart into their scattered positions (300ms ease-out, the same position transition used for the correct-drop snap) — the letters visibly "explode" outward off the slots rather than cutting to a new layout. Group `aria-label` while combined: `"Tap the word {word} to hear it and scatter the letters"`.

**After reveal:** a round replay-sound button appears in the header beside Help, keeping the answer row and play area clear. Tapping it replays `audio_word_path`. Tiles become individually draggable:

| State | Visual | Interaction |
|-------|--------|-------------|
| **Combined** | See above; `letter-tile--assembled` | Tap → reveal |
| **Idle** | Background: color-tile-bg; Border: 2px solid, color-tile-text; Shadow: shadow-sm | Draggable |
| **Hover** | Shadow: shadow-md; scale 1.05; cursor: grab | Draggable (feedback) |
| **Dragging** | Shadow: shadow-lg; opacity 0.8; z-index 1000 | Following pointer |
| **Locked** | Background: color-tile-locked; Border: 2px solid, color-success; snaps to its answer slot | Not draggable |
| **Bounce** | Shake wobble (300ms); tile moves away from the slot it was just dropped on | Transient, ~500ms |
| **Foil** | Background: color-tile-bg; Border: 2px solid, color-warning (v1.1+) | Draggable (but won't match) |

**Overlap & bounds:** dropping a tile onto another tile (correct slot or not) pushes it clear rather than letting them stack — only a genuine overlap is corrected, so releasing a tile into open space (even near another tile) never nudges it. Dropping on the wrong slot pushes the tile away from that slot (Bounce state above), plays a bounce sound alongside the error sound, in addition to the slot's own error flash (§3.2). Tiles always stay within the viewport, both while dragging and after any drop.

Positioning and drag mechanics (random scatter, viewport clamping, drop detection, overlap/bounce resolution) are DEVSPEC 1.3; this section covers only the visual states above.

```gherkin
Given I am on the game screen
When the word is revealed (§3.3 "Combined state")
Then all tiles are visible, scattered, non-overlapping, and clear of the answer area

When I grab a tile
Then it follows my pointer and stays within the screen bounds

When I release a tile with its center over an answer slot
Then drop validation runs and the tile either locks or bounces

When I release a tile on top of another tile
Then it settles beside it instead of overlapping
```

## 4. State machine & transitions

### 4.1 Game status states

```
Loading → Playing → WordComplete → NextWord → Playing | GameEnd

Error (any state) → ErrorScreen (with retry button) → Loading or Home
```

| From | To | Trigger | Duration | Animation |
|------|-----|---------|----------|-----------|
| Loading | Playing | Word data loaded | Instant | Fade in (300ms) |
| Playing | WordComplete | All tiles locked | Instant | Freeze for 500ms, then celebrate |
| WordComplete | NextWord | User sees celebration | 1500ms delay | Fade out tiles |
| NextWord | Playing | Next word loaded | 500ms | Fade in new word |
| Playing | GameEnd | Last word completed | Instant | Transition to EndScreen |
| Playing | Error | Load fails or crash | Instant | Show ErrorScreen |

### 4.2 Playing sub-states

Internal, not separately visible: `idle`, `dragging`, `validating`, `animating_success`, `animating_error`. Transitions are imperceptible to the user (<50ms each). Driven by DEVSPEC 1.5 (Validation Engine).

### 4.3 Celebrating word completion

1. Freeze game (no more interactions for 1.5s)
2. Play celebration sound (`victory.wav`) then the full word (`audio_word_path`)
3. A bloom graphic animates per `celebration_animation`: `pop` → scales in with a pop; `bounce` → drops in with an overshoot; `confetti` → pops in plus 6 petals burst outward
4. "✓ Great job!" overlay (white text, semi-transparent dark background)
5. After 1.5s: fade out, advance to next word (which starts combined again, §3.3)

```gherkin
Given I complete a word correctly
When the last tile locks in place
Then a celebration sound plays, a visual animation displays, and tiles stop responding

When the celebration ends
Then the next word loads automatically and the game resumes
```

## 5. Loading, error & help screens

### 5.1 Loading screen

Visible when `status: 'loading'`. Centered spinner (3s rotation), "Loading..." text, subtitle "Hang on, I'm getting your words ready". No interaction available. **Timeout:** if not loaded after 5 seconds, show the error screen (DEVSPEC 1.2).

### 5.2 Error screen

Visible when `status: 'error'`. Large warning icon, the error message from app state (e.g., "Failed to load word list"), subtitle "Try reloading the app or contact your teacher", `[Retry]`/`[Home]` buttons.

```gherkin
Given the word list fails to load
When the error screen displays
Then the user can tap Retry and the app attempts to reload
```

### 5.3 Help screen (modal)

Triggered by the header's `[?]` button. Fullscreen semi-transparent dark overlay; modal is 80% width, centered, white background, rounded corners (8px).

```
╔═══════════════════════════════════════════╗
║  How to Play                              ║
║  1. Tap the word to hear it and watch it  ║
║     scatter                               ║
║  2. Drag the letters in the right order   ║
║  3. Tap a slot to drop the letter         ║
║  ✓ Green = You got it!                    ║
║  ✗ Red = Try again                        ║
║  [Close]                                  ║
╚═══════════════════════════════════════════╝
```

Buttons ≥ 44×44px minimum; close button top-right `[X]` icon.

## 6. Accessibility & responsive design

**ARIA labels:**
```
<div role="main" aria-label="Spelling game: spell the word cat">
  <div role="listbox" aria-label="Answer slots for c-a-t">
    <div role="option" aria-label="Slot 1: empty"></div>
  </div>
  <!-- combined (pre-reveal): -->
  <div role="group" aria-label="Tap the word cat to hear it and scatter the letters">
    <button aria-label="Letter c" />
  </div>
  <!-- scattered (post-reveal): -->
  <div role="group" aria-label="Letter tiles: c, a, t">
    <button aria-label="Letter c" />
  </div>
</div>
```

**Keyboard navigation (v1.1+):** Tab focuses tiles in order; Enter locks the focused tile into the first available slot; Arrow keys move the focused tile; Escape deselects.

**Screen reader support:** announce word completion ("You spelled cat! Word 1 of 10."), score updates ("Score: 5 correct out of 10 words."), and errors ("That's not right. Try again.").

**Color contrast:** WCAG AA minimum (4.5:1 normal text, 3:1 large); button states differentiated by color + text, not color alone; focus indicators are a 2px solid high-contrast border.

**Reduced motion:** when the device requests reduced motion, animations and transitions complete immediately instead of pulsing, shaking, or scattering over time.

**Breakpoints:** Mobile (<600px) is out of scope for MVP (landscape tablet focus); Tablet (600–1200px) is the base layout; Large (>1200px) scales tile size up.

```css
/* Base: 1024×768 iPad */
--tile-size: 60px; --slot-size: 70px;

@media (min-width: 1200px) {
  --tile-size: 70px; --slot-size: 80px;
}

@media (min-width: 2000px) {
  --tile-size: 90px; --slot-size: 100px;
}
```

**Orientation:** landscape is the preferred tablet layout, but portrait remains playable and must not be blocked by an orientation overlay.

## 7. Animation & micro-interactions

**Reveal ("smash"):** tap on the combined word → tiles animate from their joined positions to scattered ones over 300ms ease-out (the same transition used for the correct-drop snap below) — a visible "explosion" outward, not a cut.

**Drag:** 60 FPS, no jank; cursor grab/grabbing; shadow-lg + opacity 0.8 while dragging.

**Correct drop:** slot flashes green (50ms); tile fades into its slot (300ms ease-out).

**Incorrect drop:** slot shakes (3 shakes, 300ms total); tile shake-wobbles (300ms) while moving away from that slot; error sound and bounce sound play synchronously.

**Screen fades:** opacity 0→1 (or reverse) over 300ms, ease-in-out.

**Button presses:** scale 1→0.95 on press, back on release (100ms); darken 10% on press.

## 8. Status-dependent visibility

| Element | Visible / active when |
|---|---|
| LoadingScreen | `status: 'loading'` |
| ErrorScreen | `status: 'error'` |
| Header (score/progress/Help/Settings) | `status: 'playing'` |
| AnswerArea | `status: 'playing'`, current word set |
| LetterTiles — combined | `status: 'playing'`, word just loaded, not yet tapped |
| LetterTiles — scattered | after the reveal tap; individual tiles lock once correctly placed |
| Replay-sound button (header) | after the reveal tap (never before — nothing to replay yet) |
| Celebration overlay ("✓ Great job!") | word just completed, during the 1.5s celebration window (§4.3) |
| HelpModal | user has tapped Help, at any point during `'playing'` |
| Game-end screen ("🎉 Game Over!") | `status: 'won'` |

## 9. Acceptance criteria (Gherkin)

```gherkin
Feature: Tap to reveal

Scenario: Word starts combined, with no picture or spelled-out solution
  Given I am on the game screen for the word "cat"
  Then no image is shown anywhere on screen
  And the letters [c][a][t] appear centered on the answer slots, gently pulsing
  And no audio has played yet

Scenario: Tapping the combined word reveals it
  Given the word "cat" is showing combined
  When I tap any of the joined letters
  Then the word "cat" plays aloud
  And the letters animate apart into scattered, draggable positions
  And a small replay-sound button appears

Scenario: Replaying the word after reveal
  Given the word "cat" has been revealed
  When I tap the replay-sound button
  Then the word "cat" plays aloud again
  And the letter tiles are undisturbed

Feature: Core Gameplay

Scenario: User spells a word correctly
  Given the word "cat" has been revealed (tiles scattered)
  When I drag [c] to the first slot
  And I drag [a] to the second slot
  And I drag [t] to the third slot
  Then all tiles lock in place
  And a celebration sound plays, then the word "cat" plays aloud
  And a "Great job!" message appears
  And the score increments
  And after 1.5 seconds, the next word loads, combined again

Scenario: User drags an incorrect letter
  Given the word "cat" has been revealed
  When I drag [m] to the first slot
  Then the tile bounces away from that slot
  And an error sound and a bounce sound play
  And the slot returns to empty state

Scenario: User drops one tile onto another
  Given the word "cat" has been revealed
  When I drag a tile and release it on top of another tile
  Then it settles beside that tile instead of overlapping it

Scenario: User interacts with locked tiles
  Given I have placed [c] correctly in slot 1
  When I try to drag the locked tile
  Then it does not move and no error occurs

Feature: Offline Compliance

Scenario: Game runs without network
  Given the device is in airplane mode
  And the game is already loaded
  When I play a word
  Then no network requests are made
  And the game functions normally
  And no NETGUARD_BLOCK errors appear in logs

Scenario: Assets load from relative paths
  Given the game is running from file:///sdcard/apps/drag-into-place/index.html
  When the word is revealed and its audio plays
  Then the audio is fetched from a relative path (e.g., lang/english/audios/words/cat.wav)
  And it plays successfully
```

---

## Notes

- 2026-09-02: Initial spec.
- 2026-09-02: Implemented as specified, including the correct-drop tile-snap animation.
- 2026-09-02: Numbered sections (§1-§9) and added a status-dependent visibility table (§8), harmonizing with word-smash's UISPEC structure. No behavioral content changed.
- 2026-09-02: Removed §3.2 WordImage; the word is now presented via a combined, tap-to-reveal letter-tile row (§3.3) plus audio, not a picture. Added the reveal/scatter animation, the bounce-away visual, and the overlap-avoidance behavior. Updated the §9 Gherkin and §8 visibility table to match, and corrected a pre-existing spec drift in §4.3 (celebration was documented as keyed on `difficulty`; the code has always keyed it on `celebration_animation`).
- 2026-09-02: Playtesting fixes: the combined word now sits directly on the answer slots (§3, §3.3) rather than in a separate row above them; the replay-sound button now positions itself from the measured answer-area rect instead of a fixed offset that had come to overlap the slots; overlap resolution on drop only corrects a genuine overlap, not an ordinary open-space drop near another tile (§3.3); an incorrect drop now plays a bounce sound alongside the existing error sound (§3.3, §7, §9).
- 2026-09-03: Implemented screen-reader gameplay announcements and reduced-motion behavior for all animations and transitions. Kept portrait playable rather than forcing a rotation overlay, because embedded browser panels can be portrait-shaped without offering device rotation.
- 2026-09-03: Drop highlighting and validation now follow the tile's visual center rather than its top-left corner, preventing visibly placed letters from missing a circle.
- 2026-09-03: A wrong-answer bounce now guarantees the tile clears its circle even when the preferred bounce direction is blocked by a viewport edge.
- 2026-09-03: Moved the replay-sound button from below the answer row into the header beside Help to reduce play-area clutter.
