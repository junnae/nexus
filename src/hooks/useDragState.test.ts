import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDragState } from './useDragState'

const viewportBounds = { width: 400, height: 300 }
const tileSize = 60

describe('useDragState', () => {
  it('tracks drag start and computes offset relative to tile position', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 100, y: 100 }]]))
    })
    act(() => {
      result.current.startDrag('tile-a-0', { x: 100, y: 100 })
    })

    expect(result.current.draggingId).toBe('tile-a-0')
  })

  it('updates tile position during drag, following the pointer', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 100, y: 100 }]]))
    })
    act(() => {
      result.current.startDrag('tile-a-0', { x: 100, y: 100 }) // offset (0,0)
    })
    act(() => {
      result.current.moveDrag({ x: 150, y: 120 })
    })

    expect(result.current.positions.get('tile-a-0')).toEqual({ x: 150, y: 120 })
  })

  it('clamps dragged position to viewport bounds', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 0, y: 0 }]]))
    })
    act(() => {
      result.current.startDrag('tile-a-0', { x: 0, y: 0 })
    })
    act(() => {
      result.current.moveDrag({ x: -100, y: -100 })
    })
    expect(result.current.positions.get('tile-a-0')).toEqual({ x: 0, y: 0 })

    act(() => {
      result.current.moveDrag({ x: 10000, y: 10000 })
    })
    expect(result.current.positions.get('tile-a-0')).toEqual({
      x: viewportBounds.width - tileSize,
      y: viewportBounds.height - tileSize,
    })
  })

  it('emits onTileDrop with the final tile position (offset applied) on drag end', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 0, y: 0 }]]))
    })
    act(() => {
      result.current.startDrag('tile-a-0', { x: 0, y: 0 })
    })
    act(() => {
      result.current.endDrag({ x: 50, y: 60 })
    })

    expect(onTileDrop).toHaveBeenCalledWith('tile-a-0', { x: 50, y: 60 })
    expect(result.current.draggingId).toBeNull()
  })

  it('a plain click (down then up at the same point, no move) reports the tile unmoved', () => {
    // Regression: endDrag used to forward the raw pointer position, ignoring
    // the drag offset. Grabbing a tile anywhere other than its exact
    // top-left (the common case — e.g. its visual center) then releasing
    // without moving made the tile "jump" so that point became its new
    // top-left, even though the user never dragged it.
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 100, y: 100 }]]))
    })
    act(() => {
      // Grab near the tile's center, not its top-left.
      result.current.startDrag('tile-a-0', { x: 130, y: 130 })
    })
    act(() => {
      result.current.endDrag({ x: 130, y: 130 })
    })

    expect(onTileDrop).toHaveBeenCalledWith('tile-a-0', { x: 100, y: 100 })
  })

  it('clamps the drop position to viewport bounds, same as during drag', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => false, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.setInitialPositions(new Map([['tile-a-0', { x: 0, y: 0 }]]))
    })
    act(() => {
      result.current.startDrag('tile-a-0', { x: 0, y: 0 })
    })
    act(() => {
      result.current.endDrag({ x: 10000, y: 10000 })
    })

    expect(onTileDrop).toHaveBeenCalledWith('tile-a-0', {
      x: viewportBounds.width - tileSize,
      y: viewportBounds.height - tileSize,
    })
  })

  it('does not start a drag for a locked tile', () => {
    const onTileDrop = vi.fn()
    const { result } = renderHook(() =>
      useDragState({ isLocked: () => true, onTileDrop, viewportBounds, tileSize }),
    )

    act(() => {
      result.current.startDrag('tile-a-0', { x: 0, y: 0 })
    })

    expect(result.current.draggingId).toBeNull()
  })
})
