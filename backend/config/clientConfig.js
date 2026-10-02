/**
 * Client (Frontend) Configuration & URL Resolver
 * Resolves the public deployed Frontend URL for email CTA buttons, OAuth redirects, etc.
 * Guarantees that production emails use the live deployed URL from environment variables.
 */

const getClientUrl = () => {
  const candidates = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.PUBLIC_FRONTEND_URL,
  ].filter(Boolean);

  for (const raw of candidates) {
    const urls = String(raw)
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    // 1. Highest priority: Deployed production HTTPS URL (never localhost)
    const deployedHttps = urls.find(
      (u) => u.startsWith('https://') && !u.includes('localhost') && !u.includes('127.0.0.1')
    );
    if (deployedHttps) {
      return deployedHttps;
    }

    // 2. Second priority: Any non-localhost domain
    const nonLocal = urls.find((u) => !u.includes('localhost') && !u.includes('127.0.0.1'));
    if (nonLocal) {
      return nonLocal.startsWith('http://') || nonLocal.startsWith('https://') ? nonLocal : `https://${nonLocal}`;
    }

    // 3. Fallback to first non-empty entry
    if (urls[0]) {
      return urls[0];
    }
  }

  // Local development default
  return 'http://localhost:5173';
};

module.exports = {
  getClientUrl,
};
