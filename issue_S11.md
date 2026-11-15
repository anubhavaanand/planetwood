## File: server/middleware/auth.js:8

### Trigger
`JWT_SECRET` defaults to `'planetwood-dev-secret-change-in-production'` if `JWT_SECRET` env var not set:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'planetwood-dev-secret-change-in-production';
```

### Impact
- In production without `JWT_SECRET` set, **all tokens signed with known constant**
- Anyone can forge valid JWTs → impersonate any user, bypass auth
- Tokens never expire in attacker's hands (they can re-sign with same secret)
- Complete authentication bypass

### Root Cause
Default secret intended for dev only, but no guard against production use.

### Suggested Fix
Fail fast in production:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable required in production');
  }
  // Dev fallback
  JWT_SECRET = 'planetwood-dev-secret-change-in-production';
}
```

Or at minimum, log a **loud warning** in production:
```javascript
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('!!! WARNING: Using default JWT_SECRET in PRODUCTION — tokens are INSECURE !!!');
}
```

### Verdict
**Suggestion** — critical production security misconfiguration risk.