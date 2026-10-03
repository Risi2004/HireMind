/**
 * Centralized JWT helpers.
 * - Refuses to run in production without a real JWT_SECRET (no hardcoded fallback).
 * - Only full session tokens are accepted for authentication; short-lived
 *   purpose tokens (e.g. the 2FA step token) are rejected.
 */
const jwt = require('jsonwebtoken');

const DEV_FALLBACK_SECRET = 'hiremind_local_development_only_secret';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  return DEV_FALLBACK_SECRET;
};

/**
 * Extracts a bearer token from the Authorization header, falling back to ?token=
 * (needed for EventSource and top-level OAuth redirects, which cannot set headers).
 */
const extractToken = (req) => {
  const header = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
};

/**
 * Verifies a session token. Throws if invalid, expired, or a purpose-limited token.
 * @returns {object} decoded payload
 */
const verifySessionToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecret());
  if (!decoded || !decoded.id || decoded.step || decoded.purpose) {
    throw new Error('Token is not a valid session token');
  }
  return decoded;
};

module.exports = {
  getJwtSecret,
  extractToken,
  verifySessionToken,
};
