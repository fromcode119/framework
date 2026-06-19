import { TimezoneUtils } from '@/lib/timezone';
import type { DateTimePickerCoords, DateTimePickerProps } from './interfaces';

/**
 * Holds the non-render logic for {@link DateTimePicker}: viewport positioning, date
 * conversions between the stored UTC ISO value and the system timezone's zoned parts,
 * and the commit/clear/quick-action math. The component delegates here so its class
 * file stays under the size limit; behavior is identical to the original inline methods.
 */
export class DateTimePickerController {
  static get timezone(): string {
    return TimezoneUtils.resolveSystemTimezone();
  }

  static getUtcDate(value?: string): Date | null {
    return TimezoneUtils.parseDateValue(value);
  }

  static getZonedParts(value?: string) {
    return TimezoneUtils.getZonedDateParts(DateTimePickerController.getUtcDate(value), DateTimePickerController.timezone);
  }

  static getPickerDate(value?: string): Date | undefined {
    const zonedParts = DateTimePickerController.getZonedParts(value);
    return zonedParts
      ? new Date(zonedParts.year, zonedParts.month - 1, zonedParts.day, 12, 0, 0)
      : undefined;
  }

  static computeCoords(rect: DOMRect, showTime: boolean | undefined): DateTimePickerCoords {
    const popoverWidth = 360;
    const popoverHeight = showTime !== false ? 460 : 380;
    const viewportPadding = 12;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding);
    const preferredLeft = rect.left;
    const preferredTop = rect.bottom + 8;
    const shouldOpenUpwards = preferredTop + popoverHeight > window.innerHeight - viewportPadding;
    const top = shouldOpenUpwards
      ? Math.max(viewportPadding, rect.top - popoverHeight - 8)
      : Math.max(viewportPadding, preferredTop);

    return {
      top,
      left: Math.min(Math.max(preferredLeft, viewportPadding), maxLeft),
      width: rect.width,
    };
  }

  static computeCommitIso(props: DateTimePickerProps, selectedDate: Date): string {
    const { showTime = true, value } = props;
    const tz = DateTimePickerController.timezone;
    const baseTime = DateTimePickerController.getZonedParts(value) || TimezoneUtils.getZonedDateParts(new Date(), tz);
    const finalUtcDate = TimezoneUtils.zonedPartsToUtcDate({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      hour: showTime ? (baseTime?.hour || 0) : 0,
      minute: showTime ? (baseTime?.minute || 0) : 0,
      second: 0,
    }, tz);
    return finalUtcDate.toISOString();
  }

  static computeTimeChangeIso(value: string | undefined, type: 'hours' | 'minutes', val: string): string | null {
    const tz = DateTimePickerController.timezone;
    const base = DateTimePickerController.getZonedParts(value) || TimezoneUtils.getZonedDateParts(new Date(), tz);
    if (!base) return null;

    const parsed = Number.parseInt(val, 10);
    const num = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = type === 'hours'
      ? Math.min(23, Math.max(0, num))
      : Math.min(59, Math.max(0, num));

    const next = {
      ...base,
      hour: type === 'hours' ? clamped : base.hour,
      minute: type === 'minutes' ? clamped : base.minute,
      second: 0,
    };
    return TimezoneUtils.zonedPartsToUtcDate(next, tz).toISOString();
  }
}
