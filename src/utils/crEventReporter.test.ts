import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEvent, reportEvent } from './crEventReporter'

describe('crEventReporter', () => {
  afterEach(() => {
    delete (window as unknown as { cr_event?: unknown }).cr_event
    vi.unstubAllGlobals()
  })

  it('calls window.cr_event when available', () => {
    const spy = vi.fn()
    window.cr_event = spy
    const payload = buildEvent('session_start', 'session-1', 'user-1')

    reportEvent(payload)

    expect(spy).toHaveBeenCalledWith(payload)
  })

  it('is a no-op and does not throw when cr_event is unavailable', () => {
    delete (window as unknown as { cr_event?: unknown }).cr_event
    expect(() => reportEvent(buildEvent('session_start', 'session-1', 'user-1'))).not.toThrow()
  })

  it('does not throw when cr_event itself throws', () => {
    window.cr_event = () => {
      throw new Error('boom')
    }
    expect(() => reportEvent(buildEvent('session_start', 'session-1', 'user-1'))).not.toThrow()
  })

  it('includes required fields in the built payload', () => {
    const payload = buildEvent('placement_correct', 'session-1', 'user-1', { wordId: 1, word: 'cat' })
    expect(payload).toMatchObject({
      sessionId: 'session-1',
      userId: 'user-1',
      eventType: 'placement_correct',
      wordId: 1,
      word: 'cat',
    })
    expect(typeof payload.timestamp).toBe('number')
  })

  it('never touches network APIs', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    window.cr_event = vi.fn()

    reportEvent(buildEvent('session_end', 'session-1', 'user-1'))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
