/**
 * Lightweight in-memory fixed-window rate limiter (single-instance deployments).
 * Keys requests by client IP (trust proxy is enabled in index.js) plus an optional
 * body field (e.g. email), so one attacker cannot brute-force codes for an account.
 */
const buckets = new Map();

// Periodically drop expired windows so memory stays bounded
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 60 * 1000).unref();

const rateLimit = ({ windowMs, max, keyField = null, message }) => (req, res, next) => {
  const now = Date.now();
  const routeKey = `${req.baseUrl}${req.path}`;
  const keys = [`ip:${req.ip}:${routeKey}`];

  if (keyField) {
    const value = req.body?.[keyField];
    if (typeof value === 'string' && value.trim()) {
      keys.push(`${keyField}:${value.toLowerCase().trim()}:${routeKey}`);
    }
  }

  for (const key of keys) {
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message: message || 'Too many attempts. Please wait a few minutes and try again.',
      });
    }
  }

  return next();
};

module.exports = { rateLimit };
