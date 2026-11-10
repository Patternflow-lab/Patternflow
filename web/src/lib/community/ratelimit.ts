// In-memory sliding-window rate limiter. This app runs as a single long-lived
// process (the Pi), so process memory is a perfectly good store — no Redis.

// Each key remembers its own window, because the cleanup below sweeps keys
// that other routes set with other windows.
const buckets = new Map<string, { windowMs: number; hits: number[] }>();

/** Returns true when the call is allowed, false when over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, { windowMs, hits });
    return false;
  }
  hits.push(now);
  buckets.set(key, { windowMs, hits });

  // Opportunistic cleanup so long-idle keys don't accumulate forever. A key is
  // idle when its own window has passed: a like's minute says nothing about
  // the hour of builds.
  if (buckets.size > 10_000) {
    for (const [k, bucket] of buckets) {
      if (bucket.hits.every((t) => t <= now - bucket.windowMs)) buckets.delete(k);
    }
  }
  return true;
}
