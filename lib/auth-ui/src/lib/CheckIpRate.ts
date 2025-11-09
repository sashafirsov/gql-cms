/**
 * IP Rate Limiting Implementation
 *
 * Based on the IP limit algorithm from docs/bad-actors.md:
 * Keep, per IP, a {second_bucket_start, count} on each request.
 * If floor(now) equals second_bucket_start then ++count, else reset to (floor(now), 1).
 * Allow the request if count ≤ 100, otherwise reject—this enforces a coarse
 * "≤100 per labeled second" cap with O(1) state.
 *
 * Bounds:
 * - Per labeled minute (e.g., 12:34:00–12:34:59): max = 6,000, min = 0
 * - Any 60-second sliding window: max ≈ 6,100, min ≈ 5,900
 */

// State storage for IP rate limiting
interface IpBucket {
    secondBucketStart: number; // Unix timestamp in seconds
    count: number;
}

// In-memory storage for IP buckets
const ipBuckets = new Map<string, IpBucket>();

// Rate limit constant
const MAX_REQUESTS_PER_SECOND = 100;

/**
 * Check if an IP address has exceeded the rate limit.
 *
 * Algorithm: Keep, per IP, a {second_bucket_start, count} on each request.
 * If floor(now) equals second_bucket_start then ++count, else reset to (floor(now), 1).
 * Allow the request if count ≤ 100, otherwise reject.
 *
 * @param ip - The IP address to check
 * @param timeMs - Current timestamp in milliseconds
 * @returns true if the rate limit is NOT exceeded (request allowed), false otherwise
 */
export function CheckIpRate(ip: string, timeMs: number): boolean {
    // Convert milliseconds to seconds (floor division)
    const currentSecond = Math.floor(timeMs / 1000);

    // Get existing bucket for this IP
    const bucket = ipBuckets.get(ip);

    if (!bucket) {
        // First request from this IP
        ipBuckets.set(ip, {
            secondBucketStart: currentSecond,
            count: 1,
        });
        return true; // Allow first request
    }

    if (bucket.secondBucketStart === currentSecond) {
        // Same second bucket, increment count
        bucket.count++;

        // Check if limit exceeded
        if (bucket.count > MAX_REQUESTS_PER_SECOND) {
            return false; // Rate limit exceeded - reject request
        }

        return true; // Within rate limit - allow request
    } else {
        // New second bucket, reset counter
        bucket.secondBucketStart = currentSecond;
        bucket.count = 1;
        return true; // Allow request in new second
    }
}

/**
 * Clear old IP buckets to prevent memory leaks.
 * Should be called periodically (e.g., every minute) to remove stale entries.
 *
 * @param currentTimeMs - Current timestamp in milliseconds
 * @param maxAgeSeconds - Maximum age of buckets to keep (default: 60 seconds)
 */
export function cleanupOldBuckets(
    currentTimeMs: number,
    maxAgeSeconds = 60
): boolean {
    const currentSecond = Math.floor(currentTimeMs / 1000);
    const cutoffSecond = currentSecond - maxAgeSeconds;
    let cleaned = false;
    // Convert to array for compatible iteration
    Array.from(ipBuckets.entries()).forEach(([ip, bucket]) => {
        if (bucket.secondBucketStart < cutoffSecond) {
            ipBuckets.delete(ip);
            cleaned = true;
        }
    });
    return cleaned;
}

/**
 * Get current bucket state for an IP (for testing/debugging)
 *
 * @param ip - The IP address to query
 * @returns The bucket state or undefined if no bucket exists
 */
export function getIpBucketState(ip: string): IpBucket | undefined {
    return ipBuckets.get(ip);
}

/**
 * Clear all IP buckets (for testing)
 */
export function clearAllBuckets(): void {
    ipBuckets.clear();
}

/**
 * Get the total number of tracked IPs
 *
 * @returns The number of IPs currently being tracked
 */
export function getTrackedIpCount(): number {
    return ipBuckets.size;
}
