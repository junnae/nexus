import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGameLogic } from './useGameLogic'
import type { Word } from '../types/word'

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    level_id: 1,
    target_word: 'cat',
    letters: ['c', 'a', 't'],
    foils: [],
    image_path: 'assets/images/cat.png',
    audio_word_path: 'lang/english/audios/words/cat.wav',
    audio_letters: { c: 'c.wav', a: 'a.wav', t: 't.wav' },
    difficulty: 'easy',
    celebration_animation: 'pop',
    ...overrides,
  }
}

describe('useGameLogic', () => {
  it('initializes with the first word and playing status', () => {
    const words = [makeWord()]
    const { result } = renderHook(() => useGameLogic(words))

    expect(result.current.state.currentLevelIndex).toBe(0)
    expect(result.current.state.currentWord?.target_word).toBe('cat')
    expect(result.current.state.status).toBe('playing')
    expect(result.current.state.score).toBe(0)
  })

  it('generates a UUID-shaped sessionId', () => {
    const { result } = renderHook(() => useGameLogic([makeWord()]))
    expect(result.current.state.sessionId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('validates a correct placement and locks the tile', () => {
    const { result } = renderHook(() => useGameLogic([makeWord()]))
    const tileId = result.current.state.allTiles.find((t) => t.letter === 'c')!.id

    let validation
    act(() => {
      validation = result.current.validatePlacement(tileId, 0)
    })

    expect(validation).toEqual({ tileId, wordPosition: 0, isCorrect: true })
    expect(result.current.state.lockedTiles.has(tileId)).toBe(true)
  })

  it('validates an incorrect placement and does not lock the tile', () => {
    const { result } = renderHook(() => useGameLogic([makeWord()]))
    const tileId = result.current.state.allTiles.find((t) => t.letter === 'c')!.id

    let validation
    act(() => {
      // 'c' does not belong at position 1 ('a' does)
      validation = result.current.validatePlacement(tileId, 1)
    })

    expect(validation).toEqual({ tileId, wordPosition: 1, isCorrect: false })
    expect(result.current.state.lockedTiles.has(tileId)).toBe(false)
  })

  it('detects word completion once all letters are correctly placed', () => {
    const { result } = renderHook(() => useGameLogic([makeWord()]))
    const tiles = result.current.state.allTiles

    act(() => {
      tiles.forEach((tile, i) => result.current.validatePlacement(tile.id, i))
    })

    expect(result.current.isWordComplete()).toBe(true)
  })

  it('advances to the next word and increments score', () => {
    const words = [makeWord({ level_id: 1, target_word: 'cat' }), makeWord({ level_id: 2, target_word: 'dog', letters: ['d', 'o', 'g'] })]
    const { result } = renderHook(() => useGameLogic(words))

    act(() => {
      result.current.nextWord()
    })

    expect(result.current.state.currentLevelIndex).toBe(1)
    expect(result.current.state.currentWord?.target_word).toBe('dog')
    expect(result.current.state.score).toBe(1)
    // locked tiles / correct positions reset for the new word
    expect(result.current.state.lockedTiles.size).toBe(0)
  })

  it('sets status to won after completing the final word', () => {
    const words = [makeWord()]
    const { result } = renderHook(() => useGameLogic(words))

    act(() => {
      result.current.nextWord()
    })

    expect(result.current.state.status).toBe('won')
    expect(result.current.state.score).toBe(1)
  })

  it('setError transitions status to error with a message', () => {
    const { result } = renderHook(() => useGameLogic([makeWord()]))
    act(() => {
      result.current.setError('Something broke')
    })
    expect(result.current.state.status).toBe('error')
    expect(result.current.state.errorMessage).toBe('Something broke')
  })
})
