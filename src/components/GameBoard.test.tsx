import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameBoard } from './GameBoard'
import { installDomMocks, installFetchAndAudioMocks, setUrlParams } from '../../tests/gameBoardTestHelpers'
import type { Word } from '../types/word'

function makeWords(): Word[] {
  return [
    {
      level_id: 1,
      target_word: 'cat',
      letters: ['c', 'a', 't'],
      foils: [],
      image_path: 'assets/images/cat.png',
      audio_word_path: 'lang/english/audios/words/cat.wav',
      audio_letters: { c: 'lang/english/audios/letters/c.wav', a: 'lang/english/audios/letters/a.wav', t: 'lang/english/audios/letters/t.wav' },
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
      audio_letters: { d: 'lang/english/audios/letters/d.wav', o: 'lang/english/audios/letters/o.wav', g: 'lang/english/audios/letters/g.wav' },
      difficulty: 'medium',
      celebration_animation: 'bounce',
    },
  ]
}

describe('GameBoard', () => {
  beforeEach(() => {
    installDomMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reads cr_lang from the URL and fetches that language\'s word list', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-abc-123' })
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />)

    await screen.findByRole('main')
    expect(fetch).toHaveBeenCalledWith('lang/english/data/words.json')
  })

  it('displays the first word (answer area + combined letter tiles) on load, no solution shown', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-abc-123' })
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />)

    await screen.findByRole('main')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3) // 3 answer slots for "cat"
    expect(screen.getByRole('button', { name: 'Letter c' })).toBeInTheDocument()
    expect(screen.getByTestId('tile-tile-c-0')).toHaveClass('letter-tile--assembled')
  })

  it('shows a loading screen before the word list resolves', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-abc-123' })
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // let the pending fetch settle so it doesn't resolve mid-way through a later test
    await screen.findByRole('main')
  })

  it('shows an error screen with a user-friendly message when the word list fails to load', async () => {
    setUrlParams({ cr_lang: 'klingon', cr_user_id: 'user-abc-123' })
    installFetchAndAudioMocks(makeWords(), { failWordList: true })

    render(<GameBoard />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('defaults cr_lang/cr_user_id when absent from the URL, without crashing', async () => {
    setUrlParams({})
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />)

    await screen.findByRole('main')
    expect(fetch).toHaveBeenCalledWith('lang/english/data/words.json')
  })

})
