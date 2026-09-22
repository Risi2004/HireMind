/**
 * HireMind Centralized API Configuration
 * Supports Method 2: Direct URL connection via VITE_API_URL environment variable.
 *
 * In Production (Vercel): Set VITE_API_URL to your live Render backend URL (e.g., https://hiremind-backend.onrender.com)
 * In Local Development: If VITE_API_URL is omitted or empty, relative /api paths are used via Vite's proxy.
 */

const rawApiUrl = import.meta.env.VITE_API_URL || ''
export const API_BASE_URL = typeof rawApiUrl === 'string' ? rawApiUrl.replace(/\/+$/, '') : ''

/**
 * Prepends the backend base URL to any API endpoint
 * @param {string} endpoint - Path, e.g. '/api/auth/login'
 * @returns {string} - Full URL or relative path if base URL is not set
 */
export const getApiUrl = (endpoint = '') => {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath
}

export default getApiUrl
