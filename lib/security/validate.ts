/**
 * Shared input validation helpers.
 * Used across API routes for consistent sanitization.
 */

/** Validate email format (RFC 5322 simplified) */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/** Sanitize a text string: trim, enforce max length, strip null bytes */
export function sanitizeText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/\0/g, '').slice(0, maxLength)
}

/** Validate a URL is HTTPS and belongs to an allowed domain */
export function isAllowedUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return allowedDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** Validate that a redirect path is internal (starts with /) and has no protocol */
export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith('/')) return false
  // Block protocol-relative URLs and encoded redirects
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  if (path.includes('%2f%2f') || path.includes('%2F%2F')) return false
  return true
}

/** Strip all fields from an object except the allowed keys */
export function pickAllowedFields<T extends Record<string, unknown>>(
  obj: T,
  allowed: string[],
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of allowed) {
    if (key in obj) {
      (result as Record<string, unknown>)[key] = obj[key]
    }
  }
  return result
}

/** Parse a positive integer from unknown input, returns null if invalid */
export function parsePositiveInt(input: unknown): number | null {
  const n = Number(input)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

/** Parse a positive number (allows decimals) from unknown input */
export function parsePositiveNumber(input: unknown): number | null {
  const n = Number(input)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
