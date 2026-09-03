import { useCallback, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { DropValidationResult, GameState, Tile } from '../types/game'
import type { Word } from '../types/word'

/** Points awarded for completing a word. MVP has no partial credit or foils. */
export const POINTS_PER_WORD = 1

function buildTiles(word: Word): Tile[] {
  return word.letters.map((letter, index) => ({
    id: `tile-${letter}-${index}`,
    letter,
    isCorrect: true, // MVP ships with no foils (PRD non-goal for v1.0)
    expectedPosition: index,
  }))
}

function buildStateForLevel(words: Word[], levelIndex: number, sessionId: string, previousScore: number): GameState {
  const currentWord = words[levelIndex] ?? null
  return {
    currentLevelIndex: levelIndex,
    currentWord,
    allTiles: currentWord ? buildTiles(currentWord) : [],
    lockedTiles: new Set(),
    tilePositions: new Map(),
    correctPositions: new Map(),
    score: previousScore,
    sessionId,
    status: currentWord ? 'playing' : 'won',
    errorMessage: null,
  }
}

export interface UseGameLogicResult {
  state: GameState
  validatePlacement: (tileId: string, wordPosition: number) => DropValidationResult
  isWordComplete: () => boolean
  nextWord: () => void
  setError: (message: string) => void
}

/** Owns game session state: word progression, placement validation, locking, scoring. */
export function useGameLogic(words: Word[]): UseGameLogicResult {
  const sessionId = useMemo(() => uuidv4(), [])
  const [state, setState] = useState<GameState>(() => buildStateForLevel(words, 0, sessionId, 0))

  const isWordComplete = useCallback((): boolean => {
    return state.currentWord !== null && state.lockedTiles.size >= state.currentWord.letters.length
  }, [state.currentWord, state.lockedTiles])

  const validatePlacement = useCallback(
    (tileId: string, wordPosition: number): DropValidationResult => {
      const { currentWord, allTiles } = state
      if (!currentWord) {
        return { tileId, wordPosition, isCorrect: false }
      }
      const tile = allTiles.find((t) => t.id === tileId)
      const isCorrect = !!tile && currentWord.target_word[wordPosition] === tile.letter

      if (isCorrect && tile) {
        setState((prev) => {
          const lockedTiles = new Set(prev.lockedTiles)
          lockedTiles.add(tileId)
          const correctPositions = new Map(prev.correctPositions)
          correctPositions.set(wordPosition, tile.letter)
          return { ...prev, lockedTiles, correctPositions }
        })
      }

      return { tileId, wordPosition, isCorrect }
    },
    [state],
  )

  const nextWord = useCallback(() => {
    setState((prev) => {
      const completedWord = prev.currentWord !== null
      const nextIndex = prev.currentLevelIndex + 1
      const newScore = completedWord ? prev.score + POINTS_PER_WORD : prev.score
      if (nextIndex >= words.length) {
        return { ...prev, status: 'won', score: newScore }
      }
      return buildStateForLevel(words, nextIndex, prev.sessionId, newScore)
    })
  }, [words])

  const setError = useCallback((message: string) => {
    setState((prev) => ({ ...prev, status: 'error', errorMessage: message }))
  }, [])

  return { state, validatePlacement, isWordComplete, nextWord, setError }
}
