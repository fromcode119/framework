import { describe, expect, it } from 'vitest';
import { TimezoneUtils } from '@/lib/timezone';

describe('TimezoneUtils', () => {
  it('keeps the selected calendar day for positive-offset timezones', () => {
    const utcDate = TimezoneUtils.zonedPartsToUtcDate({
      year: 2026,
      month: 5,
      day: 8,
      hour: 0,
      minute: 0,
      second: 0,
    }, 'Europe/Sofia');

    expect(utcDate.toISOString()).toBe('2026-05-07T21:00:00.000Z');
    expect(
      TimezoneUtils.formatSystemDateOnly(utcDate, '-', 'Europe/Sofia'),
    ).toContain('08');
  });

  it('round-trips zoned date parts without shifting the day', () => {
    const originalParts = {
      year: 2026,
      month: 5,
      day: 8,
      hour: 0,
      minute: 0,
      second: 0,
    };

    const utcDate = TimezoneUtils.zonedPartsToUtcDate(originalParts, 'Europe/Sofia');
    const roundTripped = TimezoneUtils.getZonedDateParts(utcDate, 'Europe/Sofia');

    expect(roundTripped).toEqual(originalParts);
  });

  it('formats a literal date-only value as that calendar day in negative-offset timezones', () => {
    // 'YYYY-MM-DD' parses as UTC midnight; formatting it through America/New_York would
    // otherwise render the PREVIOUS day. A bare date names a calendar day, not an instant.
    expect(TimezoneUtils.formatSystemDateOnly('2026-08-11', '-', 'America/New_York')).toContain('11');
  });

  it('extracts zoned parts of a literal date-only value without shifting the day', () => {
    const parts = TimezoneUtils.getZonedDateParts('2026-08-11', 'America/New_York');
    expect(parts).toMatchObject({ year: 2026, month: 8, day: 11, hour: 0 });
  });
});
