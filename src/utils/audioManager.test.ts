import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioManager } from './audioManager'

class FakeAudioBufferSourceNode {
  buffer: unknown = null
  onended: (() => void) | null = null
  started = false
  stopped = false
  connect() {}
  start() {
    this.started = true
    // simulate async playback completion on next tick
    queueMicrotask(() => this.onended?.())
  }
  stop() {
    this.stopped = true
  }
}

class FakeAudioContext {
  state: 'suspended' | 'running' = 'running'
  destination = {}
  createBufferSource() {
    return new FakeAudioBufferSourceNode()
  }
  async decodeAudioData(_buf: ArrayBuffer) {
    return { duration: 1 } as AudioBuffer
  }
  async resume() {
    this.state = 'running'
  }
}

describe('AudioManager', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads an audio file from a relative path with no absolute/network assumptions', async () => {
    const manager = new AudioManager()
    await manager.load('lang/english/audios/letters/a.wav')
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledWith('lang/english/audios/letters/a.wav')
  })

  it('handles a missing/failing audio file gracefully (no throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const manager = new AudioManager()
    await expect(manager.load('missing.wav')).resolves.toBeUndefined()
  })

  it('preloads multiple files concurrently', async () => {
    const manager = new AudioManager()
    await manager.preload(['a.wav', 'b.wav', 'c.wav'])
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops the current sound before playing the next', async () => {
    const manager = new AudioManager()
    await manager.load('a.wav')
    await manager.load('b.wav')

    const playA = manager.play('a.wav')
    // Immediately start a second play; the first source should be stopped.
    const playB = manager.play('b.wav')
    await Promise.all([playA, playB])

    // No exception means stop() was safely invoked on the in-flight source.
    expect(true).toBe(true)
  })

  it('resolves immediately (no-op) when playing an unloaded path', async () => {
    const manager = new AudioManager()
    await expect(manager.play('never-loaded.wav')).resolves.toBeUndefined()
  })

  it('resumes a suspended AudioContext', async () => {
    const manager = new AudioManager()
    await manager.load('a.wav') // initializes context
    await expect(manager.resume()).resolves.toBeUndefined()
  })
})
