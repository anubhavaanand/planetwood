// JWT authentication middleware for Planetwood WebSocket relay server.
// Issues HS256-signed tokens, verifies them, and provides an upgrade
// middleware that reads Authorization: Bearer <token> or ?token=<token>
// from the WebSocket upgrade request.

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'planetwood-dev-secret-change-in-production';
const JWT_ISSUER = 'planetwood-relay';
const JWT_AUDIENCE = 'planetwood-client';
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

// Error codes thrown by verifyToken so callers can distinguish failure modes.
export const TokenError = {
  MISSING: 'TOKEN_MISSING',
  INVALID: 'TOKEN_INVALID',
  EXPIRED: 'TOKEN_EXPIRED',
};

/**
 * Sign a JWT with client id, displayName, room, issuedAt.
 * @param {object} payload - { id, displayName, room }
 * @returns {string} signed JWT
 */
export function generateToken({ id, displayName, room }) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      id,
      displayName,
      room,
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

/**
 * Verify a JWT and return its payload, or throw a specific TokenError.
 * @param {string} token
 * @returns {object} decoded payload { id, displayName, room, iat, exp, iss, aud }
 * @throws {Error} with code TokenError.EXPIRED or TokenError.INVALID
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error(TokenError.MISSING);
    err.code = TokenError.MISSING;
    throw err;
  }
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const expiredErr = new Error(TokenError.EXPIRED);
      expiredErr.code = TokenError.EXPIRED;
      throw expiredErr;
    }
    const invalidErr = new Error(TokenError.INVALID);
    invalidErr.code = TokenError.INVALID;
    throw invalidErr;
  }
}

/**
 * Extract a bearer token from an HTTP upgrade request.
 * Checks Authorization: Bearer <token> header first, then ?token=<token> query param.
 * @param {import('http').IncomingMessage} req
 * @returns {string | null} the token string, or null if not found
 */
export function extractTokenFromUpgrade(req) {
  // Authorization: Bearer <token>
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // ?token=<token> query param
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (token) return token;
  } catch {
    // Fall back to manual parse if URL parsing fails
  }

  return null;
}

/**
 * WebSocket upgrade authentication middleware for the `ws` library.
 *
 * Usage with ws:
 *   const { authenticateUpgrade } = require('./middleware/auth');
 *   wss.on('connection', (ws, req) => {
 *     const authResult = authenticateUpgrade(req);
 *     if (!authResult.ok) { ws.close(4001, 'AUTH_REQUIRED'); return; }
 *     ws.auth = authResult.auth; // { id, displayName, room, token }
 *   });
 *
 * Note: `ws` does not intercept the upgrade handshake before the connection
 * event fires. To reject before accepting, call this inside the connection
 * handler and close immediately. The `ws` library exposes `req` as the
 * second argument to the connection listener.
 *
 * @param {import('http').IncomingMessage} req - the upgrade request
 * @returns { { ok: true, auth: { id, displayName, room, token } } | { ok: false, reason: string } }
 */
export function authenticateUpgrade(req) {
  const token = extractTokenFromUpgrade(req);
  if (!token) {
    return { ok: false, reason: 'AUTH_REQUIRED' };
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return { ok: false, reason: err.code === TokenError.EXPIRED ? 'AUTH_EXPIRED' : 'AUTH_INVALID' };
  }

  return {
    ok: true,
    auth: {
      id: payload.id,
      displayName: payload.displayName,
      room: payload.room,
      token,
    },
  };
}
