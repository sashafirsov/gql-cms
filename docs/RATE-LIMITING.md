# Rate Limiting Implementation

This document describes the IP-based rate limiting system implemented for the GQL-API service.

## Overview

Rate limiting is implemented using the algorithm specified in `docs/bad-actors.md` to prevent DoS attacks and abuse. The system enforces a limit of **100 requests per second per IP address** with O(1) state complexity.

## Algorithm

The implementation uses a "second-bucket" approach:

```
Keep, per IP, a {second_bucket_start, count} on each request.

If floor(now) equals second_bucket_start then ++count,
else reset to (floor(now), 1).

Allow the request if count ≤ 100, otherwise reject.
```

This enforces a coarse "≤100 per labeled second" cap with minimal memory overhead.

### Request Bounds

- **Per labeled minute** (e.g., 12:34:00–12:34:59): max = 6,000, min = 0
- **Any 60-second sliding window**: max ≈ 6,100, min ≈ 5,900

## Implementation Details

### Files

| File | Purpose |
|------|---------|
| `lib/auth-ui/src/lib/CheckIpRate.ts` | Core rate limiting algorithm implementation (shared library) |
| `apps/gql-api/src/app/utils/rate-limit.middleware.ts` | Express middleware wrapper |
| `apps/gql-api/src/main.ts` | Middleware integration and cleanup scheduler |
| `apps/gql-api/webpack.config.cjs` | Webpack configuration with `@auth-ui` alias for library imports |

### Key Components

#### 1. CheckIpRate Function

Located in `lib/auth-ui/src/lib/CheckIpRate.ts` (shared library, imported by gql-api):

```typescript
export function CheckIpRate(ip: string, timeMs: number): boolean
```

- **Parameters:**
  - `ip`: Client IP address
  - `timeMs`: Current timestamp in milliseconds

- **Returns:** `true` if request is allowed, `false` if rate limit exceeded

- **Algorithm:** O(1) time and space complexity using in-memory Map

#### 2. Rate Limit Middleware

Located in `apps/gql-api/src/app/utils/rate-limit.middleware.ts`:

```typescript
export function rateLimitMiddleware(options?: RateLimitOptions): Middleware
```

- Extracts client IP from request headers (handles proxies)
- Checks rate limit using `CheckIpRate`
- Returns HTTP 429 (Too Many Requests) if limit exceeded
- Supports path exemptions (e.g., health checks)

**IP Extraction Priority:**
1. `X-Forwarded-For` header (first IP in comma-separated list)
2. `X-Real-IP` header (nginx proxy)
3. `CF-Connecting-IP` header (Cloudflare)
4. `req.ip` (Express)
5. `req.socket.remoteAddress` (direct connection)

#### 3. Periodic Cleanup

To prevent memory leaks, a cleanup job runs every 60 seconds:

```typescript
setInterval(() => {
  cleanupOldBuckets(Date.now(), 60); // Remove buckets older than 60 seconds
}, 60000);
```

This removes stale IP buckets that haven't received requests recently.

## Protected Endpoints

Rate limiting is applied to **all endpoints** except exempted health checks:

### Protected Endpoints ✅

- `POST /graphql` - GraphQL API
- `POST /northwind/auth/register` - User registration
- `POST /northwind/auth/login` - User authentication
- `POST /northwind/auth/refresh` - Token refresh
- `POST /northwind/auth/logout` - Logout single device
- `POST /northwind/auth/logout-all` - Logout all devices
- `GET /northwind/auth/me` - Get current user
- `POST /gql-cms/auth/register` - GQL-CMS user registration
- `POST /gql-cms/auth/login` - GQL-CMS authentication
- `POST /gql-cms/auth/refresh` - GQL-CMS token refresh
- `POST /gql-cms/auth/logout` - GQL-CMS logout
- `POST /gql-cms/auth/logout-all` - GQL-CMS logout all
- `GET /gql-cms/auth/me` - GQL-CMS get current user

### Exempted Endpoints ⚪

- `GET /status` - Health check endpoint
- `GET /health` - Health check endpoint (if added)

## Configuration

### Rate Limit Options

```typescript
interface RateLimitOptions {
  skipPaths?: RegExp[];      // Paths to exempt (default: [])
  message?: string;          // Custom error message
  statusCode?: number;       // Custom HTTP status (default: 429)
  logViolations?: boolean;   // Log violations (default: true)
}
```

### Pre-configured Limiters

```typescript
import { rateLimiters } from './app/utils/rate-limit.middleware';

// Standard rate limiter (100 req/sec)
app.use(rateLimiters.standard);

// Auth-specific with custom message
app.use(rateLimiters.auth);

// With health check exemption (used in production)
app.use(rateLimiters.withHealthCheckExemption);
```

## Error Response

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per second allowed per IP address.",
  "statusCode": 429,
  "timestamp": "2025-11-09T23:03:33.964Z",
  "path": "/graphql",
  "retryAfter": 1
}
```

**HTTP Headers:**
- Status Code: `429 Too Many Requests`
- `retryAfter`: Suggests client to retry after 1 second

## Logging

Rate limit violations are logged to console:

```
[Rate Limit] IP 192.168.1.1 exceeded rate limit on POST /graphql at 2025-11-09T23:03:33.964Z
```

To disable logging:

```typescript
rateLimitMiddleware({ logViolations: false })
```

## Testing

### Manual Testing

Test rate limiting with curl:

```bash
# Send 105 rapid requests to GraphQL endpoint
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:5433/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' &
done
wait

# Check logs for rate limit violations
docker logs gql-cms-gql-api 2>&1 | grep "Rate Limit"
```

### Expected Results

- First 100 requests in the same second: HTTP 200
- Requests 101+: HTTP 429 (rate limited)
- New second resets the counter

### Automated Tests

Run comprehensive test suite:

```bash
/tmp/rate_limit_summary_test.sh
```

## Production Considerations

### 1. Distributed Deployments

**Current Implementation:**
- In-memory storage (single node only)
- State is NOT shared across multiple instances

**For Multi-Node Deployments:**
- Use Redis or similar distributed cache
- Implement shared rate limit state
- Example using `ioredis`:

```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function CheckIpRateDistributed(ip: string, timeMs: number): Promise<boolean> {
  const currentSecond = Math.floor(timeMs / 1000);
  const key = `rate_limit:${ip}:${currentSecond}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 2); // Expire after 2 seconds
  }

  return count <= 100;
}
```

### 2. Memory Management

**Current Implementation:**
- Cleanup runs every 60 seconds
- Removes buckets older than 60 seconds
- Memory usage: O(unique IPs per minute)

**For High Traffic:**
- Adjust cleanup interval: `setInterval(() => cleanupOldBuckets(Date.now(), 30), 30000)`
- Monitor memory usage with heap snapshots
- Consider LRU cache with max size

### 3. IP Spoofing Protection

**Trust Proxy Headers Carefully:**
- Only trust `X-Forwarded-For` from known proxies
- Validate proxy chain authenticity
- Use `CF-Connecting-IP` only behind Cloudflare
- Consider using Express `trust proxy` setting

### 4. Advanced Rate Limiting

**Per-User Rate Limits:**
- Use `req.auth.userId` instead of IP
- Require authentication for stricter limits
- Example: Authenticated users get higher limits

**Tiered Rate Limits:**
- Different limits for different endpoints
- Premium users get higher limits
- Burst allowances for certain actions

### 5. Monitoring

**Recommended Metrics:**
- Rate limit violations per IP
- Top rate-limited IPs
- Average requests per IP
- Cleanup job performance

**Example Logging:**
```typescript
// Add to rate-limit.middleware.ts
if (!allowed) {
  // Send to monitoring service
  metrics.increment('rate_limit.violations', {
    ip: clientIp,
    path: req.path,
    method: req.method
  });
}
```

## Troubleshooting

### Issue: Rate limiting not working

**Check:**
1. Middleware is applied in `main.ts`
2. Requests are coming from same IP within same second
3. Logs show "Rate limiting enabled" message

### Issue: Legitimate traffic being blocked

**Solutions:**
1. Increase limit (edit `MAX_REQUESTS_PER_SECOND` in `CheckIpRate.ts`)
2. Exempt specific paths (add to `skipPaths`)
3. Use per-user rate limits instead of per-IP

### Issue: Memory leak

**Check:**
1. Cleanup job is running (check logs for "Rate limit buckets cleaned up")
2. Cleanup interval is appropriate for traffic volume
3. Monitor process memory with `docker stats`

### Issue: Rate limits not working across multiple nodes

**Solution:**
- Implement distributed rate limiting with Redis (see Production Considerations)

## Future Enhancements

1. **Redis Backend** - For distributed deployments
2. **Per-User Limits** - Different limits based on authentication
3. **Tiered Limits** - Premium users get higher limits
4. **Rate Limit Headers** - Return `X-RateLimit-*` headers
5. **Configurable Limits** - Environment variable configuration
6. **Rate Limit API** - Endpoint to check remaining quota
7. **Whitelist/Blacklist** - IP-based access control

## Shared Library Usage

The `CheckIpRate` implementation is in the shared `@auth-ui` library:

**Library location**: `lib/auth-ui/src/lib/CheckIpRate.ts`

**Import in gql-api**:
```typescript
import { CheckIpRate, cleanupOldBuckets } from '@auth-ui/lib/CheckIpRate';
```

**Webpack configuration**: The `@auth-ui` path alias is configured in `apps/gql-api/webpack.config.cjs`:
```javascript
resolve: {
  alias: {
    '@auth-ui': join(__dirname, '../../lib/auth-ui/src'),
  },
}
```

This allows the backend to use the same rate limiting code as the frontend without duplication.

## References

- Algorithm specification: `docs/bad-actors.md`
- Shared implementation: `lib/auth-ui/src/lib/CheckIpRate.ts`
- Middleware: `apps/gql-api/src/app/utils/rate-limit.middleware.ts`
- Integration: `apps/gql-api/src/main.ts`
- Webpack config: `apps/gql-api/webpack.config.cjs`
