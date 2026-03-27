/**
 * Shared in-memory rate limiter for edge functions.
 * Frameworks: CE+ (Secure Configuration), NCSC (P11)
 *
 * Note: In-memory state resets when edge functions restart.
 * For persistent rate limiting, use a database table or Redis.
 */

const buckets = new Map<string, Map<string, { count: number; resetAt: number }>>();

export interface RateLimitOptions {
  /** Unique name for this rate limiter bucket */
  name: string;
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Check if a request should be rate limited.
 * Returns true if the request exceeds the limit.
 */
export function isRateLimited(
  req: Request,
  options: RateLimitOptions,
): boolean {
  const { name, maxRequests, windowMs } = options;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!buckets.has(name)) {
    buckets.set(name, new Map());
  }
  const bucket = buckets.get(name)!;

  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || now > entry.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
}
