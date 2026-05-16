import { describe, expect, it } from 'vitest';
import { TimezoneUtils } from './timezone';

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
});
