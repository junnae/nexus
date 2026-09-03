import { describe, expect, it } from 'vitest'
import {
  alignPositionsToSlots,
  bounceAwayFromSlot,
  createSeededRandom,
  findClosestSlot,
  findSlotAtPosition,
  generateRandomPositions,
  isCollision,
  resolveOverlaps,
  type Slot,
} from './dragUtils'

describe('dragUtils', () => {
  describe('isCollision', () => {
    it('detects overlapping rects', () => {
      expect(isCollision({ x: 100, y: 100, width: 50, height: 50 }, { x: 120, y: 120, width: 50, height: 50 })).toBe(true)
    })

    it('detects non-overlapping rects', () => {
      expect(isCollision({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 })).toBe(false)
    })
  })

  describe('findSlotAtPosition', () => {
    const slots: Slot[] = [
      { index: 0, x: 100, y: 100, width: 50, height: 50 },
      { index: 1, x: 200, y: 100, width: 50, height: 50 },
    ]

    it('returns the slot containing the point', () => {
      expect(findSlotAtPosition({ x: 120, y: 120 }, slots)?.index).toBe(0)
    })

    it('returns null when no slot contains the point', () => {
      expect(findSlotAtPosition({ x: 1000, y: 1000 }, slots)).toBeNull()
    })
  })

  describe('findClosestSlot', () => {
    const slots: Slot[] = [
      { index: 0, x: 150, y: 150, width: 0, height: 0 },
      { index: 1, x: 200, y: 200, width: 0, height: 0 },
    ]

    it('returns the slot with the nearest center', () => {
      expect(findClosestSlot({ x: 155, y: 155 }, slots)?.index).toBe(0)
    })

    it('returns null for an empty slot list', () => {
      expect(findClosestSlot({ x: 0, y: 0 }, [])).toBeNull()
    })
  })

  describe('createSeededRandom', () => {
    it('is deterministic for a given seed', () => {
      const a = createSeededRandom(42)
      const b = createSeededRandom(42)
      const seqA = [a(), a(), a()]
      const seqB = [b(), b(), b()]
      expect(seqA).toEqual(seqB)
    })

    it('produces different sequences for different seeds', () => {
      const a = createSeededRandom(1)
      const b = createSeededRandom(2)
      expect(a()).not.toBe(b())
    })
  })

  describe('generateRandomPositions', () => {
    const bounds = { width: 800, height: 600 }
    const avoidRect = { x: 300, y: 200, width: 200, height: 200 }

    it('returns the requested number of positions', () => {
      const positions = generateRandomPositions(5, 60, bounds, avoidRect, 1)
      expect(positions).toHaveLength(5)
    })

    it('is deterministic for the same seed (same level index)', () => {
      const a = generateRandomPositions(5, 60, bounds, avoidRect, 7)
      const b = generateRandomPositions(5, 60, bounds, avoidRect, 7)
      expect(a).toEqual(b)
    })

    it('does not overlap the avoid rect', () => {
      const positions = generateRandomPositions(6, 60, bounds, avoidRect, 3)
      for (const pos of positions) {
        expect(isCollision({ x: pos.x, y: pos.y, width: 60, height: 60 }, avoidRect)).toBe(false)
      }
    })

    it('does not overlap other generated tiles', () => {
      const tileSize = 60
      const positions = generateRandomPositions(6, tileSize, bounds, avoidRect, 5)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = { x: positions[i].x, y: positions[i].y, width: tileSize, height: tileSize }
          const b = { x: positions[j].x, y: positions[j].y, width: tileSize, height: tileSize }
          expect(isCollision(a, b)).toBe(false)
        }
      }
    })
  })

  describe('alignPositionsToSlots', () => {
    const slots: Slot[] = [
      { index: 0, x: 100, y: 200, width: 70, height: 70 },
      { index: 1, x: 200, y: 200, width: 70, height: 70 },
    ]

    it('returns one position per slot', () => {
      expect(alignPositionsToSlots(slots, 60)).toHaveLength(2)
    })

    it('centers the tile within each slot', () => {
      const positions = alignPositionsToSlots(slots, 60)
      expect(positions[0]).toEqual({ x: 100 + (70 - 60) / 2, y: 200 + (70 - 60) / 2 })
      expect(positions[1]).toEqual({ x: 200 + (70 - 60) / 2, y: 200 + (70 - 60) / 2 })
    })
  })

  describe('resolveOverlaps', () => {
    const bounds = { width: 800, height: 600 }
    const tileSize = 60

    it('leaves a non-overlapping position untouched', () => {
      const resolved = resolveOverlaps({ x: 100, y: 100 }, tileSize, [{ x: 500, y: 500 }], bounds)
      expect(resolved).toEqual({ x: 100, y: 100 })
    })

    it('pushes an overlapping position away until clear', () => {
      const others = [{ x: 100, y: 100 }]
      const resolved = resolveOverlaps({ x: 110, y: 100 }, tileSize, others, bounds)
      const rectA = { x: resolved.x, y: resolved.y, width: tileSize, height: tileSize }
      const rectB = { x: others[0].x, y: others[0].y, width: tileSize, height: tileSize }
      expect(isCollision(rectA, rectB, 8)).toBe(false)
    })

    it('clamps the resolved position to bounds', () => {
      const resolved = resolveOverlaps({ x: -50, y: -50 }, tileSize, [], bounds)
      expect(resolved.x).toBeGreaterThanOrEqual(0)
      expect(resolved.y).toBeGreaterThanOrEqual(0)
    })

    it('resolves against multiple overlapping tiles at once', () => {
      // Two others 70px apart (just clear of each other at tileSize=60+padding=8),
      // with a drop point sitting between them, overlapping both.
      const others = [
        { x: 100, y: 100 },
        { x: 170, y: 100 },
      ]
      const resolved = resolveOverlaps({ x: 135, y: 100 }, tileSize, others, bounds)
      for (const other of others) {
        const rectA = { x: resolved.x, y: resolved.y, width: tileSize, height: tileSize }
        const rectB = { x: other.x, y: other.y, width: tileSize, height: tileSize }
        expect(isCollision(rectA, rectB, 8)).toBe(false)
      }
    })
  })

  describe('bounceAwayFromSlot', () => {
    const bounds = { width: 800, height: 600 }
    const tileSize = 60
    const slot = { x: 400, y: 300, width: 70, height: 70 }

    it('moves the position further from the slot center', () => {
      const drop = { x: 420, y: 320 }
      const before = Math.hypot(drop.x - (slot.x + 35), drop.y - (slot.y + 35))
      const bounced = bounceAwayFromSlot(drop, tileSize, slot, bounds)
      const after = Math.hypot(bounced.x - (slot.x + 35), bounced.y - (slot.y + 35))
      expect(after).toBeGreaterThan(before)
    })

    it('clamps the bounced position to bounds', () => {
      const bounced = bounceAwayFromSlot({ x: 10, y: 10 }, tileSize, { x: 100, y: 100, width: 70, height: 70 }, bounds, 90)
      expect(bounced.x).toBeGreaterThanOrEqual(0)
      expect(bounced.y).toBeGreaterThanOrEqual(0)
    })

    it('picks a default direction when dropped exactly on the slot center', () => {
      const centerDrop = { x: slot.x + slot.width / 2 - tileSize / 2, y: slot.y + slot.height / 2 - tileSize / 2 }
      const bounced = bounceAwayFromSlot(centerDrop, tileSize, slot, bounds)
      expect(bounced).not.toEqual(centerDrop)
    })

    it('chooses a clear side when the preferred bounce is blocked by the viewport edge', () => {
      const topSlot = { x: 269, y: 20, width: 70, height: 70 }
      const centerDrop = {
        x: topSlot.x + topSlot.width / 2 - tileSize / 2,
        y: topSlot.y + topSlot.height / 2 - tileSize / 2,
      }

      const bounced = bounceAwayFromSlot(centerDrop, tileSize, topSlot, { width: 449, height: 889 })

      expect(isCollision({ ...bounced, width: tileSize, height: tileSize }, topSlot)).toBe(false)
    })
  })
})
