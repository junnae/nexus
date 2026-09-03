import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LetterTiles } from './LetterTiles'
import type { Tile, Vec2 } from '../types/game'
import { isCollision, type Rect, type Slot } from '../utils/dragUtils'

const tiles: Tile[] = [
  { id: 'tile-c-0', letter: 'c', isCorrect: true, expectedPosition: 0 },
  { id: 'tile-a-1', letter: 'a', isCorrect: true, expectedPosition: 1 },
  { id: 'tile-t-2', letter: 't', isCorrect: true, expectedPosition: 2 },
]

const avoidRect: Rect = { x: 300, y: 200, width: 200, height: 150 }
const slots: Slot[] = [
  { index: 0, x: 300, y: 200, width: 70, height: 70 },
  { index: 1, x: 380, y: 200, width: 70, height: 70 },
  { index: 2, x: 460, y: 200, width: 70, height: 70 },
]
const TILE_SIZE = 60

interface HarnessProps {
  lockedTiles?: Set<string>
  onTileDrop?: (id: string, pos: Vec2) => void
  onSmash?: () => void
  bounceTileId?: string | null
  bounceSlot?: Slot | null
}

function Harness(props: HarnessProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setEl} style={{ width: 800, height: 600 }}>
      <LetterTiles
        tiles={tiles}
        lockedTiles={props.lockedTiles ?? new Set()}
        levelIndex={1}
        playAreaEl={el}
        avoidRect={avoidRect}
        slots={slots}
        onTileDrop={props.onTileDrop ?? (() => {})}
        onSmash={props.onSmash}
        bounceTileId={props.bounceTileId}
        bounceSlot={props.bounceSlot}
      />
    </div>
  )
}

/** Taps the first tile to reveal (leave the combined state) and start scattering. */
function reveal() {
  const tile = screen.getAllByRole('button')[0]
  fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 })
  fireEvent.pointerUp(tile, { clientX: 10, clientY: 10, pointerId: 1 })
}

function tilePosition(testId: string): Vec2 {
  const el = screen.getByTestId(testId) as HTMLElement
  return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }
}

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => {},
  })
  // jsdom does not implement pointer capture
  Element.prototype.setPointerCapture = vi.fn()
})

describe('LetterTiles', () => {
  it('renders one tile per letter', () => {
    render(<Harness />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders locked tiles as disabled and non-draggable-looking', () => {
    render(<Harness lockedTiles={new Set(['tile-c-0'])} />)
    expect(screen.getByTestId('tile-tile-c-0')).toBeDisabled()
    expect(screen.getByTestId('tile-tile-c-0')).toHaveClass('letter-tile--locked')
  });

  it('centers a locked tile on its answer slot, not the slot\'s raw top-left corner', () => {
    // Regression: a locked tile used to render at {x: slot.x, y: slot.y} —
    // the slot's top-left corner — which looked visibly off-center since
    // slots (70px) are larger than tiles (60px).
    render(<Harness lockedTiles={new Set(['tile-c-0'])} />)
    const slot = slots[0] // tile-c-0's expectedPosition is 0
    expect(tilePosition('tile-tile-c-0')).toEqual({
      x: slot.x + (slot.width - TILE_SIZE) / 2,
      y: slot.y + (slot.height - TILE_SIZE) / 2,
    })
  });

  ['tile-a-1', 'tile-t-2'].forEach((id) => {
    it(`tile ${id} stays enabled when not locked`, () => {
      render(<Harness lockedTiles={new Set(['tile-c-0'])} />)
      expect(screen.getByTestId(`tile-${id}`)).not.toBeDisabled()
    })
  })

  describe('combined (pre-reveal) state', () => {
    it('starts assembled, with a tap-hint class and group label', () => {
      render(<Harness />)
      expect(screen.getByTestId('tile-tile-c-0')).toHaveClass('letter-tile--assembled')
      expect(screen.getByRole('group', { name: /tap the word cat/i })).toBeInTheDocument()
    })

    it('positions each tile centered on its matching answer slot', () => {
      render(<Harness />)
      tiles.forEach((tile) => {
        const slot = slots[tile.expectedPosition!]
        const pos = tilePosition(`tile-${tile.id}`)
        expect(pos).toEqual({ x: slot.x + (slot.width - TILE_SIZE) / 2, y: slot.y + (slot.height - TILE_SIZE) / 2 })
      })
    })

    it('tapping a tile calls onSmash instead of starting a drag', () => {
      const onSmash = vi.fn()
      const onTileDrop = vi.fn()
      render(<Harness onSmash={onSmash} onTileDrop={onTileDrop} />)

      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 })
      fireEvent.pointerMove(tile, { clientX: 60, clientY: 40, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: 60, clientY: 40, pointerId: 1 })

      expect(onSmash).toHaveBeenCalledTimes(1)
      expect(onTileDrop).not.toHaveBeenCalled()
    })

    it('tapping reveals: tiles lose the assembled class and become draggable', () => {
      render(<Harness />)
      reveal()
      expect(screen.getByTestId('tile-tile-c-0')).not.toHaveClass('letter-tile--assembled')
      expect(screen.getByRole('group', { name: /letter tiles: c, a, t/i })).toBeInTheDocument()
    })
  })

  describe('after reveal', () => {
    it('follows the pointer while dragging and emits the tile center on release', () => {
      const onTileDrop = vi.fn()
      render(<Harness onTileDrop={onTileDrop} />)
      reveal()

      // Grab exactly at the tile's own current position so the drag offset
      // is zero, making the expected final position unambiguous.
      const startPos = tilePosition('tile-tile-c-0')
      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: startPos.x, clientY: startPos.y, pointerId: 1 })
      fireEvent.pointerMove(tile, { clientX: 550, clientY: 520, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: 550, clientY: 520, pointerId: 1 })

      expect(onTileDrop).toHaveBeenCalledTimes(1)
      const [droppedId, position] = onTileDrop.mock.calls[0]
      expect(droppedId).toBe('tile-c-0')
      expect(position).toEqual({ x: 550 + TILE_SIZE / 2, y: 520 + TILE_SIZE / 2 })
    })

    it('a plain click (no movement) does not move the tile', () => {
      // Regression: releasing at the raw pointer position (rather than the
      // offset-corrected position) made grabbing a tile anywhere but its
      // exact top-left corner — its visual center, say — "push" it there on
      // release, even with zero actual dragging.
      const onTileDrop = vi.fn()
      render(<Harness onTileDrop={onTileDrop} />)
      reveal()

      const before = tilePosition('tile-tile-c-0')
      // Click somewhere in the middle of the tile's own footprint, not its
      // top-left corner — the realistic case for a user just tapping it.
      const clickX = before.x + TILE_SIZE / 2
      const clickY = before.y + TILE_SIZE / 2
      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: clickX, clientY: clickY, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: clickX, clientY: clickY, pointerId: 1 })

      expect(tilePosition('tile-tile-c-0')).toEqual(before)
    })

    it('does not start a drag or emit onTileDrop for a locked tile', () => {
      const onTileDrop = vi.fn()
      render(<Harness lockedTiles={new Set(['tile-c-0'])} onTileDrop={onTileDrop} />)
      reveal()

      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 })
      fireEvent.pointerMove(tile, { clientX: 60, clientY: 40, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: 60, clientY: 40, pointerId: 1 })

      expect(onTileDrop).not.toHaveBeenCalled()
    })

    it('does not nudge a drop that only comes near another tile without truly overlapping it', () => {
      render(<Harness />)
      reveal()

      const startPos = tilePosition('tile-tile-c-0')
      const targetPos = tilePosition('tile-tile-a-1')
      // Just outside the tile's own footprint (>= TILE_SIZE away), so the two
      // tiles are adjacent but not overlapping — this should land exactly
      // where dropped, not get pushed further away. Grabbing at the tile's
      // own current position keeps the drag offset zero, so the move target
      // is exactly the final drop point.
      const dropX = targetPos.x + TILE_SIZE
      const dropY = targetPos.y
      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: startPos.x, clientY: startPos.y, pointerId: 1 })
      fireEvent.pointerMove(tile, { clientX: dropX, clientY: dropY, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: dropX, clientY: dropY, pointerId: 1 })

      expect(tilePosition('tile-tile-c-0')).toEqual({ x: dropX, y: dropY })
    })

    it('resolves overlap: dropping a tile onto another tile pushes it clear', () => {
      render(<Harness />)
      reveal()

      const startPos = tilePosition('tile-tile-c-0')
      const targetPos = tilePosition('tile-tile-a-1')
      const tile = screen.getByTestId('tile-tile-c-0')
      fireEvent.pointerDown(tile, { clientX: startPos.x, clientY: startPos.y, pointerId: 1 })
      fireEvent.pointerMove(tile, { clientX: targetPos.x, clientY: targetPos.y, pointerId: 1 })
      fireEvent.pointerUp(tile, { clientX: targetPos.x, clientY: targetPos.y, pointerId: 1 })

      const finalC = tilePosition('tile-tile-c-0')
      const finalA = tilePosition('tile-tile-a-1')
      const rectC: Rect = { x: finalC.x, y: finalC.y, width: TILE_SIZE, height: TILE_SIZE }
      const rectA: Rect = { x: finalA.x, y: finalA.y, width: TILE_SIZE, height: TILE_SIZE }
      expect(isCollision(rectC, rectA)).toBe(false)
    })
  })

  describe('bounce (incorrect drop)', () => {
    it('applies the bounce class and moves the tile away from the slot', () => {
      const { rerender } = render(<Harness />)
      reveal()

      const before = tilePosition('tile-tile-c-0')
      const slot: Slot = { index: 0, x: before.x, y: before.y, width: 70, height: 70 }

      rerender(<Harness bounceTileId="tile-c-0" bounceSlot={slot} />)

      expect(screen.getByTestId('tile-tile-c-0')).toHaveClass('letter-tile--bounce')
      const after = tilePosition('tile-tile-c-0')
      expect(after).not.toEqual(before)
    })

    it('does not apply the bounce class to other tiles', () => {
      render(<Harness bounceTileId="tile-c-0" bounceSlot={{ index: 0, x: 0, y: 0, width: 70, height: 70 }} />)
      expect(screen.getByTestId('tile-tile-a-1')).not.toHaveClass('letter-tile--bounce')
    })
  })
})
