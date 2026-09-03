import { useEffect, useLayoutEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Tile, Vec2 } from '../types/game'
import {
  alignPositionsToSlots,
  bounceAwayFromSlot,
  generateRandomPositions,
  resolveOverlaps,
  type Rect,
  type Slot,
} from '../utils/dragUtils'
import { useDragState } from '../hooks/useDragState'

export interface LetterTilesProps {
  tiles: Tile[]
  lockedTiles: Set<string>
  levelIndex: number
  /** The play-area DOM node (not a ref object) so effects re-run once it's actually attached. */
  playAreaEl: HTMLElement | null
  avoidRect: Rect | null
  /** Measured answer slots, one per word position — the combined word sits on these until revealed. */
  slots: Slot[]
  onTileDrop: (tileId: string, dropPosition: Vec2) => void
  onDragMove?: (point: Vec2 | null) => void
  /** Called once, when the child taps the combined word to reveal it. */
  onSmash?: () => void
  /** The tile that should visibly bounce away from `bounceSlot` (incorrect drop). */
  bounceTileId?: string | null
  bounceSlot?: Slot | null
}

function readTileSize(): number {
  if (typeof window === 'undefined') return 60
  const value = getComputedStyle(document.documentElement).getPropertyValue('--tile-size')
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
}

function centerOfTile(position: Vec2, tileSize: number): Vec2 {
  return {
    x: position.x + tileSize / 2,
    y: position.y + tileSize / 2,
  }
}

export function LetterTiles({
  tiles,
  lockedTiles,
  levelIndex,
  playAreaEl,
  avoidRect,
  slots,
  onTileDrop,
  onDragMove,
  onSmash,
  bounceTileId,
  bounceSlot,
}: LetterTilesProps) {
  const [viewportBounds, setViewportBounds] = useState({ width: 0, height: 0 })
  const [tileSize, setTileSize] = useState(readTileSize)
  const [assembled, setAssembled] = useState(true)

  const isLocked = (tileId: string) => lockedTiles.has(tileId)

  // Locked tiles snap to their answer slot, centered the same way the
  // combined (pre-reveal) tiles are — computed here rather than passed down,
  // so there's one formula for "tile centered on slot N", not two that could
  // drift out of sync (a locked tile used to sit at the slot's raw top-left,
  // which looked visibly off-center since slots are larger than tiles).
  const lockedPositions = useMemo(() => {
    const map = new Map<string, Vec2>()
    if (slots.length === 0) return map
    const slotPositions = alignPositionsToSlots(slots, tileSize)
    for (const tile of tiles) {
      if (tile.expectedPosition === null) continue
      const pos = slotPositions[tile.expectedPosition]
      if (pos) map.set(tile.id, pos)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tileSize, tiles])

  function otherTilePosition(tileId: string): Vec2 | undefined {
    return lockedTiles.has(tileId) ? lockedPositions.get(tileId) : positions.get(tileId)
  }

  function handleInternalDrop(tileId: string, dropPosition: Vec2) {
    const others = tiles
      .filter((t) => t.id !== tileId)
      .map((t) => otherTilePosition(t.id))
      .filter((p): p is Vec2 => p !== undefined)
    // padding=0: only correct a drop that would genuinely overlap another
    // tile. A padding buffer here made ordinary drops near (but not on) a
    // tile snap away unexpectedly, which read as random/unwanted bouncing.
    const resolved = resolveOverlaps(dropPosition, tileSize, others, viewportBounds, 0)
    setPositionFor(tileId, resolved)
    onTileDrop(tileId, centerOfTile(dropPosition, tileSize))
  }

  const { positions, draggingId, setInitialPositions, startDrag, moveDrag, endDrag } = useDragState({
    isLocked,
    onTileDrop: handleInternalDrop,
    viewportBounds,
    tileSize,
  })

  function setPositionFor(tileId: string, pos: Vec2) {
    setInitialPositions(new Map(positions).set(tileId, pos))
  }

  const measureBounds = () => {
    const rect = playAreaEl?.getBoundingClientRect()
    if (rect) setViewportBounds({ width: rect.width, height: rect.height })
    setTileSize(readTileSize())
  }

  useLayoutEffect(() => {
    measureBounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAreaEl])

  useEffect(() => {
    // A window 'resize' event doesn't fire when only the *container* resizes
    // (common in an embedded WebView) — observe the actual play area instead.
    window.addEventListener('resize', measureBounds)
    let observer: ResizeObserver | undefined
    if (playAreaEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measureBounds)
      observer.observe(playAreaEl)
    }
    return () => {
      window.removeEventListener('resize', measureBounds)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAreaEl])

  useEffect(() => {
    if (viewportBounds.width === 0 || viewportBounds.height === 0 || tiles.length === 0) return
    if (assembled) {
      if (slots.length !== tiles.length) return // wait for the answer slots to be measured
      const slotPositions = alignPositionsToSlots(slots, tileSize)
      const positionsMap = new Map(
        tiles.map((tile) => [tile.id, slotPositions[tile.expectedPosition ?? 0] ?? slotPositions[0]] as const),
      )
      setInitialPositions(positionsMap)
      return
    }
    if (!avoidRect) return
    const generated = generateRandomPositions(tiles.length, tileSize, viewportBounds, avoidRect, levelIndex)
    const positionsMap = new Map(tiles.map((tile, i) => [tile.id, generated[i]] as const))
    setInitialPositions(positionsMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembled, levelIndex, viewportBounds.width, viewportBounds.height, avoidRect?.x, avoidRect?.y, avoidRect?.width, avoidRect?.height, tileSize, tiles.length, slots.length])

  // Bounce a tile away from the slot it was just (incorrectly) dropped on.
  useEffect(() => {
    if (!bounceTileId || !bounceSlot || viewportBounds.width === 0) return
    const current = positions.get(bounceTileId)
    if (!current) return
    const others = tiles
      .filter((t) => t.id !== bounceTileId)
      .map((t) => otherTilePosition(t.id))
      .filter((p): p is Vec2 => p !== undefined)
    const bounced = bounceAwayFromSlot(current, tileSize, bounceSlot, viewportBounds)
    const resolved = resolveOverlaps(bounced, tileSize, others, viewportBounds)
    setPositionFor(bounceTileId, resolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounceTileId])

  function handleSmash() {
    setAssembled(false)
    onSmash?.()
  }

  function toRelativePoint(e: ReactPointerEvent): Vec2 {
    const rect = playAreaEl?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const groupLabel = assembled
    ? `Tap the word ${tiles.map((t) => t.letter).join('')} to hear it and scatter the letters`
    : `Letter tiles: ${tiles.map((t) => t.letter).join(', ')}`

  return (
    <div className="letter-tiles-layer" role="group" aria-label={groupLabel}>
      {tiles.map((tile) => {
        const locked = lockedTiles.has(tile.id)
        const pos = (locked ? lockedPositions.get(tile.id) : undefined) ?? positions.get(tile.id) ?? { x: 0, y: 0 }
        const dragging = draggingId === tile.id
        const bouncing = tile.id === bounceTileId
        return (
          <button
            key={tile.id}
            type="button"
            className={[
              'letter-tile',
              dragging && 'letter-tile--dragging',
              locked && 'letter-tile--locked',
              assembled && 'letter-tile--assembled',
              bouncing && 'letter-tile--bounce',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: pos.x, top: pos.y }}
            aria-label={locked ? `Letter ${tile.letter}, locked in place` : `Letter ${tile.letter}`}
            disabled={locked}
            data-testid={`tile-${tile.id}`}
            onPointerDown={(e) => {
              if (locked) return
              if (assembled) {
                handleSmash()
                return
              }
              e.currentTarget.setPointerCapture(e.pointerId)
              startDrag(tile.id, toRelativePoint(e))
            }}
            onPointerMove={(e) => {
              if (draggingId !== tile.id) return
              const point = toRelativePoint(e)
              const tilePosition = moveDrag(point)
              onDragMove?.(tilePosition ? centerOfTile(tilePosition, tileSize) : null)
            }}
            onPointerUp={(e) => {
              if (draggingId !== tile.id) return
              endDrag(toRelativePoint(e))
              onDragMove?.(null)
            }}
          >
            {tile.letter.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
