import { describe, expect, it } from 'vitest';
import { TimeOfDayUtils } from '@/components/ui/date-time-picker/time-of-day-utils';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';

describe('TimeOfDayUtils', () => {
  it('reads an unset value back as null, never as midnight', () => {
    // A stepper showing 00:00 over a blank field states a time nobody chose.
    expect(TimeOfDayUtils.parse('')).toEqual({ hour: null, minute: null });
    expect(TimeOfDayUtils.parse(undefined)).toEqual({ hour: null, minute: null });
    expect(TimeOfDayUtils.parse('not a time')).toEqual({ hour: null, minute: null });
  });

  it('parses and zero-pads a wall-clock time', () => {
    expect(TimeOfDayUtils.parse('09:05')).toEqual({ hour: 9, minute: 5 });
    expect(TimeOfDayUtils.parse('9:05')).toEqual({ hour: 9, minute: 5 });
    expect(TimeOfDayUtils.format(9, 5)).toBe('09:05');
  });

  it('clamps each part to its own range', () => {
    expect(TimeOfDayUtils.withPart('09:00', TimePart.HOURS, '99')).toBe('23:00');
    expect(TimeOfDayUtils.withPart('09:00', TimePart.MINUTES, '99')).toBe('09:59');
    expect(TimeOfDayUtils.withPart('09:30', TimePart.HOURS, '-4')).toBe('00:30');
  });

  it('keeps the untouched part when one part is edited', () => {
    expect(TimeOfDayUtils.withPart('09:30', TimePart.HOURS, '17')).toBe('17:30');
    expect(TimeOfDayUtils.withPart('09:30', TimePart.MINUTES, '0')).toBe('09:00');
    expect(TimeOfDayUtils.withPart('', TimePart.HOURS, '8')).toBe('08:00');
  });

  it('orders two times by minutes since midnight, and reports an unset one as null', () => {
    expect(TimeOfDayUtils.toMinutes('09:30')).toBe(570);
    expect(TimeOfDayUtils.toMinutes('00:00')).toBe(0);
    expect(TimeOfDayUtils.toMinutes('')).toBeNull();
  });

  it('TIME granularity renders and stores the literal HH:mm, and uses no calendar', () => {
    const time = DateTimePickerGranularity.TIME;
    expect(time.isTimeOfDay).toBe(true);
    expect(time.usesCalendar).toBe(false);
    expect(time.formatValue('09:00')).toBe('09:00');
    // Nothing may expand it into a date — a time of day has no day.
    expect(time.expandValue('09:00')).toBe('09:00');
  });

  it('leaves every other granularity unaffected', () => {
    expect(DateTimePickerGranularity.DATE.isTimeOfDay).toBe(false);
    expect(DateTimePickerGranularity.DATETIME.usesCalendar).toBe(true);
    expect(DateTimePickerGranularity.MONTH.formatValue('2026-08')).toBe('08.2026');
  });
});
