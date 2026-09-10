import { Enum } from '@fromcode119/react-class-components';

/**
 * What a {@link DateTimePicker} lets the operator pick — and therefore what it emits:
 * a full instant (ISO), a calendar day (`YYYY-MM-DD`), a month (`YYYY-MM`) or a year (`YYYY`).
 */
export class DateTimePickerGranularity extends Enum {
  static readonly DATETIME = new DateTimePickerGranularity('datetime');
  static readonly DATE = new DateTimePickerGranularity('date');
  static readonly MONTH = new DateTimePickerGranularity('month');
  static readonly YEAR = new DateTimePickerGranularity('year');

  private constructor(value: string) {
    super(value);
  }

  /** The full calendar (day grid) applies only to day-or-finer granularities. */
  get usesCalendar(): boolean {
    return this === DateTimePickerGranularity.DATETIME || this === DateTimePickerGranularity.DATE;
  }

  /** Expand a stored coarse value to a full date literal so the shared parsing can read it. */
  expandValue(value: string): string {
    if (this === DateTimePickerGranularity.YEAR && /^\d{4}$/.test(value)) return `${value}-01-01`;
    if (this === DateTimePickerGranularity.MONTH && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
    return value;
  }

  /** Render a stored value the way the operator picked it (`2026`, `08.2026`, …). */
  formatValue(value: string): string {
    if (this === DateTimePickerGranularity.YEAR) return value.slice(0, 4);
    if (this === DateTimePickerGranularity.MONTH) {
      const [year, month] = value.split('-');
      return month ? `${month}.${year}` : value;
    }
    return value;
  }
}
