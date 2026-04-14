/**
 * In-memory rate limiter (sliding window).
 * Note: state is not shared across multiple ECS instances.
 * Sufficient to throttle single-instance bursts and bots that hit one container.
 */

interface Window {
  count: number;
  resetAt: number; // Unix ms
}

const store = new Map<string, Window>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store) {
    if (now > win.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms
}

/**
 * Check rate limit for the given key (e.g. "login:<ip>").
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  let win = store.get(key);
  if (!win || now > win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(key, win);
  }

  win.count += 1;
  const remaining = Math.max(0, options.limit - win.count);
  const allowed = win.count <= options.limit;

  return { allowed, remaining, resetAt: win.resetAt };
}

/**
 * Extract a best-effort client IP from Next.js request headers.
 * Falls back to 'unknown' if nothing is available.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
