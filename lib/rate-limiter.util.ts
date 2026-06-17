// this is an implementation for token bucket algorithm
const tokenBuckets = new Map();

const RATE_LIMIT = 3;
const INTERVAL = 3 * 60 * 1000;

export function allowRequest(userId: string) {
  const now = Date.now();
  if (!tokenBuckets.has(userId)) {
    tokenBuckets.set(userId, { lastRefill: now, tokens: RATE_LIMIT });
  }

  const bucket = tokenBuckets.get(userId);
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / INTERVAL);

  // Refill tokens
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}
