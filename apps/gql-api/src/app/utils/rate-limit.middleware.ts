/**
 * Rate Limiting Middleware for GQL-API
 *
 * Applies IP-based rate limiting to all endpoints using the CheckIpRate algorithm
 * from docs/bad-actors.md
 *
 * Rate limits:
 * - 100 requests per second per IP (enforced at second-level granularity)
 * - Approximately 6,000 requests per minute per IP
 * - Sliding window: ~5,900 to ~6,100 requests per 60 seconds
 */

import { Request, Response, NextFunction } from 'express';
import { CheckIpRate } from '@auth-ui/lib/CheckIpRate';

/**
 * Extract client IP address from request, handling proxies and forwarded headers
 *
 * @param req - Express request object
 * @returns Client IP address
 */
export function extractClientIp(req: Request): string {
  // Priority order for IP extraction:
  // 1. X-Forwarded-For (proxy/load balancer)
  // 2. X-Real-IP (nginx proxy)
  // 3. CF-Connecting-IP (Cloudflare)
  // 4. req.ip (Express)
  // 5. req.socket.remoteAddress (direct connection)

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list: "client, proxy1, proxy2"
    // Take the first (leftmost) IP which is the original client
    const ips = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',');
    const clientIp = ips[0].trim();
    if (clientIp) return clientIp;
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return typeof cfConnectingIp === 'string' ? cfConnectingIp : cfConnectingIp[0];
  }

  if (req.ip) {
    return req.ip;
  }

  if (req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // Fallback to unknown if we can't determine IP
  return 'unknown';
}

/**
 * Rate limiting middleware factory
 *
 * Creates an Express middleware that enforces rate limiting per IP address
 *
 * @param options - Configuration options
 * @returns Express middleware function
 */
export interface RateLimitOptions {
  /**
   * Skip rate limiting for certain paths (regex patterns)
   * Example: [/^\/status$/] to skip /status endpoint
   */
  skipPaths?: RegExp[];

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Custom HTTP status code (default: 429 Too Many Requests)
   */
  statusCode?: number;

  /**
   * Whether to log rate limit violations
   */
  logViolations?: boolean;
}

export function rateLimitMiddleware(options: RateLimitOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    skipPaths = [],
    message = 'Rate limit exceeded. Maximum 100 requests per second allowed per IP address.',
    statusCode = 429,
    logViolations = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if path should skip rate limiting
    const path = req.path;
    const shouldSkip = skipPaths.some(pattern => pattern.test(path));

    if (shouldSkip) {
      next();
      return;
    }

    // Extract client IP
    const clientIp = extractClientIp(req);

    // Get current timestamp
    const currentTimeMs = Date.now();

    // Check rate limit
    const allowed = CheckIpRate(clientIp, currentTimeMs);

    if (!allowed) {
      // Log violation if enabled
      if (logViolations) {
        console.warn(`[Rate Limit] IP ${clientIp} exceeded rate limit on ${req.method} ${req.path} at ${new Date(currentTimeMs).toISOString()}`);
      }

      // Send 429 Too Many Requests response
      res.status(statusCode).json({
        error: 'Too Many Requests',
        message,
        statusCode,
        timestamp: new Date(currentTimeMs).toISOString(),
        path: req.path,
        retryAfter: 1 // Retry after 1 second
      });
      return;
    }

    // Rate limit check passed, continue to next middleware
    next();
  };
}

/**
 * Pre-configured rate limiting middleware for common use cases
 */
export const rateLimiters = {
  /**
   * Standard rate limiter for all endpoints (100 req/sec per IP)
   */
  standard: rateLimitMiddleware({
    logViolations: true
  }),

  /**
   * Strict rate limiter for authentication endpoints
   * Same 100 req/sec limit but with custom message
   */
  auth: rateLimitMiddleware({
    message: 'Too many authentication attempts. Maximum 100 requests per second allowed per IP address.',
    logViolations: true
  }),

  /**
   * Lenient rate limiter that skips health check endpoints
   */
  withHealthCheckExemption: rateLimitMiddleware({
    skipPaths: [/^\/status$/, /^\/health$/],
    logViolations: true
  })
};
