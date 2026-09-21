import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';

/**
 * Wall-clock `HH:mm` arithmetic for TIME granularity. A time of day is NOT an instant: it carries
 * no date and is never converted through a timezone, so none of {@link DateTimePickerController}'s
 * UTC math applies to it. Kept separate for exactly that reason.
 */
export class TimeOfDayUtils {
  private static readonly PATTERN = /^(\d{1,2}):(\d{2})/;

  /**
   * The hour and minute an operator has actually set. An unset value reads back as `null`, never
   * as `0` — a stepper showing `00:00` over a blank field states a time nobody chose.
   */
  static parse(value: string | undefined | null): { hour: number | null; minute: number | null } {
    const match = typeof value === 'string' ? TimeOfDayUtils.PATTERN.exec(value.trim()) : null;
    if (!match) return { hour: null, minute: null };
    return {
      hour: TimeOfDayUtils.clamp(Number.parseInt(match[1], 10), 23),
      minute: TimeOfDayUtils.clamp(Number.parseInt(match[2], 10), 59),
    };
  }

  /** Replace one part of a time, filling the untouched part with `0` only once the operator edits. */
  static withPart(value: string | undefined | null, part: TimePart, next: string): string {
    const current = TimeOfDayUtils.parse(value);
    const parsed = Number.parseInt(next, 10);
    const edited = TimeOfDayUtils.clamp(Number.isNaN(parsed) ? 0 : parsed, part === TimePart.HOURS ? 23 : 59);
    const hour = part === TimePart.HOURS ? edited : current.hour ?? 0;
    const minute = part === TimePart.MINUTES ? edited : current.minute ?? 0;
    return TimeOfDayUtils.format(hour, minute);
  }

  /** `9, 5` → `09:05`. */
  static format(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  /** Minutes since midnight, or `null` when nothing is set. */
  static toMinutes(value: string | undefined | null): number | null {
    const { hour, minute } = TimeOfDayUtils.parse(value);
    return hour === null || minute === null ? null : hour * 60 + minute;
  }

  private static clamp(value: number, max: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(max, Math.max(0, value));
  }
}
