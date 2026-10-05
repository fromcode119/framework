import { describe, expect, it } from 'vitest';
import { NotificationTime } from '@/lib/notification-time';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('NotificationTime', () => {
  it('says "now" for something that just happened', () => {
    expect(NotificationTime.relative(ago(10), NOW)).toMatch(/now/i);
  });

  it('counts minutes, hours and days while it is recent', () => {
    expect(NotificationTime.relative(ago(5 * 60), NOW)).toMatch(/5 minutes ago/);
    expect(NotificationTime.relative(ago(3 * 3600), NOW)).toMatch(/3 hours ago/);
    expect(NotificationTime.relative(ago(2 * 86400), NOW)).toMatch(/2 days ago/);
  });

  it('switches to a date once it is a week old', () => {
    expect(NotificationTime.relative(ago(8 * 86400), NOW)).toMatch(/Sep/);
    expect(NotificationTime.relative(ago(8 * 86400), NOW)).not.toMatch(/ago/);
  });

  it('gives nothing for a value that is not a date, rather than inventing one', () => {
    expect(NotificationTime.relative('', NOW)).toBe('');
    expect(NotificationTime.relative('soon', NOW)).toBe('');
    expect(NotificationTime.absolute(undefined)).toBe('');
  });

  it('writes the exact moment for the tooltip', () => {
    expect(NotificationTime.absolute(ago(0))).toMatch(/2026/);
  });
});
