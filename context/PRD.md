# Drag Into Place — Product Requirements Document

**Last updated:** 2026-09-02

> This PRD is the stable *what* and *why* for Drag Into Place. It is
> conceptual and does not describe implementation — DEVSPEC, UISPEC, and
> TESTSPEC reference it, not the other way around.

**Reference chain:** **PRD** → DEVSPEC → UISPEC → TESTSPEC.

---

## 1. Product summary

Drag Into Place is a literacy game for children ages 5-8 built for Curious Learning's Curious Reader container. The game teaches spelling and phonological awareness through interactive drag-and-drop letter placement, with immediate audio and visual feedback. It runs offline-first on tablets in low-connectivity environments.

**Core mechanic:** Children drag letter tiles into answer positions to spell words. Correct placement locks letters and plays audio pronunciation; incorrect placement bounces letters back randomly. Progression through word lists builds confidence and word recognition.

## 2. Personas & users

| Persona | Goal | Context |
|---------|------|---------|
| **Child (5-8)** | Spell words and hear them read aloud | Using tablet independently in classroom or at home |
| **Educator** | Track progress on phonetic skills | Integrated into literacy curriculum for 20-30 students |
| **Parent** | Support early reading at home | Wants child to practice independently 10-15 minutes/day |
| **Field Coordinator** | Manage classroom deployments | Downloading and installing games on multiple tablets via Curious Reader |

## 3. Problem statement

**For:** Children in early literacy stages (ages 5-8), primarily in low-connectivity regions
**Who:** Are learning to sound out and spell words
**The problem:** Traditional spelling practice is passive (listening to letter names) or text-heavy (reading instructions), neither of which builds the kinesthetic muscle memory or active word production that leads to fluent reading

**Our product:** Makes spelling interactive and rewarding, turning letter sequencing into a game where mistakes are learning opportunities and progress is immediate

## 4. Product principles (stable)

- **Offline-first, always.** If it needs the network at runtime, it's out of scope.
- **Relative paths only.** No absolute paths, no CDN — required for `file://` to work at all.
- **Pre-recorded audio only.** No text-to-speech, no dynamic voice synthesis.
- **No Service Workers.** The container blocks them; the game must not depend on one.
- **`cr_user_id` is opaque.** Never logged, never exposed — used only for event correlation.

## 5. Success criteria (KPIs)

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Session Duration** | 10-15 minutes average | Sweet spot for sustained focus in age group without screen fatigue |
| **Words per Session** | 3-5 words completed | Demonstrates maintained engagement and vocabulary exposure |
| **Error-to-Success Ratio** | < 3 attempts per word by end of session | Shows learning curve (early words take 4-5 attempts, later words 1-2) |
| **Return Rate** | > 60% of children return within a week | Indicates the game is memorable and rewarding |
| **Accuracy Improvement** | +15% from word 1 to word 10 in session | Demonstrates active learning and skill progression |
| **Zero Crashes** | 100% uptime during play | Offline reliability is non-negotiable |
| **Audio Latency** | < 100ms from action to sound | Ensures immediate feedback loop feels responsive |

## 6. Target users & market

**Primary Market:** Early literacy classrooms in low-connectivity regions (South Africa, East Africa, Southeast Asia via Curious Learning)

**Device:** 7-10" tablets (iPad Air, Samsung Galaxy Tab)
**Age:** 5-8 years old (Grades K-2)
**Network:** Offline-first (no internet required or expected)
**Language:** English (v1.0); framework for additional languages in v2.0

**Estimated Scale:** 500-2000 tablets per deployment region initially

## 7. Non-goals

- **Do not** build a comprehensive phonics curriculum (Curious Learning provides that; we are one game in the broader set)
- **Do not** track individual student progress across sessions (Curious Reader handles user identity; we report events only)
- **Do not** compete with commercial apps like Duolingo (free, open-source, offline-first means different value proposition)
- **Do not** implement adaptive difficulty (MVP has static word lists; AI-driven sequencing is v2.0)
- **Do not** add social/multiplayer features (screen time concerns and complexity)
- **Do not** require speech recognition (pre-recorded audio only)

## 8. Core features (MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Drag-and-Drop Letter Placement** | Children drag letter tiles from random positions into answer area slots | P0 - Core |
| **Immediate Feedback** | Correct → green highlight + success sound + letter pronunciation; Incorrect → bounce + error sound | P0 - Core |
| **Word Progression** | Auto-advance to next word on completion, tracks current word and score | P0 - Core |
| **Audio Pronunciation** | Full word audio + individual letter sounds played in sequence | P0 - Core |
| **Tap-to-Reveal** | Word starts as one joined, non-draggable row (no picture, nothing spells out the answer); tapping reads it aloud and scatters the letters into draggable tiles; a small button replays the audio on demand afterward | P0 - Core |
| **Visual Scaffolding** | Answer area shows the number of slots matching word length | P1 - High |
| **Offline Bundle** | Runs entirely offline from `file://` protocol, no network calls | P0 - Core |

## 9. Constraints & assumptions

**Technical constraints:**
- Runs from `file://` protocol, not HTTP
- All asset paths must be relative (no absolute paths, no CDN)
- Network access blocked by Curious Reader container
- ZIP file size < 50MB (core) + < 30MB (per language)
- Must support iOS Safari (12+) and Android Chrome/WebView (8+)
- Touch-first (tablets, not desktop)

**Organizational constraints:**
- Single-language MVP (English only) for v1.0
- Deployment via Curious Reader CMS (not direct app)
- Coordination required with Curious Learning team for promotion/publishing
- MCP token access required for uploads

**Assumptions:**
- Curious Learning infrastructure is stable and accessible
- Device WiFi for initial download, then fully offline
- Educator has minimal technical support needs (should "just work")
- Children have prior letter recognition; this game builds sequencing

## 10. Out of scope (v1.0)

- Multiple languages (v2.0)
- Adaptive difficulty or AI-driven level selection (v2.0)
- Teacher dashboards or detailed progress tracking (future version)
- Multiplayer or social features
- Integration with other Curious Reader games (future consideration)
- Advanced hint systems (v1.0 has basic visual scaffolding only)
- Scrolling letter mechanic (v1.0 static, v2.0 may add advanced mechanic)

## 11. Open questions

| Question | Impact | Owner | Status |
|----------|--------|-------|--------|
| How many CVC words (3-letter) vs longer words in MVP? | Scope / difficulty curve | Curious Learning | Pending word list |
| Should v1.0 include foil letters (incorrect options)? | Complexity / cognitive load | Curious Learning | Pending user testing |
| Icon and art style preferences for word images? | Visual design / approvals | Curious Learning | Pending brand guidelines |
| What event reporting level does Curious Learning need? | Implementation effort | Curious Learning | Pending stakeholder input |
| Device testing access (iPad + Android)? | QA timeline | Curious Learning | Pending coordination |

## 12. Resolved decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Layout A ZIP packaging (engine + language) | Simplest for v1.0, follows word-smash pattern | 2026-09-02 |
| No Service Workers (browser APIs stubbed by container) | Curious Reader blocks SW; not needed offline | 2026-09-02 |
| Pre-recorded audio only (no TTS) | Reliability + control over pronunciation + offline | 2026-09-02 |
| React 18 + TypeScript + Vite | Type safety, build speed, ecosystem maturity | 2026-09-02 |

---

## Notes

- 2026-09-02: Initial PRD (scope, personas, KPIs, constraints).
- 2026-09-02: MVP implemented — see the development specification for what changed during the build.
- 2026-09-02: Numbered sections and added a Product Principles list, harmonizing with word-smash's PRD structure.
- 2026-09-02: Replaced the "Visual Scaffolding" picture with Tap-to-Reveal (audio read-aloud + letter scatter) — the placeholder picture was generated text and literally spelled out the answer for the whole round, which undermined the spelling challenge. See the development specification for the underlying behavior.
