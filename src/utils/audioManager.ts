/**
 * Web Audio API wrapper: preloads buffers, plays with low latency, stops the
 * current sound before starting the next (no overlap), and sequences
 * success-chime -> letter -> word playback.
 */
export class AudioManager {
  private context: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()
  private currentSource: AudioBufferSourceNode | null = null

  private getContext(): AudioContext {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.context = new Ctor()
    }
    return this.context
  }

  /** Must be called from a user gesture handler on iOS to unlock playback. */
  async resume(): Promise<void> {
    const ctx = this.getContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
  }

  async load(relativePath: string): Promise<void> {
    if (this.buffers.has(relativePath)) return
    try {
      const response = await fetch(relativePath)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.getContext().decodeAudioData(arrayBuffer)
      this.buffers.set(relativePath, audioBuffer)
    } catch (err) {
      console.debug(`[audioManager] failed to load ${relativePath}`, err)
    }
  }

  async preload(relativePaths: string[]): Promise<void> {
    await Promise.all(relativePaths.map((p) => this.load(p)))
  }

  /** Stops any currently playing sound. */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // already stopped
      }
      this.currentSource = null
    }
  }

  /** Plays a sound immediately, stopping whatever is currently playing. Resolves when playback ends. */
  play(relativePath: string): Promise<void> {
    const buffer = this.buffers.get(relativePath)
    if (!buffer) {
      console.debug(`[audioManager] no buffer loaded for ${relativePath}`)
      return Promise.resolve()
    }

    this.stop()

    const ctx = this.getContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    this.currentSource = source

    return new Promise((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null
        resolve()
      }
      source.start(0)
    })
  }

  /** Plays a sequence of sounds back to back. */
  async playSequence(relativePaths: string[]): Promise<void> {
    for (const path of relativePaths) {
      await this.play(path)
    }
  }
}
