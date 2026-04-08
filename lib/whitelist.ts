/**
 * Domain whitelist — users with these email domains get free Agency access.
 * Read from WHITELISTED_DOMAINS env var (comma-separated).
 */
export function getWhitelistedDomains(): string[] {
  const raw = process.env.WHITELISTED_DOMAINS ?? ''
  return raw
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean)
}

export function isWhitelistedEmail(email: string): boolean {
  const domains = getWhitelistedDomains()
  if (domains.length === 0) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && domains.includes(domain)
}
