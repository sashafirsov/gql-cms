/**
 * Tests for CheckIpRate function
 *
 * These tests verify the IP rate limiting algorithm implementation
 */

import {
  CheckIpRate,
  clearAllBuckets,
  getIpBucketState,
  cleanupOldBuckets,
  getTrackedIpCount
} from './CheckIpRate';

describe('CheckIpRate', () => {
  beforeEach(() => {
    // Clear all buckets before each test
    clearAllBuckets();
  });

  it('should allow first request from an IP', () => {
    const ip = '192.168.1.1';
    const timeMs = 1000000000000; // Some timestamp

    const result = CheckIpRate(ip, timeMs);

    expect(result).toBe(true);
    expect(getIpBucketState(ip)).toEqual({
      secondBucketStart: Math.floor(timeMs / 1000),
      count: 1
    });
  });

  it('should allow up to 100 requests per second', () => {
    const ip = '192.168.1.1';
    const timeMs = 1000000000000;

    // Make 100 requests in the same second
    for (let i = 0; i < 100; i++) {
      const result = CheckIpRate(ip, timeMs + i); // Add milliseconds but still same second
      expect(result).toBe(true);
    }

    const bucket = getIpBucketState(ip);
    expect(bucket?.count).toBe(100);
  });

  it('should reject 101st request in the same second', () => {
    const ip = '192.168.1.1';
    const timeMs = 1000000000000;

    // Make 100 requests (all should pass)
    for (let i = 0; i < 100; i++) {
      CheckIpRate(ip, timeMs + i);
    }

    // 101st request should fail
    const result = CheckIpRate(ip, timeMs + 100);
    expect(result).toBe(false);

    const bucket = getIpBucketState(ip);
    expect(bucket?.count).toBe(101);
  });

  it('should reset counter in a new second', () => {
    const ip = '192.168.1.1';
    const timeMs = 1000000000000;

    // Make 100 requests in first second
    for (let i = 0; i < 100; i++) {
      CheckIpRate(ip, timeMs + i);
    }

    // Make request in next second (add 1000ms)
    const result = CheckIpRate(ip, timeMs + 1000);
    expect(result).toBe(true);

    const bucket = getIpBucketState(ip);
    expect(bucket?.count).toBe(1);
    expect(bucket?.secondBucketStart).toBe(Math.floor((timeMs + 1000) / 1000));
  });

  it('should track multiple IPs independently', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';
    const timeMs = 1000000000000;

    // IP1 makes 100 requests
    for (let i = 0; i < 100; i++) {
      CheckIpRate(ip1, timeMs + i);
    }

    // IP2 should still be able to make requests
    const result = CheckIpRate(ip2, timeMs);
    expect(result).toBe(true);

    expect(getIpBucketState(ip1)?.count).toBe(100);
    expect(getIpBucketState(ip2)?.count).toBe(1);
    expect(getTrackedIpCount()).toBe(2);
  });

  it('should allow approximately 6000 requests per minute', () => {
    const ip = '192.168.1.1';
    const baseTimeMs = 1000000000000;
    let allowedCount = 0;

    // Simulate 60 seconds, 100 requests per second
    for (let second = 0; second < 60; second++) {
      const timeMs = baseTimeMs + (second * 1000);

      for (let req = 0; req < 100; req++) {
        const result = CheckIpRate(ip, timeMs + req);
        if (result) {
          allowedCount++;
        }
      }
    }

    // Should allow exactly 6000 requests (100 per second * 60 seconds)
    expect(allowedCount).toBe(6000);
  });

  it('should cleanup old buckets', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';
    const baseTimeMs = 1000000000000;

    // IP1 makes request at baseTimeMs
    CheckIpRate(ip1, baseTimeMs);

    // IP2 makes request 30 seconds later
    CheckIpRate(ip2, baseTimeMs + 30000);

    expect(getTrackedIpCount()).toBe(2);

    // Cleanup old buckets (older than 20 seconds from baseTimeMs + 30000)
    cleanupOldBuckets(baseTimeMs + 30000, 20);

    // IP1 should be removed (30 seconds old)
    // IP2 should remain (0 seconds old)
    expect(getTrackedIpCount()).toBe(1);
    expect(getIpBucketState(ip1)).toBeUndefined();
    expect(getIpBucketState(ip2)).toBeDefined();
  });

  it('should handle edge case: request exactly at second boundary', () => {
    const ip = '192.168.1.1';
    const timeMs = 1000000000000; // Exactly at second boundary

    const result1 = CheckIpRate(ip, timeMs);
    const result2 = CheckIpRate(ip, timeMs + 999); // Last millisecond of same second

    expect(result1).toBe(true);
    expect(result2).toBe(true);

    const bucket = getIpBucketState(ip);
    expect(bucket?.count).toBe(2);
    expect(bucket?.secondBucketStart).toBe(Math.floor(timeMs / 1000));
  });

  it('should handle burst followed by quiet period', () => {
    const ip = '192.168.1.1';
    const baseTimeMs = 1000000000000;

    // Burst: 100 requests in first second
    for (let i = 0; i < 100; i++) {
      CheckIpRate(ip, baseTimeMs + i);
    }

    // Quiet: 10 seconds pass
    // New request after 10 seconds
    const result = CheckIpRate(ip, baseTimeMs + 10000);
    expect(result).toBe(true);

    const bucket = getIpBucketState(ip);
    expect(bucket?.count).toBe(1);
  });
});
