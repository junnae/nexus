import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadWords, WordListLoadError } from './wordListLoader'

const validWord = {
  level_id: 1,
  target_word: 'cat',
  letters: ['c', 'a', 't'],
  foils: [],
  image_path: 'assets/images/cat.png',
  audio_word_path: 'lang/english/audios/words/cat.wav',
  audio_letters: { c: 'x', a: 'x', t: 'x' },
  difficulty: 'easy',
  celebration_animation: 'pop',
}

describe('wordListLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches words from the relative lang path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [validWord],
    })
    vi.stubGlobal('fetch', fetchMock)

    await loadWords('english')

    expect(fetchMock).toHaveBeenCalledWith('lang/english/data/words.json')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl.startsWith('/')).toBe(false)
    expect(calledUrl.startsWith('http')).toBe(false)
  })

  it('parses and sorts words by level_id', async () => {
    const second = { ...validWord, level_id: 2, target_word: 'dog' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [second, validWord] }),
    )

    const words = await loadWords('english')
    expect(words.map((w) => w.level_id)).toEqual([1, 2])
  })

  it('throws a friendly error on a missing words file (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(loadWords('klingon')).rejects.toThrow(WordListLoadError)
  })

  it('throws on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(loadWords('english')).rejects.toThrow(WordListLoadError)
  })

  it('throws on malformed word data (missing required field)', async () => {
    const malformed = { ...validWord }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (malformed as any).audio_letters
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [malformed] }))

    await expect(loadWords('english')).rejects.toThrow(WordListLoadError)
  })

  it('throws on an empty word list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    await expect(loadWords('english')).rejects.toThrow(WordListLoadError)
  })
})
