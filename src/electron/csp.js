/**
 * Content Security Policy Configuration
 *
 * This module configures CSP headers for the Electron application.
 * Development and production modes have different policies:
 * - Development: Allows hot reload (unsafe-eval, localhost websockets)
 * - Production: Strict policy blocking all external sources
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */

const { session, app } = require('electron');

/**
 * CSP directives for production builds
 * Maximum security - no eval, no external connections
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Required for React/Tailwind CSS-in-JS
  "img-src 'self' data: blob:", // data: for inline images, blob: for dynamic
  "font-src 'self' data:", // data: for inline fonts
  "connect-src 'self'",
  "object-src 'none'", // Block plugins (Flash, Java, etc.)
  "base-uri 'self'", // Prevent base tag injection
  "form-action 'self'", // Restrict form submissions
  "frame-ancestors 'none'", // Prevent embedding (clickjacking)
  'upgrade-insecure-requests', // Force HTTPS for any external resources
].join('; ');

/**
 * CSP directives for development builds
 * Relaxed to support Vite hot module replacement
 */
const DEVELOPMENT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'", // Required for Vite HMR
  "style-src 'self' 'unsafe-inline'", // Required for React/Tailwind
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:* http://localhost:*", // Vite dev server
  "object-src 'none'",
].join('; ');

/**
 * Additional security headers applied in production
 */
const ADDITIONAL_SECURITY_HEADERS = {
  'X-Content-Type-Options': ['nosniff'],
  'X-Frame-Options': ['DENY'],
  'Referrer-Policy': ['strict-origin-when-cross-origin'],
};

/**
 * Setup Content Security Policy for the application
 * @param {Object} options Configuration options
 * @param {Function} options.debugLog Optional debug logging function
 */
function setupCSP({ debugLog = console.log } = {}) {
  const isDev = !app.isPackaged;
  const csp = isDev ? DEVELOPMENT_CSP : PRODUCTION_CSP;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [csp],
    };

    // Add additional security headers in production
    if (!isDev) {
      Object.assign(responseHeaders, ADDITIONAL_SECURITY_HEADERS);
    }

    callback({ responseHeaders });
  });

  debugLog(`[CSP] Configured for ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  debugLog(`[CSP] Policy: ${csp.substring(0, 100)}...`);
}

/**
 * Get the current CSP string (for testing/debugging)
 * @returns {string} Current CSP policy
 */
function getCurrentCSP() {
  return app.isPackaged ? PRODUCTION_CSP : DEVELOPMENT_CSP;
}

module.exports = {
  setupCSP,
  getCurrentCSP,
  PRODUCTION_CSP,
  DEVELOPMENT_CSP,
};
