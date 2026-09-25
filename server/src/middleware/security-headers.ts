import type { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * Security headers for a JSON API (NFR-S8, LLD §9). The API never serves HTML,
 * so the CSP forbids everything and framing; HSTS is sent on every response and
 * only honoured by browsers over HTTPS, which is what production uses (NFR-S1).
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // QR images are fetched by the admin UI from a sibling origin in production.
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
  });
}
