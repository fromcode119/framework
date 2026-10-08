import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** How long a run took: milliseconds under a second, seconds under a minute, then minutes. */
export class JobDuration {
  static text(ms: unknown): string {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < 1000) return AdminI18n.t('jobs.duration.ms', { value: Math.round(value) });
    if (value < 60_000) return AdminI18n.t('jobs.duration.s', { value: (value / 1000).toFixed(1) });
    return AdminI18n.t('jobs.duration.m', { value: (value / 60_000).toFixed(1) });
  }
}
