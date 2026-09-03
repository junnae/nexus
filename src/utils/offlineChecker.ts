export interface OfflineComplianceResult {
  isOffline: boolean
  warnings: string[]
}

/**
 * Sanity-checks the runtime environment for Curious Reader offline
 * compliance: file:// origin, required URL params present, no Service
 * Worker dependency.
 */
export function verifyOfflineCompliance(
  location: Pick<Location, 'origin' | 'search'>,
  navigatorRef: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): OfflineComplianceResult {
  const warnings: string[] = []

  const isOffline = location.origin === 'null' || location.origin.startsWith('file://')
  if (!isOffline) {
    warnings.push(`Origin "${location.origin}" is not a file:// origin; running outside the expected container context.`)
  }

  const params = new URLSearchParams(location.search)
  if (!params.get('cr_lang')) {
    warnings.push('Missing "cr_lang" URL parameter.')
  }
  if (!params.get('cr_user_id')) {
    warnings.push('Missing "cr_user_id" URL parameter.')
  }

  if (navigatorRef?.serviceWorker) {
    warnings.push('navigator.serviceWorker is present; this app must not depend on Service Workers.')
  }

  return { isOffline, warnings }
}
