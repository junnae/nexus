import type { CrEventPayload, CrEventType } from '../types/audio'

/** Fire-and-forget report to the Curious Reader `cr_event` bridge. No-op and never throws outside the container. */
export function reportEvent(payload: CrEventPayload): void {
  if (typeof window === 'undefined' || typeof window.cr_event !== 'function') {
    return
  }
  try {
    window.cr_event(payload)
  } catch (err) {
    console.debug('[crEventReporter] cr_event threw', err)
  }
}

export function buildEvent(
  eventType: CrEventType,
  sessionId: string,
  userId: string,
  extra?: { wordId?: number; word?: string; metadata?: Record<string, unknown> },
): CrEventPayload {
  return {
    sessionId,
    userId,
    timestamp: Date.now(),
    eventType,
    ...extra,
  }
}
