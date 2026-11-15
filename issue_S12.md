## File: server/middleware/rateLimit.js:72-84

### Trigger
Cleanup interval runs every 5 minutes (`CLEANUP_INTERVAL_MS = 5 * 60 * 1000`) but bucket TTL is 30 minutes (`BUCKET_TTL_MS = 30 * 60 * 1000`).

### Impact
- Buckets accumulate for up to 30 minutes before eviction
- Cleanup only removes 1/6 of eligible buckets per run (5min vs 30min)
- Under sustained load with many unique IPs/clients, `buckets` Map grows **unbounded** until cleanup catches up
- Memory leak: each bucket ~200 bytes; 10k unique clients = 2MB, but 100k = 20MB, etc.
- If cleanup interval fails (process busy, GC pause), growth continues indefinitely

### Root Cause
Cleanup interval (5min) << bucket TTL (30min) — 6× ratio means steady-state growth.

### Suggested Fix
Match cleanup interval to TTL, or use shorter TTL:
```javascript
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const BUCKET_TTL_MS = 5 * 60 * 1000;   // 5 minutes
```
Or use a proper LRU cache with size limit instead of time-based eviction.

### Verdict
**Suggestion** — memory growth under load, cleanup too infrequent for TTL.