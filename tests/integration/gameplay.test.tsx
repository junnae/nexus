import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameBoard } from '../../src/components/GameBoard'
import { dropLetter, installDomMocks, installFetchAndAudioMocks, revealWord, setUrlParams, spellWord } from '../gameBoardTestHelpers'
import type { Word } from '../../src/types/word'

function makeWords(): Word[] {
  return [
    {
      level_id: 1,
      target_word: 'cat',
      letters: ['c', 'a', 't'],
      foils: [],
      image_path: 'assets/images/cat.png',
      audio_word_path: 'lang/english/audios/words/cat.wav',
      audio_letters: {
        c: 'lang/english/audios/letters/c.wav',
        a: 'lang/english/audios/letters/a.wav',
        t: 'lang/english/audios/letters/t.wav',
      },
      difficulty: 'easy',
      celebration_animation: 'pop',
    },
    {
      level_id: 2,
      target_word: 'dog',
      letters: ['d', 'o', 'g'],
      foils: [],
      image_path: 'assets/images/dog.png',
      audio_word_path: 'lang/english/audios/words/dog.wav',
      audio_letters: {
        d: 'lang/english/audios/letters/d.wav',
        o: 'lang/english/audios/letters/o.wav',
        g: 'lang/english/audios/letters/g.wav',
      },
      difficulty: 'medium',
      celebration_animation: 'bounce',
    },
  ]
}

describe('Gameplay Integration', () => {
  beforeEach(() => {
    installDomMocks()
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-test-123' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('completes a full game session across both words and shows the game-end screen', async () => {
    const words = makeWords()
    installFetchAndAudioMocks(words)

    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameBoard />)

    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())

    // Word 1: "cat"
    spellWord(words[0])
    await waitFor(() => expect(screen.getByText('✓ Great job!')).toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500) // celebration -> advance to word 2
    })

    await waitFor(() => expect(screen.getByRole('group', { name: /tap the word dog/i })).toBeInTheDocument())
    expect(screen.getByText('Score: 1/2')).toBeInTheDocument()

    // Word 2: "dog" (final word)
    spellWord(words[1])
    await waitFor(() => expect(screen.getByText('✓ Great job!')).toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500) // celebration -> game end
    })

    await waitFor(() => expect(screen.getByText('🎉 Game Over!')).toBeInTheDocument())
    expect(screen.getByText('Final score: 2/2')).toBeInTheDocument()
  })

  it('starts combined (no solution shown); tapping reveals it and lets the child drag', async () => {
    const words = [makeWords()[0]]
    installFetchAndAudioMocks(words)

    render(<GameBoard />)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())

    // No image/text solution is displayed; the word is combined letter-tiles.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /tap the word cat/i })).toBeInTheDocument()
    expect(screen.getByTestId('tile-tile-c-0')).toHaveClass('letter-tile--assembled')
    expect(screen.queryByRole('button', { name: /play the word .* again/i })).not.toBeInTheDocument()

    revealWord()

    expect(screen.getByRole('group', { name: /letter tiles: c, a, t/i })).toBeInTheDocument()
    expect(screen.getByTestId('tile-tile-c-0')).not.toHaveClass('letter-tile--assembled')
    expect(screen.getByRole('button', { name: 'Play the word cat again' })).toBeInTheDocument()
  })

  it('still completes the word after an earlier incorrect placement', async () => {
    const words = [makeWords()[0]]
    installFetchAndAudioMocks(words)

    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameBoard />)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())

    revealWord()
    dropLetter('c', 1) // wrong slot for 'c' (belongs at 0)
    expect(screen.getByTestId('answer-slot-1')).toHaveClass('answer-slot--error')

    dropLetter('c', 0)
    dropLetter('a', 1)
    dropLetter('t', 2)

    await waitFor(() => expect(screen.getByText('✓ Great job!')).toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    await waitFor(() => expect(screen.getByText('🎉 Game Over!')).toBeInTheDocument())
    expect(screen.getByText('Final score: 1/1')).toBeInTheDocument()
  })

  it('reports session_start, word_started, placement_correct and word_completed via cr_event', async () => {
    const words = [makeWords()[0]]
    installFetchAndAudioMocks(words)
    const crEvent = vi.fn()
    window.cr_event = crEvent

    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameBoard />)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())

    spellWord(words[0])
    await waitFor(() => expect(screen.getByText('✓ Great job!')).toBeInTheDocument())

    const eventTypes = crEvent.mock.calls.map((call) => call[0].eventType)
    expect(eventTypes).toContain('session_start')
    expect(eventTypes).toContain('word_started')
    expect(eventTypes.filter((t) => t === 'placement_correct')).toHaveLength(3)
    expect(eventTypes).toContain('word_completed')

    delete (window as unknown as { cr_event?: unknown }).cr_event
  })

  it('announces an incorrect placement and word completion to screen readers', async () => {
    const words = [makeWords()[0]]
    installFetchAndAudioMocks(words)

    render(<GameBoard />)
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())

    revealWord()
    dropLetter('c', 1)
    expect(screen.getByRole('status', { name: 'Game updates' })).toHaveTextContent("That's not right. Try again.")

    dropLetter('c', 0)
    dropLetter('a', 1)
    dropLetter('t', 2)

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Game updates' })).toHaveTextContent(
        'You spelled cat! Word 1 of 1. Score: 1 correct out of 1 words.',
      ),
    )
  })
})
