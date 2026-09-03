import { fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Word } from '../src/types/word'

const SLOT_Y = 400
const SLOT_WIDTH = 70
const SLOT_GAP = 100

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON: () => {},
  } as DOMRect
}

/** Slot rects are spaced out and distinguishable by index; everything else is a fixed 800x600 play area. */
export function installDomMocks() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const testId = this.getAttribute('data-testid') ?? ''
    if (testId.startsWith('answer-slot-')) {
      const index = Number(testId.slice('answer-slot-'.length))
      return rect(50 + index * SLOT_GAP, SLOT_Y, SLOT_WIDTH, SLOT_WIDTH)
    }
    return rect(0, 0, 800, 600)
  })
}

export function slotCenter(index: number): { x: number; y: number } {
  return { x: 50 + index * SLOT_GAP + SLOT_WIDTH / 2, y: SLOT_Y + SLOT_WIDTH / 2 }
}

class FakeAudioBufferSourceNode {
  onended: (() => void) | null = null
  connect() {}
  start() {
    queueMicrotask(() => this.onended?.())
  }
  stop() {}
}

class FakeAudioContext {
  state: 'suspended' | 'running' = 'running'
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

/** Serves the given word list for lang/*.../words.json, arraybuffers for everything else (audio/images). */
export function installFetchAndAudioMocks(words: Word[], options: { failWordList?: boolean } = {}) {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('words.json')) {
        if (options.failWordList) {
          return { ok: false, status: 404 } as Response
        }
        return { ok: true, json: async () => words } as unknown as Response
      }
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response
    }),
  )
}

export function setUrlParams(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString()
  window.history.pushState({}, '', `/?${search}`)
}

/** Taps the combined word to reveal it (plays audio, scatters the letters). */
export function revealWord() {
  const tile = screen.getAllByRole('button', { name: /^Letter /i })[0]
  fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 })
  fireEvent.pointerUp(tile, { clientX: 10, clientY: 10, pointerId: 1 })
}

export function dropLetter(letter: string, slotIndex: number) {
  const tile = screen.getByRole('button', { name: `Letter ${letter}` }) as HTMLElement
  // Grab at the tile's own current position (not the slot) so the drag
  // offset is zero — endDrag reports the offset-corrected position, so
  // starting the "drag" anywhere else would land short of the slot.
  const startX = parseFloat(tile.style.left)
  const startY = parseFloat(tile.style.top)
  const { x, y } = slotCenter(slotIndex)
  fireEvent.pointerDown(tile, { clientX: startX, clientY: startY, pointerId: 1 })
  fireEvent.pointerMove(tile, { clientX: x, clientY: y, pointerId: 1 })
  fireEvent.pointerUp(tile, { clientX: x, clientY: y, pointerId: 1 })
}

/** Reveals the word, then drags each letter into its correct slot in order. */
export function spellWord(word: Word) {
  revealWord()
  word.letters.forEach((letter, index) => dropLetter(letter, index))
}
