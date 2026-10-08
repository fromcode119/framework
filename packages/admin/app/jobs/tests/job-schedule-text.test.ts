import { describe, expect, it } from 'vitest';
import { JobScheduleText } from '@/app/jobs/job-schedule-text';

describe('JobScheduleText', () => {
  it('words the intervals and common cron shapes, and labels any other expression as cron', () => {
    expect(JobScheduleText.describe('2m')).toBe('Every 2 minutes');
    expect(JobScheduleText.describe('1h')).toBe('Every hour');
    expect(JobScheduleText.describe('* * * * *')).toBe('Every minute');
    expect(JobScheduleText.describe('*/15 * * * *')).toBe('Every 15 minutes');
    expect(JobScheduleText.describe('0 * * * *')).toBe('Every hour at :00');
    expect(JobScheduleText.describe('0 9 * * *')).toBe('Every day at 09:00');
    expect(JobScheduleText.describe('0 9 * * 1')).toBe('Cron: 0 9 * * 1');
  });
});
