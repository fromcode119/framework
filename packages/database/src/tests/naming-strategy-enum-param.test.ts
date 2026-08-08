import { describe, expect, it } from 'vitest';
import { Enum } from '@fromcode119/reactor';
import { NamingStrategy } from '@database/naming-strategy';

class ScheduleKind extends Enum {
  static readonly CRON = new ScheduleKind('cron');
  static readonly INTERVAL = new ScheduleKind('interval');
  private constructor(value: string) { super(value); }
}

/**
 * An object whose `toJSON()` yields a primitive stands FOR that primitive and must be stored as one.
 *
 * `JSON.stringify` would quote it: a reactor `Enum` returns its value from `toJSON()`, so writing
 * `ScheduleKind.INTERVAL` put the literal `"interval"` in the column. Nothing matched it on read, and
 * the scheduler's `resolve` fell through to its CRON default — a `2m` interval task was then validated
 * as a cron expression on every boot.
 */
describe('NamingStrategy.normalizeParamValue', () => {
  it('stores an Enum by value, not as a quoted JSON string', () => {
    expect(NamingStrategy.normalizeParamValue(ScheduleKind.INTERVAL)).toBe('interval');
    expect(NamingStrategy.normalizeParamValue(ScheduleKind.CRON)).toBe('cron');
  });

  it('still JSON-encodes real objects and arrays', () => {
    expect(NamingStrategy.normalizeParamValue({ a: 1 })).toBe('{"a":1}');
    expect(NamingStrategy.normalizeParamValue([1, 2])).toBe('[1,2]');
  });

  it('honours a toJSON that returns an object by encoding it', () => {
    const shaped = { toJSON: () => ({ nested: true }) };
    expect(NamingStrategy.normalizeParamValue(shaped)).toBe('{"nested":true}');
  });

  it('leaves primitives, Date, null and undefined alone', () => {
    const when = new Date('2026-01-01T00:00:00.000Z');
    expect(NamingStrategy.normalizeParamValue(when)).toBe(when);
    expect(NamingStrategy.normalizeParamValue('x')).toBe('x');
    expect(NamingStrategy.normalizeParamValue(7)).toBe(7);
    expect(NamingStrategy.normalizeParamValue(null)).toBeNull();
    expect(NamingStrategy.normalizeParamValue(undefined)).toBeNull();
  });
});
