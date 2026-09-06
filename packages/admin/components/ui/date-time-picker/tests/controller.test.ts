import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateTimePickerController } from '@/components/ui/date-time-picker/controller';
import { TimezoneUtils } from '@/lib/timezone';

describe('DateTimePickerController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('date-only mode commits the literal picked calendar day, not a UTC-shifted instant', () => {
    // Europe/Sofia is UTC+3 in August: local midnight of Aug 11 is Aug 10 21:00Z, so an
    // instant-based commit hands every date-part consumer the PREVIOUS day.
    vi.spyOn(TimezoneUtils, 'resolveSystemTimezone').mockReturnValue('Europe/Sofia');

    const iso = DateTimePickerController.computeCommitIso(
      { showTime: false, onChange: () => undefined },
      new Date(2026, 7, 11),
    );

    expect(iso).toBe('2026-08-11');
  });

  it('date-only mode commits the literal day in negative-offset timezones too', () => {
    vi.spyOn(TimezoneUtils, 'resolveSystemTimezone').mockReturnValue('America/New_York');

    const iso = DateTimePickerController.computeCommitIso(
      { showTime: false, onChange: () => undefined },
      new Date(2026, 7, 11),
    );

    expect(iso).toBe('2026-08-11');
  });

  it('datetime mode still commits a zone-resolved UTC instant', () => {
    vi.spyOn(TimezoneUtils, 'resolveSystemTimezone').mockReturnValue('Europe/Sofia');

    const iso = DateTimePickerController.computeCommitIso(
      { showTime: true, value: '2026-08-10T21:00:00.000Z', onChange: () => undefined },
      new Date(2026, 7, 11),
    );

    expect(iso).toBe('2026-08-10T21:00:00.000Z');
  });

  it('reads a literal date-only value back as that same calendar day in any timezone', () => {
    vi.spyOn(TimezoneUtils, 'resolveSystemTimezone').mockReturnValue('America/New_York');

    const parts = DateTimePickerController.getZonedParts('2026-08-11');

    expect(parts).toMatchObject({ year: 2026, month: 8, day: 11 });
  });
});
