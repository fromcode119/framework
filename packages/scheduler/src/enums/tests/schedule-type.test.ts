import { describe, expect, it } from 'vitest';
import { ScheduleType } from '@scheduler/enums/schedule-type.enum';

/**
 * A task's `type` round-trips through the database, and `resolve` defaults to CRON for anything it
 * cannot parse — so a value it fails to read does not merely get ignored, it turns an interval task
 * into a cron task.
 *
 * That happened in production. The dialect JSON-stringifies objects, and `JSON.stringify(enumMember)`
 * calls `toJSON()` -> 'interval' and then wraps THAT in quotes, so the column held the literal
 * `"interval"`. `resolve` matched no member, fell back to CRON, and every boot ran
 * `cron.validate('2m')` for the `content-workflows` task, logging "Invalid cron expression" and never
 * registering the job.
 */
describe('ScheduleType.resolve', () => {
  it('resolves the plain stored values', () => {
    expect(ScheduleType.resolve('interval')).toBe(ScheduleType.INTERVAL);
    expect(ScheduleType.resolve('cron')).toBe(ScheduleType.CRON);
  });

  it('heals the JSON-quoted form written by the old serialisation', () => {
    expect(ScheduleType.resolve('"interval"')).toBe(ScheduleType.INTERVAL);
    expect(ScheduleType.resolve('"cron"')).toBe(ScheduleType.CRON);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(ScheduleType.resolve('  INTERVAL  ')).toBe(ScheduleType.INTERVAL);
    expect(ScheduleType.resolve('"Interval"')).toBe(ScheduleType.INTERVAL);
  });

  it('passes a member through unchanged', () => {
    expect(ScheduleType.resolve(ScheduleType.INTERVAL)).toBe(ScheduleType.INTERVAL);
  });

  it('still defaults to CRON for genuinely unknown input', () => {
    expect(ScheduleType.resolve('weekly')).toBe(ScheduleType.CRON);
    expect(ScheduleType.resolve(null)).toBe(ScheduleType.CRON);
    expect(ScheduleType.resolve(undefined)).toBe(ScheduleType.CRON);
  });

  it('serialises by VALUE, so a member written to a column is a bare string', () => {
    expect(ScheduleType.INTERVAL.value).toBe('interval');
    expect(String(ScheduleType.INTERVAL)).toBe('interval');
  });
});
