import { useCallback, useMemo } from 'react'
import { AudioManager } from '../utils/audioManager'

export interface UseAudioResult {
  preload: (relativePaths: string[]) => Promise<void>
  play: (relativePath: string) => Promise<void>
  playSequence: (relativePaths: string[]) => Promise<void>
  resume: () => Promise<void>
}

/** Thin React wrapper over AudioManager; one manager instance per GameBoard mount. */
export function useAudio(): UseAudioResult {
  const manager = useMemo(() => new AudioManager(), [])

  const preload = useCallback((paths: string[]) => manager.preload(paths), [manager])
  const play = useCallback((path: string) => manager.play(path), [manager])
  const playSequence = useCallback((paths: string[]) => manager.playSequence(paths), [manager])
  const resume = useCallback(() => manager.resume(), [manager])

  return { preload, play, playSequence, resume }
}
