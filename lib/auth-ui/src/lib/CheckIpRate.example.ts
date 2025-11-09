/**
 * Usage examples for CheckIpRate function
 *
 * This file demonstrates how to integrate IP rate limiting into your application
 */

import { CheckIpRate, cleanupOldBuckets } from './CheckIpRate';

// Example 1: Basic usage in a request handler
export function handleRequest(req: { ip: string }): { allowed: boolean; message?: string } {
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(req.ip, currentTimeMs);

  if (!allowed) {
    return {
      allowed: false,
      message: 'Rate limit exceeded. Maximum 100 requests per second allowed.'
    };
  }

  return { allowed: true };
}

// Example 2: Middleware pattern for Next.js API routes
export function rateLimitMiddleware(handler: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    // Get client IP (handle proxies)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.socket.remoteAddress ||
               'unknown';

    const currentTimeMs = Date.now();
    const allowed = CheckIpRate(ip, currentTimeMs);

    if (!allowed) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 1 // seconds
      });
      return;
    }

    // Continue to actual handler
    return handler(req, res);
  };
}

// Example 3: Express/NestJS middleware
export function expressRateLimitMiddleware(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(ip, currentTimeMs);

  if (!allowed) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Maximum 100 requests per second allowed.',
      retryAfter: 1
    });
    return;
  }

  next();
}

// Example 4: Periodic cleanup (run every minute)
// This should be set up once when your application starts
export function startCleanupScheduler() {
  // Run cleanup every 60 seconds
  setInterval(() => {
    const currentTimeMs = Date.now();
    cleanupOldBuckets(currentTimeMs, 60); // Remove buckets older than 60 seconds
    console.log('IP rate limit buckets cleaned up');
  }, 60000); // Every 60 seconds
}

// Example 5: Next.js Server Action with rate limiting
export async function createShortUrlAction(ip: string, fullUrl: string) {
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(ip, currentTimeMs);

  if (!allowed) {
    throw new Error('Rate limit exceeded. Please wait before creating more URLs.');
  }

  // Proceed with creating the short URL
  // ... your logic here
}

// Example 6: GraphQL resolver with rate limiting
export async function createDocumentResolver(
  parent: any,
  args: { fullUrl: string; shortUrl: string; comment?: string },
  context: { ip: string }
) {
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(context.ip, currentTimeMs);

  if (!allowed) {
    throw new Error('Rate limit exceeded. Maximum 100 requests per second allowed.');
  }

  // Proceed with creating the document
  // ... your logic here
}

// Example 7: Custom rate limit check with logging
export function checkRateLimitWithLogging(ip: string): boolean {
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(ip, currentTimeMs);

  if (!allowed) {
    console.warn(`[Rate Limit] IP ${ip} exceeded rate limit at ${new Date(currentTimeMs).toISOString()}`);
  }

  return allowed;
}

// Example 8: Rate limit check for specific actions (URL creation, user registration, etc.)
export function rateLimitAction(ip: string, action: string): { allowed: boolean; error?: string } {
  const currentTimeMs = Date.now();
  const allowed = CheckIpRate(ip, currentTimeMs);

  if (!allowed) {
    return {
      allowed: false,
      error: `Rate limit exceeded for action "${action}". Please wait before trying again.`
    };
  }

  return { allowed: true };
}
