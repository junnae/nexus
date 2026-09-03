import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudio } from './useAudio'

class FakeAudioBufferSourceNode {
  onended: (() => void) | null = null
  connect() {}
  start() {
    queueMicrotask(() => this.onended?.())
  }
  stop() {}
}

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended'
  destination = {}
  createBufferSource() {
    return new FakeAudioBufferSourceNode()
  }
  async decodeAudioData() {
    return {} as AudioBuffer
  }
  async resume() {
    this.state = 'running'
  }
}

describe('useAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes preload/play/playSequence/resume', () => {
    const { result } = renderHook(() => useAudio())
    expect(typeof result.current.preload).toBe('function')
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.playSequence).toBe('function')
    expect(typeof result.current.resume).toBe('function')
  })

  it('preload triggers a fetch per relative path, no network APIs otherwise', async () => {
    const { result } = renderHook(() => useAudio())
    await result.current.preload(['a.wav', 'b.wav'])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('resume resolves without throwing', async () => {
    const { result } = renderHook(() => useAudio())
    await expect(result.current.resume()).resolves.toBeUndefined()
  })
})
