import type { Vec2 } from '../types/game'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Slot extends Rect {
  index: number
}

/** Simple deterministic PRNG (mulberry32) so tile layout is reproducible per seed. */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  )
}

export function isCollision(a: Rect, b: Rect, padding = 0): boolean {
  return rectsOverlap(a, b, padding)
}

/** Returns the slot whose bounds contain the given point, if any. */
export function findSlotAtPosition(point: Vec2, slots: Slot[]): Slot | null {
  return (
    slots.find(
      (slot) =>
        point.x >= slot.x &&
        point.x <= slot.x + slot.width &&
        point.y >= slot.y &&
        point.y <= slot.y + slot.height,
    ) ?? null
  )
}

/** Returns the slot with the closest center to the given point. */
export function findClosestSlot(point: Vec2, slots: Slot[]): Slot | null {
  if (slots.length === 0) return null
  let closest = slots[0]
  let closestDist = Infinity
  for (const slot of slots) {
    const cx = slot.x + slot.width / 2
    const cy = slot.y + slot.height / 2
    const dist = (cx - point.x) ** 2 + (cy - point.y) ** 2
    if (dist < closestDist) {
      closestDist = dist
      closest = slot
    }
  }
  return closest
}

export interface PositionBounds {
  width: number
  height: number
}

function clampToBounds(pos: Vec2, tileSize: number, bounds: PositionBounds): Vec2 {
  return {
    x: Math.min(Math.max(pos.x, 0), Math.max(0, bounds.width - tileSize)),
    y: Math.min(Math.max(pos.y, 0), Math.max(0, bounds.height - tileSize)),
  }
}

/**
 * Centers a tile-sized position inside each slot. Used for the pre-smash
 * "combined" word presentation, so the joined word appears to sit directly
 * in the answer slots rather than as a separate row of tiles.
 */
export function alignPositionsToSlots(slots: Slot[], tileSize: number): Vec2[] {
  return slots.map((slot) => ({
    x: slot.x + slot.width / 2 - tileSize / 2,
    y: slot.y + slot.height / 2 - tileSize / 2,
  }))
}

/** The center point of a tile-sized box whose top-left corner is at `position`. */
export function centerOfTile(position: Vec2, tileSize: number): Vec2 {
  return {
    x: position.x + tileSize / 2,
    y: position.y + tileSize / 2,
  }
}

/**
 * Pushes `position` away from any overlapping `others` until clear (a
 * simple iterative separation, not full physics), then clamps to `bounds`.
 * Used so a dropped tile never rests on top of another one.
 */
export function resolveOverlaps(
  position: Vec2,
  tileSize: number,
  others: Vec2[],
  bounds: PositionBounds,
  padding = 8,
): Vec2 {
  let { x, y } = position
  const minSeparation = tileSize + padding

  for (let iteration = 0; iteration < 16; iteration++) {
    let moved = false
    for (const other of others) {
      const center = centerOfTile({ x, y }, tileSize)
      const otherCenter = centerOfTile(other, tileSize)
      let dx = center.x - otherCenter.x
      let dy = center.y - otherCenter.y
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) dx = 1 // exact overlap: pick an arbitrary escape axis

      const overlapX = minSeparation - Math.abs(dx)
      const overlapY = minSeparation - Math.abs(dy)
      if (overlapX <= 0 || overlapY <= 0) continue // already clear on at least one axis

      // Minimum-translation-vector resolution: push out along whichever
      // axis needs the smaller correction, so this pair becomes exactly
      // AABB-clear in one step (matches the `isCollision` test itself,
      // rather than an unrelated circular-distance approximation).
      if (overlapX < overlapY) {
        x += dx >= 0 ? overlapX : -overlapX
        // Small perpendicular nudge so 3+ obstacles that are exactly level
        // with each other can't ping-pong forever between two colliding
        // states along the same axis.
        y += dy >= 0 ? 2 : -2
      } else {
        y += dy >= 0 ? overlapY : -overlapY
        x += dx >= 0 ? 2 : -2
      }
      moved = true

      // Clamp after every push (not just at the end): near a screen edge, an
      // unclamped resolution can wander out of bounds and get snapped back
      // into the very collision it just resolved. Clamping here means the
      // next comparison reacts to where the tile can actually be.
      ;({ x, y } = clampToBounds({ x, y }, tileSize, bounds))
    }
    if (!moved) break
  }

  return clampToBounds({ x, y }, tileSize, bounds)
}

/**
 * Pushes a dropped position away from a slot's center by `distance`, along
 * the slot-to-drop vector. If viewport clamping leaves the tile overlapping
 * the slot, it selects the nearest clear side instead.
 */
export function bounceAwayFromSlot(
  dropPosition: Vec2,
  tileSize: number,
  slotRect: Rect,
  bounds: PositionBounds,
  distance = 90,
): Vec2 {
  const slotCenterX = slotRect.x + slotRect.width / 2
  const slotCenterY = slotRect.y + slotRect.height / 2
  const tileCenter = centerOfTile(dropPosition, tileSize)

  let dx = tileCenter.x - slotCenterX
  let dy = tileCenter.y - slotCenterY
  let dist = Math.hypot(dx, dy)
  if (dist < 0.01) {
    dx = 0
    dy = -1
    dist = 1
  }

  const pushed: Vec2 = {
    x: dropPosition.x + (dx / dist) * distance,
    y: dropPosition.y + (dy / dist) * distance,
  }
  const clamped = clampToBounds(pushed, tileSize, bounds)
  const tileRect = { ...clamped, width: tileSize, height: tileSize }
  const gap = 8
  if (!isCollision(tileRect, slotRect, gap)) return clamped

  const clearSideCandidates = [
    { x: slotRect.x - tileSize - gap, y: clamped.y },
    { x: slotRect.x + slotRect.width + gap, y: clamped.y },
    { x: clamped.x, y: slotRect.y - tileSize - gap },
    { x: clamped.x, y: slotRect.y + slotRect.height + gap },
  ]
    .map((candidate) => clampToBounds(candidate, tileSize, bounds))
    .filter(
      (candidate) =>
        !isCollision({ ...candidate, width: tileSize, height: tileSize }, slotRect, gap),
    )

  return (
    clearSideCandidates.sort(
      (a, b) =>
        (a.x - clamped.x) ** 2 +
        (a.y - clamped.y) ** 2 -
        ((b.x - clamped.x) ** 2 + (b.y - clamped.y) ** 2),
    )[0] ?? clamped
  )
}

/**
 * Generates `count` non-overlapping positions within `bounds`, avoiding the
 * `avoidRect` (answer area). Positions are deterministic for a given seed so
 * tile layout can be reproduced (and tested) per level index.
 */
export function generateRandomPositions(
  count: number,
  tileSize: number,
  bounds: PositionBounds,
  avoidRect: Rect,
  seed: number,
): Vec2[] {
  const random = createSeededRandom(seed)
  const positions: Vec2[] = []
  const maxAttemptsPerTile = 200
  const padding = 8

  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < maxAttemptsPerTile && !placed; attempt++) {
      const x = random() * Math.max(1, bounds.width - tileSize)
      const y = random() * Math.max(1, bounds.height - tileSize)
      const candidate: Rect = { x, y, width: tileSize, height: tileSize }

      const overlapsAvoid = isCollision(candidate, avoidRect, padding)
      const overlapsOther = positions.some((p) =>
        isCollision(candidate, { x: p.x, y: p.y, width: tileSize, height: tileSize }, padding),
      )

      if (!overlapsAvoid && !overlapsOther) {
        positions.push({ x, y })
        placed = true
      }
    }
    if (!placed) {
      // Fallback: place at a deterministic offset so we always return `count` positions.
      positions.push({
        x: (i * (tileSize + padding)) % Math.max(1, bounds.width - tileSize),
        y: bounds.height - tileSize,
      })
    }
  }

  return positions
}
