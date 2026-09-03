export type CrEventType =
  | 'session_start'
  | 'word_started'
  | 'word_completed'
  | 'placement_correct'
  | 'placement_incorrect'
  | 'session_end'

export interface CrEventPayload {
  sessionId: string
  userId: string
  timestamp: number
  eventType: CrEventType
  wordId?: number
  word?: string
  metadata?: Record<string, unknown>
}

declare global {
  interface Window {
    cr_event?: (event: CrEventPayload) => void
  }
}
