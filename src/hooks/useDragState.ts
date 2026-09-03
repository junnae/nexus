import { useCallback, useRef, useState } from 'react'
import type { Vec2 } from '../types/game'

export interface UseDragStateOptions {
  isLocked: (tileId: string) => boolean
  onTileDrop: (tileId: string, dropPosition: Vec2) => void
  viewportBounds: { width: number; height: number }
  tileSize: number
}

export interface UseDragStateResult {
  positions: Map<string, Vec2>
  draggingId: string | null
  setInitialPositions: (positions: Map<string, Vec2>) => void
  startDrag: (tileId: string, pointer: Vec2) => void
  moveDrag: (pointer: Vec2) => void
  endDrag: (pointer: Vec2) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Tracks pointer-driven tile dragging: start/move/end, viewport clamping, locked-tile guard. */
export function useDragState({ isLocked, onTileDrop, viewportBounds, tileSize }: UseDragStateOptions): UseDragStateResult {
  const [positions, setPositions] = useState<Map<string, Vec2>>(new Map())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef<Vec2>({ x: 0, y: 0 })

  const setInitialPositions = useCallback((initial: Map<string, Vec2>) => {
    setPositions(new Map(initial))
  }, [])

  const startDrag = useCallback(
    (tileId: string, pointer: Vec2) => {
      if (isLocked(tileId)) return
      const tilePos = positions.get(tileId) ?? { x: 0, y: 0 }
      dragOffset.current = { x: pointer.x - tilePos.x, y: pointer.y - tilePos.y }
      setDraggingId(tileId)
    },
    [isLocked, positions],
  )

  const moveDrag = useCallback(
    (pointer: Vec2) => {
      if (!draggingId) return
      const rawX = pointer.x - dragOffset.current.x
      const rawY = pointer.y - dragOffset.current.y
      const clamped: Vec2 = {
        x: clamp(rawX, 0, Math.max(0, viewportBounds.width - tileSize)),
        y: clamp(rawY, 0, Math.max(0, viewportBounds.height - tileSize)),
      }
      setPositions((prev) => new Map(prev).set(draggingId, clamped))
    },
    [draggingId, viewportBounds, tileSize],
  )

  const endDrag = useCallback(
    (pointer: Vec2) => {
      if (!draggingId) return
      const id = draggingId
      // Mirror moveDrag's offset/clamp math so the reported drop position
      // always matches where the tile is actually rendered at release. Using
      // the raw pointer here instead made a plain click (down+up with no
      // movement) "push" the tile to wherever it was clicked — usually its
      // center, not its top-left — even though the user never dragged it.
      const rawX = pointer.x - dragOffset.current.x
      const rawY = pointer.y - dragOffset.current.y
      const clamped: Vec2 = {
        x: clamp(rawX, 0, Math.max(0, viewportBounds.width - tileSize)),
        y: clamp(rawY, 0, Math.max(0, viewportBounds.height - tileSize)),
      }
      setDraggingId(null)
      onTileDrop(id, clamped)
    },
    [draggingId, onTileDrop, viewportBounds, tileSize],
  )

  return { positions, draggingId, setInitialPositions, startDrag, moveDrag, endDrag }
}
