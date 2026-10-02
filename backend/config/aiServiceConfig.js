/**
 * AI Service Configuration & URL Normalizer
 * Handles local development, Render internal discovery hostnames, and public URLs.
 */

const getAiServiceUrl = () => {
  const raw = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const clean = String(raw).trim().replace(/\/+$/, '');
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `http://${clean}`;
};

module.exports = {
  getAiServiceUrl,
  AI_SERVICE_URL: getAiServiceUrl(),
};
