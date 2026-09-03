import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameBoard } from '../../src/components/GameBoard'
import { installDomMocks, installFetchAndAudioMocks, setUrlParams } from '../gameBoardTestHelpers'
import { verifyOfflineCompliance } from '../../src/utils/offlineChecker'
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
  ]
}

function relativePathsOf(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]))
}

describe('Offline Compliance', () => {
  beforeEach(() => {
    installDomMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('only ever fetches relative paths (no absolute paths, no CDN/http(s) URLs)', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-123' })
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />);
    await screen.findByRole('main')

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const urls = relativePathsOf(fetchMock)

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith('/')).toBe(false)
      expect(url.startsWith('http://')).toBe(false)
      expect(url.startsWith('https://')).toBe(false)
      expect(url).not.toMatch(/cdn|googleapis|cloudflare/i)
    }

    // Spot-check the specific paths DEVSPEC calls out
    expect(urls).toContain('lang/english/data/words.json')
    expect(urls.some((u) => u.includes('lang/english/audios/words/cat.wav'))).toBe(true)
  })

  it('preloads the word-audio path as a relative URL (the read-aloud on tap)', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-123' })
    const words = makeWords()
    installFetchAndAudioMocks(words)

    render(<GameBoard />)
    await screen.findByRole('main')

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const urls = relativePathsOf(fetchMock)
    const audioPath = words[0].audio_word_path
    expect(urls).toContain(audioPath)
    expect(audioPath.startsWith('/')).toBe(false)
    expect(audioPath.startsWith('http')).toBe(false)
  })

  it('reads cr_lang and cr_user_id from the URL for a file:// style path', async () => {
    setUrlParams({ cr_lang: 'english', cr_user_id: 'user-123' })
    installFetchAndAudioMocks(makeWords())

    render(<GameBoard />)
    await screen.findByRole('main')

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledWith('lang/english/data/words.json')
  })

  it('offlineChecker flags an http(s) origin and passes for file://', () => {
    const httpResult = verifyOfflineCompliance({ origin: 'https://example.com', search: '' })
    expect(httpResult.isOffline).toBe(false)

    const fileResult = verifyOfflineCompliance(
      { origin: 'null', search: '?cr_lang=english&cr_user_id=abc' },
      undefined,
    )
    expect(fileResult.isOffline).toBe(true)
    expect(fileResult.warnings).toHaveLength(0)
  })

  it('does not depend on a Service Worker', () => {
    const result = verifyOfflineCompliance(
      { origin: 'null', search: '?cr_lang=english&cr_user_id=abc' },
      { serviceWorker: undefined as unknown as ServiceWorkerContainer },
    )
    expect(result.warnings).toHaveLength(0)
  })
})
