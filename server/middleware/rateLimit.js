// Token bucket rate limiter for Planetwood WebSocket server.
// Provides per-identifier rate limiting with separate buckets for
// connections, general messages, and chat messages.

class TokenBucket {
  constructor(capacity, refillRatePerSecond) {
    this.capacity = capacity;
    this.refillRatePerSecond = refillRatePerSecond;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSecond);
    this.lastRefill = now;
  }

  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, remaining: this.tokens };
    }
    const deficit = tokens - this.tokens;
    const retryAfter = Math.ceil(deficit / this.refillRatePerSecond);
    return { allowed: false, retryAfter };
  }
}

// Bucket configurations:
//   connection: 10 conn/min per IP
//   message:    30 msg/min per client
//   chat:        5 msg/min per client (stricter, matches 2s client-side cadence)
const BUCKET_CONFIGS = {
  connection: { capacity: 10, refillRatePerSecond: 10 / 60 },
  message:    { capacity: 30, refillRatePerSecond: 30 / 60 },
  chat:       { capacity: 5,  refillRatePerSecond: 5 / 60 },
};

const buckets = new Map();

function getBucket(identifier, bucketType) {
  const config = BUCKET_CONFIGS[bucketType];
  if (!config) {
    throw new Error(`Unknown rate limit bucket type: ${bucketType}`);
  }
  let bucket = buckets.get(identifier);
  if (!bucket) {
    bucket = new TokenBucket(config.capacity, config.refillRatePerSecond);
    buckets.set(identifier, bucket);
  }
  return bucket;
}

/**
 * Check whether a request is allowed under the token bucket for the given
 * identifier and bucket type.
 *
 * @param {string} identifier - rate limit key (IP address, client ID, etc.)
 * @param {'connection' | 'message' | 'chat'} bucketType
 * @returns {{ allowed: true } | { allowed: false, retryAfter: number }}
 */
export function checkLimit(identifier, bucketType) {
  const bucket = getBucket(identifier, bucketType);
  return bucket.consume();
}

// Cleanup old buckets periodically (every 5 min).
// Buckets idle for more than 30 min are evicted to prevent unbounded growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BUCKET_TTL_MS = 30 * 60 * 1000;

function cleanupBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > BUCKET_TTL_MS) {
      buckets.delete(key);
    }
  }
}

setInterval(cleanupBuckets, CLEANUP_INTERVAL_MS);

export { BUCKET_CONFIGS, TokenBucket };
