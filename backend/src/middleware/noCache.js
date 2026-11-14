/**
 * Middleware that sets strict cache-prevention headers on sensitive API responses.
 * Enforces that user journal data and authentication state are never cached by
 * browsers, shared proxies, or intermediate CDNs.
 */
export function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
}

