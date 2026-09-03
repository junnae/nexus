import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AnswerArea } from './AnswerArea'
import type { Word } from '../types/word'

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    level_id: 1,
    target_word: 'cat',
    letters: ['c', 'a', 't'],
    foils: [],
    image_path: 'assets/images/cat.png',
    audio_word_path: 'lang/english/audios/words/cat.wav',
    audio_letters: {},
    difficulty: 'easy',
    celebration_animation: 'pop',
    ...overrides,
  }
}

function Harness(props: { word: Word; correctPositions?: Map<number, string>; hoveredSlotIndex?: number | null; errorSlotIndex?: number | null; onSlotsMeasured?: (s: unknown[]) => void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setEl}>
      <AnswerArea
        word={props.word}
        correctPositions={props.correctPositions ?? new Map()}
        hoveredSlotIndex={props.hoveredSlotIndex ?? null}
        errorSlotIndex={props.errorSlotIndex ?? null}
        playAreaEl={el}
        onSlotsMeasured={props.onSlotsMeasured ?? (() => {})}
      />
    </div>
  )
}

describe('AnswerArea', () => {
  it('renders N slots for an N-letter word', () => {
    render(<Harness word={makeWord({ target_word: 'cat' })} />)
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('shows the locked letter for a filled/correct slot', () => {
    render(<Harness word={makeWord()} correctPositions={new Map([[0, 'c']])} />)
    expect(screen.getByTestId('answer-slot-0')).toHaveTextContent('C')
    expect(screen.getByTestId('answer-slot-0')).toHaveClass('answer-slot--filled')
  })

  it('applies hover class to the hovered empty slot', () => {
    render(<Harness word={makeWord()} hoveredSlotIndex={1} />)
    expect(screen.getByTestId('answer-slot-1')).toHaveClass('answer-slot--hover')
  })

  it('applies error class to the error slot', () => {
    render(<Harness word={makeWord()} errorSlotIndex={2} />)
    expect(screen.getByTestId('answer-slot-2')).toHaveClass('answer-slot--error')
  })

  it('labels empty slots for accessibility', () => {
    render(<Harness word={makeWord()} />)
    expect(screen.getByLabelText('Slot 1: empty')).toBeInTheDocument()
  })

  it('reports measured slots to the parent on mount', () => {
    const onSlotsMeasured = vi.fn()
    render(<Harness word={makeWord()} onSlotsMeasured={onSlotsMeasured} />)
    expect(onSlotsMeasured).toHaveBeenCalled()
    const slots = onSlotsMeasured.mock.calls[0][0] as unknown[]
    expect(slots).toHaveLength(3)
  })
})
