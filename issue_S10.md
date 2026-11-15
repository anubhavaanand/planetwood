## File: server/index.js:330

### Trigger
Connection rate limit extracts client IP from `x-forwarded-for` header:
```javascript
const clientIp = req.socket?.remoteAddress
  || (typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : undefined)
  || 'unknown';
```

### Impact
- `x-forwarded-for` can contain multiple IPs: `client, proxy1, proxy2`
- Code takes `split(',')[0]` — **first IP**, which is the **original client** (correct)
- BUT: header is **trivially spoofable** by client — they can send `x-forwarded-for: 1.2.3.4, 5.6.7.8` and the server will use `1.2.3.4`
- Attacker can rotate fake IPs to bypass connection rate limit (10 conn/min per IP)

### Root Cause
Trusting client-controlled header for rate limiting without validation.

### Suggested Fix
Option A: Only use `req.socket.remoteAddress` (TCP-level IP, not spoofable) — but fails behind reverse proxy.

Option B: If behind trusted proxy (nginx, Cloudflare), configure proxy to set `x-forwarded-for` correctly and **only trust the rightmost IP** (added by your proxy):
```javascript
const forwarded = req.headers['x-forwarded-for'];
let clientIp = req.socket?.remoteAddress || 'unknown';
if (forwarded && typeof forwarded === 'string') {
  const ips = forwarded.split(',').map(ip => ip.trim());
  // Trust only the last IP (added by your infrastructure)
  // Assumes your proxy appends to the right
  clientIp = ips[ips.length - 1] || clientIp;
}
```

Option C: Use a library like `proxy-addr` with trusted proxy configuration.

### Verdict
**Suggestion** — connection rate limit bypassable via header spoofing.