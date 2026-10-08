import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A task's schedule in words: "every 2 minutes", "every day at 03:00". The common cron shapes are
 * worded; anything else is shown as the expression it is, labelled, rather than guessed at.
 */
export class JobScheduleText {
  private static readonly INTERVAL_UNIT: Record<string, string> = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week' };

  static describe(schedule: unknown): string {
    const text = String(schedule ?? '').trim();
    const interval = text.match(/^([\d.]+)([smhdw])$/);
    if (interval) return JobScheduleText.every(Number(interval[1]), JobScheduleText.INTERVAL_UNIT[interval[2]]);
    const cron = text.split(/\s+/);
    if (cron.length === 5) {
      const [minute, hour, day, month, weekday] = cron;
      const rest = day === '*' && month === '*' && weekday === '*';
      if (rest && hour === '*' && minute === '*') return JobScheduleText.every(1, 'minute');
      const stepMinutes = minute.match(/^\*\/(\d+)$/);
      if (rest && hour === '*' && stepMinutes) return JobScheduleText.every(Number(stepMinutes[1]), 'minute');
      if (rest && hour === '*' && /^\d+$/.test(minute)) return AdminI18n.t('jobs.schedule.hourlyAt', { minute: minute.padStart(2, '0') });
      const stepHours = hour.match(/^\*\/(\d+)$/);
      if (rest && stepHours && /^\d+$/.test(minute)) return JobScheduleText.every(Number(stepHours[1]), 'hour');
      if (rest && /^\d+$/.test(hour) && /^\d+$/.test(minute)) return AdminI18n.t('jobs.schedule.dailyAt', { time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` });
    }
    return AdminI18n.t('jobs.schedule.cron', { expression: text });
  }

  private static every(amount: number, unit: string): string {
    return amount === 1 ? AdminI18n.t(`jobs.schedule.everyOne.${unit}`) : AdminI18n.t(`jobs.schedule.every.${unit}`, { count: amount });
  }
}
