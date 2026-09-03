import type { Word } from './word'

export interface Vec2 {
  x: number
  y: number
}

export interface Tile {
  id: string // unique id (letter + index if duplicate)
  letter: string
  isCorrect: boolean // appears in target word?
  expectedPosition: number | null // position in word, if correct
}

export type GameStatus = 'loading' | 'playing' | 'won' | 'error'

export interface GameState {
  currentLevelIndex: number
  currentWord: Word | null
  allTiles: Tile[]
  lockedTiles: Set<string>
  tilePositions: Map<string, Vec2>
  correctPositions: Map<number, string> // slot index -> letter
  score: number
  sessionId: string
  status: GameStatus
  errorMessage: string | null
}

export interface DropValidationResult {
  tileId: string
  wordPosition: number
  isCorrect: boolean
}
