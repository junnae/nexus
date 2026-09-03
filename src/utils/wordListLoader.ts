import type { Word } from '../types/word'

export class WordListLoadError extends Error {}

function isValidWord(value: unknown): value is Word {
  if (typeof value !== 'object' || value === null) return false
  const w = value as Record<string, unknown>
  return (
    typeof w.level_id === 'number' &&
    typeof w.target_word === 'string' &&
    Array.isArray(w.letters) &&
    Array.isArray(w.foils) &&
    typeof w.image_path === 'string' &&
    typeof w.audio_word_path === 'string' &&
    typeof w.audio_letters === 'object' &&
    w.audio_letters !== null &&
    typeof w.difficulty === 'string' &&
    typeof w.celebration_animation === 'string'
  )
}

/**
 * Loads the word list for a language from its relative path
 * (lang/<langCode>/data/words.json), sorted by level_id.
 */
export async function loadWords(langCode: string): Promise<Word[]> {
  const url = `lang/${langCode}/data/words.json`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new WordListLoadError(`Failed to load word list for language "${langCode}".`)
  }

  if (!response.ok) {
    throw new WordListLoadError(`Word list not found for language "${langCode}" (${response.status}).`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new WordListLoadError(`Word list for "${langCode}" is not valid JSON.`)
  }

  if (!Array.isArray(data) || data.length === 0 || !data.every(isValidWord)) {
    throw new WordListLoadError(`Word list for "${langCode}" is malformed.`)
  }

  return [...(data as Word[])].sort((a, b) => a.level_id - b.level_id)
}
