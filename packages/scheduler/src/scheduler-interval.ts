/** An interval schedule (`30s`, `2m`, `1h`, `1d`, `1w`) and when it next comes round. */
export class SchedulerInterval {
  private static readonly UNIT_MS: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
  };

  static nextRun(schedule: string, now: Date): Date {
    const match = schedule.match(/^([\d.]+)([smhdw])$/);
    if (!match) return new Date(now.getTime() + 5 * 60000); // Default 5m if invalid
    const amount = parseFloat(match[1]);
    return new Date(now.getTime() + amount * (SchedulerInterval.UNIT_MS[match[2]] || 60000));
  }
}
