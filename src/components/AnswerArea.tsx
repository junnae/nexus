import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Word } from '../types/word'
import type { Slot } from '../utils/dragUtils'

export interface AnswerAreaProps {
  word: Word
  correctPositions: Map<number, string>
  hoveredSlotIndex: number | null
  errorSlotIndex: number | null
  /** The play-area DOM node (not a ref object) so effects re-run once it's actually attached. */
  playAreaEl: HTMLElement | null
  onSlotsMeasured: (slots: Slot[]) => void
}

export function AnswerArea({ word, correctPositions, hoveredSlotIndex, errorSlotIndex, playAreaEl, onSlotsMeasured }: AnswerAreaProps) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])

  const measure = () => {
    const playRect = playAreaEl?.getBoundingClientRect()
    if (!playRect) return
    const slots: Slot[] = slotRefs.current.map((el, index) => {
      if (!el) return { index, x: 0, y: 0, width: 0, height: 0 }
      const rect = el.getBoundingClientRect()
      return {
        index,
        x: rect.left - playRect.left,
        y: rect.top - playRect.top,
        width: rect.width,
        height: rect.height,
      }
    })
    onSlotsMeasured(slots)
  }

  useLayoutEffect(() => {
    measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.target_word, playAreaEl])

  useEffect(() => {
    // A window 'resize' event doesn't fire when only the *container* resizes
    // (common in an embedded WebView) — observe the actual play area instead.
    window.addEventListener('resize', measure)
    let observer: ResizeObserver | undefined
    if (playAreaEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(playAreaEl)
    }
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAreaEl])

  const letters = word.target_word.split('')

  return (
    <div className="answer-area" role="listbox" aria-label={`Answer slots for ${letters.join('-')}`}>
      {letters.map((_, index) => {
        const filledLetter = correctPositions.get(index)
        const stateClass = filledLetter
          ? 'answer-slot--filled'
          : errorSlotIndex === index
            ? 'answer-slot--error'
            : hoveredSlotIndex === index
              ? 'answer-slot--hover'
              : ''
        return (
          <div
            key={index}
            ref={(el) => {
              slotRefs.current[index] = el
            }}
            className={`answer-slot ${stateClass}`}
            role="option"
            aria-label={filledLetter ? `Slot ${index + 1}: ${filledLetter}` : `Slot ${index + 1}: empty`}
            data-testid={`answer-slot-${index}`}
          >
            {filledLetter ? filledLetter.toUpperCase() : ''}
          </div>
        )
      })}
    </div>
  )
}
