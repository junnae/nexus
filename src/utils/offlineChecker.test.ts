import { describe, expect, it } from 'vitest'
import { verifyOfflineCompliance } from './offlineChecker'

describe('offlineChecker', () => {
  it('treats a null origin (file://) as offline-compliant', () => {
    const result = verifyOfflineCompliance(
      { origin: 'null', search: '?cr_lang=english&cr_user_id=abc' },
      undefined,
    )
    expect(result.isOffline).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('treats a file:// origin as offline-compliant', () => {
    const result = verifyOfflineCompliance(
      { origin: 'file://', search: '?cr_lang=english&cr_user_id=abc' },
      undefined,
    )
    expect(result.isOffline).toBe(true)
  })

  it('warns when origin is http (not offline)', () => {
    const result = verifyOfflineCompliance(
      { origin: 'https://example.com', search: '?cr_lang=english&cr_user_id=abc' },
      undefined,
    )
    expect(result.isOffline).toBe(false)
    expect(result.warnings.some((w) => w.includes('file://'))).toBe(true)
  })

  it('warns when cr_lang is missing', () => {
    const result = verifyOfflineCompliance({ origin: 'null', search: '?cr_user_id=abc' }, undefined)
    expect(result.warnings.some((w) => w.includes('cr_lang'))).toBe(true)
  })

  it('warns when cr_user_id is missing', () => {
    const result = verifyOfflineCompliance({ origin: 'null', search: '?cr_lang=english' }, undefined)
    expect(result.warnings.some((w) => w.includes('cr_user_id'))).toBe(true)
  })

  it('warns when a Service Worker is present', () => {
    const result = verifyOfflineCompliance(
      { origin: 'null', search: '?cr_lang=english&cr_user_id=abc' },
      { serviceWorker: {} as ServiceWorkerContainer },
    )
    expect(result.warnings.some((w) => w.includes('serviceWorker'))).toBe(true)
  })
})
