import { describe, it, expect, beforeEach } from 'vitest';
import { FileShareRateLimiter } from '@api/services/file-share-rate-limiter';

/**
 * The anonymous share endpoints are the only unauthenticated route to stored bytes, so this throttle is
 * what stands between a stranger and enumerating tokens (or, holding a valid one, every media id in the
 * library) at whatever rate the global limiter allows.
 */
describe('FileShareRateLimiter', () => {
  beforeEach(() => FileShareRateLimiter.reset());

  it('allows requests up to the limit and refuses the next', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(FileShareRateLimiter.isLimited('1.2.3.4', 3)).toBe(false);
      FileShareRateLimiter.record('1.2.3.4');
    }
    expect(FileShareRateLimiter.isLimited('1.2.3.4', 3)).toBe(true);
  });

  it('keys on the address, so one caller cannot throttle another', () => {
    for (let i = 0; i < 5; i += 1) FileShareRateLimiter.record('1.2.3.4');

    expect(FileShareRateLimiter.isLimited('1.2.3.4', 3)).toBe(true);
    expect(FileShareRateLimiter.isLimited('5.6.7.8', 3)).toBe(false);
  });

  it('treats a non-positive limit as unmetered, matching the 0-means-unlimited convention', () => {
    for (let i = 0; i < 50; i += 1) FileShareRateLimiter.record('1.2.3.4');

    expect(FileShareRateLimiter.isLimited('1.2.3.4', 0)).toBe(false);
    expect(FileShareRateLimiter.isLimited('1.2.3.4', -1)).toBe(false);
  });

  it('starts a fresh window once the previous one has passed', () => {
    for (let i = 0; i < 3; i += 1) FileShareRateLimiter.record('1.2.3.4');
    expect(FileShareRateLimiter.isLimited('1.2.3.4', 3)).toBe(true);

    // Reach into the entry rather than waiting a real minute; the window boundary is the behaviour
    // under test, not the clock.
    (FileShareRateLimiter as any).store.get('1.2.3.4').resetAt = Date.now() - 1;

    expect(FileShareRateLimiter.isLimited('1.2.3.4', 3)).toBe(false);
    FileShareRateLimiter.record('1.2.3.4');
    expect((FileShareRateLimiter as any).store.get('1.2.3.4').count).toBe(1);
  });

  it('does not count an unseen address as limited', () => {
    expect(FileShareRateLimiter.isLimited('9.9.9.9', 1)).toBe(false);
  });
});
