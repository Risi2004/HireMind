/**
 * AI Service Configuration & URL Normalizer
 * Handles local development and public deployed URLs.
 *
 * On Render's free plan services cannot talk over the private network, so
 * AI_SERVICE_URL must be the AI service's PUBLIC https URL
 * (e.g. https://hiremind-ai-service.onrender.com).
 */

const getAiServiceUrl = () => {
  const raw = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const clean = String(raw).trim().replace(/\/+$/, '');
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  // Bare hostnames: localhost / host:port stay http, public domains use https
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean) || /:\d+$/.test(clean)) {
    return `http://${clean}`;
  }
  return `https://${clean}`;
};

/**
 * Headers authenticating the backend to the AI service.
 * The AI service rejects requests without the shared AI_SERVICE_API_KEY.
 */
const getAiServiceHeaders = (extra = {}) => {
  const headers = { ...extra };
  const apiKey = process.env.AI_SERVICE_API_KEY;
  if (apiKey) {
    headers['X-Internal-Api-Key'] = apiKey;
  }
  return headers;
};

module.exports = {
  getAiServiceUrl,
  getAiServiceHeaders,
  AI_SERVICE_URL: getAiServiceUrl(),
};
