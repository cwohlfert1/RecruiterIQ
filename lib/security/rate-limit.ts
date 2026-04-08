/**
 * In-memory rate limiter for API routes.
 * Uses a sliding window counter per key (IP or user ID).
 *
 * For production scale, swap this for Upstash Redis.
 * Current approach is suitable for single-instance Railway deployments.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) store.delete(key)
  })
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number
  /** Window duration in seconds */
  windowSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given key.
 * Returns { allowed, remaining, resetAt }.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSec * 1000
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    // Fresh window
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: config.max - 1, resetAt: now + windowMs }
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt }
}

/**
 * Build a rate limit key from request.
 * Uses x-forwarded-for → x-real-ip → 'unknown' for IP.
 */
export function getRateLimitKey(req: Request, prefix: string, userId?: string): string {
  if (userId) return `${prefix}:user:${userId}`
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  return `${prefix}:ip:${ip}`
}

/**
 * Return a 429 response with Retry-After header.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(retryAfter, 1)),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}

// ── Preset configs for different route tiers ──

/** Standard authenticated routes: 60 req/min */
export const RATE_STANDARD: RateLimitConfig = { max: 60, windowSec: 60 }

/** AI/expensive routes (Claude calls): 20 req/min */
export const RATE_AI: RateLimitConfig = { max: 20, windowSec: 60 }

/** Auth routes: 10 req/min per IP */
export const RATE_AUTH: RateLimitConfig = { max: 10, windowSec: 60 }

/** Public routes (sales chat): 30 req/min per IP */
export const RATE_PUBLIC: RateLimitConfig = { max: 30, windowSec: 60 }

/** Bulk operations (import, batch): 5 req/min */
export const RATE_BULK: RateLimitConfig = { max: 5, windowSec: 60 }

/** Email-sending routes: 10 req/min */
export const RATE_EMAIL: RateLimitConfig = { max: 10, windowSec: 60 }
