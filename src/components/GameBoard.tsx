import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Word } from '../types/word'
import type { Vec2 } from '../types/game'
import { loadWords, WordListLoadError } from '../utils/wordListLoader'
import { findSlotAtPosition, type Rect, type Slot } from '../utils/dragUtils'
import { buildEvent, reportEvent } from '../utils/crEventReporter'
import { POINTS_PER_WORD, useGameLogic } from '../hooks/useGameLogic'
import { useAudio } from '../hooks/useAudio'
import { GameControls } from './GameControls'
import { AnswerArea } from './AnswerArea'
import { LetterTiles } from './LetterTiles'
import { HelpModal } from './HelpModal'
import { LoadingScreen } from './LoadingScreen'
import { ErrorScreen } from './ErrorScreen'
import { GardenBackdrop } from './GardenBackdrop'
import { Flower } from './Flower'

const CONFETTI_PETAL_COLORS = ['#f2a6c8', '#f7c948', '#8fbf6e', '#93c5e8', '#f2a6c8', '#f7c948']

const LOADING_TIMEOUT_MS = 5000
const CELEBRATION_DURATION_MS = 1500
const ERROR_FLASH_MS = 500

function readUrlParams(): { langCode: string; userId: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    langCode: params.get('cr_lang') || 'english',
    userId: params.get('cr_user_id') || 'unknown-user',
  }
}

export function GameBoard() {
  const { langCode, userId } = useMemo(readUrlParams, [])
  const [words, setWords] = useState<Word[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setWords(null)
    setLoadError(null)

    loadWords(langCode)
      .then((loaded) => {
        if (!cancelled) setWords(loaded)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof WordListLoadError ? err.message : 'Failed to load word list.')
      })

    return () => {
      cancelled = true
    }
  }, [langCode, attempt])

  useEffect(() => {
    if (words !== null || loadError) return
    const timeout = setTimeout(() => {
      setLoadError('Loading is taking longer than expected.')
    }, LOADING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [words, loadError, attempt])

  const restart = () => setAttempt((a) => a + 1)

  let content
  if (loadError) {
    content = <ErrorScreen message={loadError} onRetry={restart} onHome={restart} />
  } else if (!words) {
    content = <LoadingScreen />
  } else {
    content = (
      <GamePlaySession key={attempt} words={words} langCode={langCode} userId={userId} onRestart={restart} />
    )
  }

  return content
}

interface GamePlaySessionProps {
  words: Word[]
  langCode: string
  userId: string
  onRestart: () => void
}

function GamePlaySession({ words, langCode, userId, onRestart }: GamePlaySessionProps) {
  const { state, validatePlacement, nextWord } = useGameLogic(words)
  const audio = useAudio()
  const [playAreaEl, setPlayAreaEl] = useState<HTMLDivElement | null>(null)
  const reportedWordId = useRef<number | null>(null)

  const [slots, setSlots] = useState<Slot[]>([])
  const [answerRect, setAnswerRect] = useState<Rect | null>(null)
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null)
  const [errorSlotIndex, setErrorSlotIndex] = useState<number | null>(null)
  const [bounceTileId, setBounceTileId] = useState<string | null>(null)
  const [bounceSlot, setBounceSlot] = useState<Slot | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [plantedWords, setPlantedWords] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' })

  const currentWord = state.currentWord

  function announce(text: string) {
    setAnnouncement((previous) => ({ id: previous.id + 1, text }))
  }

  // Each new word starts unrevealed (combined, not yet tapped/heard).
  useEffect(() => {
    setRevealed(false)
    setAnnouncement((previous) => ({ id: previous.id + 1, text: '' }))
  }, [currentWord?.level_id])

  // session_start / session_end bracket the whole play session
  useEffect(() => {
    reportEvent(buildEvent('session_start', state.sessionId, userId))
    return () => {
      reportEvent(buildEvent('session_end', state.sessionId, userId, { metadata: { score: state.score } }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On word change: report word_started once, preload its audio.
  useEffect(() => {
    if (!currentWord || reportedWordId.current === currentWord.level_id) return
    reportedWordId.current = currentWord.level_id
    reportEvent(
      buildEvent('word_started', state.sessionId, userId, {
        wordId: currentWord.level_id,
        word: currentWord.target_word,
      }),
    )

    const paths = [
      currentWord.audio_word_path,
      ...Object.values(currentWord.audio_letters),
      `lang/${langCode}/audios/feedback/correct.wav`,
      `lang/${langCode}/audios/feedback/incorrect.wav`,
      `lang/${langCode}/audios/feedback/bounce.wav`,
      `lang/${langCode}/audios/celebration/victory.wav`,
    ]
    void audio.preload(paths)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.level_id])

  // Word completion: celebrate, then advance.
  useEffect(() => {
    if (!currentWord || celebrating) return
    if (state.lockedTiles.size < currentWord.letters.length) return

    setCelebrating(true)
    setPlantedWords((prev) => [...prev, currentWord.level_id])
    announce(
      `You spelled ${currentWord.target_word}! Word ${state.currentLevelIndex + 1} of ${words.length}. ` +
        `Score: ${state.score + POINTS_PER_WORD} correct out of ${words.length} words.`,
    )
    reportEvent(
      buildEvent('word_completed', state.sessionId, userId, {
        wordId: currentWord.level_id,
        word: currentWord.target_word,
      }),
    )
    void audio.playSequence([`lang/${langCode}/audios/celebration/victory.wav`, currentWord.audio_word_path])

    const timer = setTimeout(() => {
      setCelebrating(false)
      setSlots([])
      setAnswerRect(null)
      nextWord()
    }, CELEBRATION_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lockedTiles.size, currentWord?.level_id])

  function handleSlotsMeasured(measured: Slot[]) {
    setSlots(measured)
    if (measured.length === 0) return
    const minX = Math.min(...measured.map((s) => s.x))
    const minY = Math.min(...measured.map((s) => s.y))
    const maxX = Math.max(...measured.map((s) => s.x + s.width))
    const maxY = Math.max(...measured.map((s) => s.y + s.height))
    setAnswerRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  }

  function handleDragMove(point: Vec2 | null) {
    setHoveredSlotIndex(point ? (findSlotAtPosition(point, slots)?.index ?? null) : null)
  }

  async function playWordAloud() {
    if (!currentWord) return
    await audio.resume()
    void audio.play(currentWord.audio_word_path)
  }

  async function handleSmash() {
    setRevealed(true)
    await playWordAloud()
  }

  async function handleTileDrop(tileId: string, dropPosition: Vec2) {
    setHoveredSlotIndex(null)
    if (!currentWord) return
    const slot = findSlotAtPosition(dropPosition, slots)
    if (!slot) return

    const result = validatePlacement(tileId, slot.index)
    const tile = state.allTiles.find((t) => t.id === tileId)

    if (result.isCorrect) {
      reportEvent(
        buildEvent('placement_correct', state.sessionId, userId, {
          wordId: currentWord.level_id,
          word: currentWord.target_word,
          metadata: { letter: tile?.letter, position: slot.index },
        }),
      )
      await audio.resume()
      const letterAudio = tile ? currentWord.audio_letters[tile.letter] : undefined
      void audio.playSequence([`lang/${langCode}/audios/feedback/correct.wav`, ...(letterAudio ? [letterAudio] : [])])
    } else {
      announce("That's not right. Try again.")
      reportEvent(
        buildEvent('placement_incorrect', state.sessionId, userId, {
          wordId: currentWord.level_id,
          word: currentWord.target_word,
        }),
      )
      void audio.play(`lang/${langCode}/audios/feedback/incorrect.wav`)
      void audio.play(`lang/${langCode}/audios/feedback/bounce.wav`)
      setErrorSlotIndex(slot.index)
      setBounceTileId(tileId)
      setBounceSlot(slot)
      setTimeout(() => {
        setErrorSlotIndex(null)
        setBounceTileId(null)
        setBounceSlot(null)
      }, ERROR_FLASH_MS)
    }
  }

  if (state.status === 'won') {
    return (
      <div className="status-screen">
        <h1>🎉 Game Over!</h1>
        <p>
          Final score: {state.score}/{words.length}
        </p>
        <button type="button" className="button-primary" onClick={onRestart}>
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div
      className="game-board"
      role="main"
      aria-label={currentWord ? `Spelling game: spell the word ${currentWord.target_word}` : 'Spelling game'}
    >
      <GameControls
        score={state.score}
        totalWords={words.length}
        currentIndex={state.currentLevelIndex}
        onReplay={revealed ? () => void playWordAloud() : undefined}
        replayLabel={currentWord ? `Play the word ${currentWord.target_word} again` : undefined}
        onHelp={() => setHelpOpen(true)}
        onSettings={() => {
          /* stubbed for MVP, per UISPEC */
        }}
      />
      <div className="sr-only" role="status" aria-label="Game updates" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
      <div className="play-area" ref={setPlayAreaEl}>
        <GardenBackdrop />
        {currentWord && (
          <AnswerArea
            word={currentWord}
            correctPositions={state.correctPositions}
            hoveredSlotIndex={hoveredSlotIndex}
            errorSlotIndex={errorSlotIndex}
            playAreaEl={playAreaEl}
            onSlotsMeasured={handleSlotsMeasured}
          />
        )}
        {currentWord && (
          <LetterTiles
            key={currentWord.level_id}
            tiles={state.allTiles}
            lockedTiles={state.lockedTiles}
            levelIndex={state.currentLevelIndex}
            playAreaEl={playAreaEl}
            avoidRect={answerRect}
            slots={slots}
            onTileDrop={handleTileDrop}
            onDragMove={handleDragMove}
            onSmash={() => void handleSmash()}
            bounceTileId={bounceTileId}
            bounceSlot={bounceSlot}
          />
        )}
        {celebrating && currentWord && (
          <div
            className={`celebration-overlay celebration-overlay--${currentWord.celebration_animation}`}
            role="status"
          >
            <div className="celebration-overlay__flower-wrap">
              <Flower size={64} />
              {currentWord.celebration_animation === 'confetti' &&
                CONFETTI_PETAL_COLORS.map((color, i) => (
                  <span
                    key={i}
                    className="celebration-petal"
                    style={{ '--angle': `${i * 60}deg`, '--petal-color': color } as CSSProperties}
                  />
                ))}
            </div>
            ✓ Great job!
          </div>
        )}
        {plantedWords.length > 0 && (
          <div className="garden-strip" aria-hidden="true">
            {plantedWords.map((id) => (
              <Flower key={id} size={28} />
            ))}
          </div>
        )}
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
