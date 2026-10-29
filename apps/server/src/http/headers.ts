/**
 * Headers for every response. The page may load and connect only to its own
 * server, can't be framed, and leaks nothing through referrers.
 */
export function securityHeaders(host: string): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    // Svelte's transitions add keyframes in a <style> element.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ws://${host}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  return {
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "x-frame-options": "DENY",
  };
}
