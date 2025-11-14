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
interface IpBucket {
    secondBucketStart: number;
    count: number;
}
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
export declare function CheckIpRate(ip: string, timeMs: number): boolean;
/**
 * Clear old IP buckets to prevent memory leaks.
 * Should be called periodically (e.g., every minute) to remove stale entries.
 *
 * @param currentTimeMs - Current timestamp in milliseconds
 * @param maxAgeSeconds - Maximum age of buckets to keep (default: 60 seconds)
 */
export declare function cleanupOldBuckets(currentTimeMs: number, maxAgeSeconds?: number): boolean;
/**
 * Get current bucket state for an IP (for testing/debugging)
 *
 * @param ip - The IP address to query
 * @returns The bucket state or undefined if no bucket exists
 */
export declare function getIpBucketState(ip: string): IpBucket | undefined;
/**
 * Clear all IP buckets (for testing)
 */
export declare function clearAllBuckets(): void;
/**
 * Get the total number of tracked IPs
 *
 * @returns The number of IPs currently being tracked
 */
export declare function getTrackedIpCount(): number;
export {};
//# sourceMappingURL=CheckIpRate.d.ts.map