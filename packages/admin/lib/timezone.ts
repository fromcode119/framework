import type {
  ZonedDateParts,
  LocaleArg,
  DateLocaleFormatter,
  WindowWithFromcode,
} from './timezone.types';

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_LOCALE = 'en-US';

const dateLocalePatchState: {
  timezone: string | null;
  originalToLocaleString: DateLocaleFormatter | null;
  originalToLocaleDateString: DateLocaleFormatter | null;
  originalToLocaleTimeString: DateLocaleFormatter | null;
} = {
  timezone: null,
  originalToLocaleString: null,
  originalToLocaleDateString: null,
  originalToLocaleTimeString: null
};
export class TimezoneUtils {
  static parseDateValue(value: any): Date | null {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date;

  }

  static isValidTimezone(value: string): boolean {
      const tz = String(value || '').trim();
      if (!tz) return false;
      try {
        new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: tz }).format(new Date());
        return true;
      } catch {
        return false;
      }

  }

  static resolveSystemTimezone(preferred?: string): string {
      const explicit = String(preferred || '').trim();
      if (explicit && TimezoneUtils.isValidTimezone(explicit)) return explicit;

      const fromBridge = TimezoneUtils.readTimezoneFromBridge();
      if (fromBridge && TimezoneUtils.isValidTimezone(fromBridge)) return fromBridge;

      return DEFAULT_TIMEZONE;

  }

  static resolveSystemLocale(preferred?: string): string {
      const explicit = String(preferred || '').trim();
      if (explicit) return explicit;
      if (typeof window === 'undefined') return DEFAULT_LOCALE;

      const win = window as WindowWithFromcode;
      const fromBridge = String(win?.Fromcode?.locale || '').trim();
      if (fromBridge) return fromBridge;

      const fromNavigator = String(window.navigator?.language || '').trim();
      if (fromNavigator) return fromNavigator;

      return DEFAULT_LOCALE;

  }

  static formatSystemDate(
    value: any,
    options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' },
    fallback = '-',
    preferredTimezone?: string,
  ): string {
    const date = TimezoneUtils.parseDateValue(value);
    if (!date) return fallback;
    const locale = TimezoneUtils.resolveSystemLocale();
    const timezone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);
    const normalizedOptions = TimezoneUtils.withTimezoneOption(options, timezone);
    try {
      return new Intl.DateTimeFormat(locale, normalizedOptions).format(date);
    } catch {
      return fallback;
    }
  }

  static formatSystemDateTime(
  value: any,
  fallback = '-',
  preferredTimezone?: string
): string {
      return TimezoneUtils.formatSystemDate(value, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }, fallback, preferredTimezone);

  }

  static formatSystemDateOnly(
  value: any,
  fallback = '-',
  preferredTimezone?: string
): string {
      return TimezoneUtils.formatSystemDate(value, { year: 'numeric', month: 'short', day: '2-digit' }, fallback, preferredTimezone);

  }

  static formatSystemTimeOnly(
  value: any,
  fallback = '-',
  preferredTimezone?: string
): string {
      return TimezoneUtils.formatSystemDate(value, { hour: '2-digit', minute: '2-digit' }, fallback, preferredTimezone);

  }

  static getZonedDateParts(value: any, preferredTimezone?: string): ZonedDateParts | null {
      const date = TimezoneUtils.parseDateValue(value);
      if (!date) return null;
      const timeZone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      });
      const partMap: Record<string, number> = {};
      for (const part of formatter.formatToParts(date)) {
        if (part.type === 'literal') continue;
        const parsed = Number.parseInt(part.value, 10);
        if (!Number.isNaN(parsed)) {
          partMap[part.type] = parsed;
        }
      }

      if (!partMap.year || !partMap.month || !partMap.day) return null;
      return {
        year: partMap.year,
        month: partMap.month,
        day: partMap.day,
        hour: partMap.hour ?? 0,
        minute: partMap.minute ?? 0,
        second: partMap.second ?? 0
      };

  }

  static zonedPartsToUtcDate(parts: ZonedDateParts, preferredTimezone?: string): Date {
      const timeZone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);
      let targetMs = TimezoneUtils.toUtcMsFromParts(parts);

      for (let i = 0; i < 3; i += 1) {
        const current = TimezoneUtils.getZonedDateParts(new Date(targetMs), timeZone);
        if (!current) break;
        const delta = TimezoneUtils.toUtcMsFromParts(current) - targetMs;
        if (delta === 0) break;
        targetMs -= delta;
      }

      return new Date(targetMs);

  }

  static applyDateLocaleTimezonePatch(preferredTimezone?: string): string {
      const timezone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);
      if (typeof window === 'undefined') return timezone;
      if (dateLocalePatchState.timezone === timezone) return timezone;

      TimezoneUtils.patchLocaleMethod('toLocaleString', timezone);
      TimezoneUtils.patchLocaleMethod('toLocaleDateString', timezone);
      TimezoneUtils.patchLocaleMethod('toLocaleTimeString', timezone);
      dateLocalePatchState.timezone = timezone;
      return timezone;

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static readTimezoneFromBridge(): string {
    if (typeof window === 'undefined') return '';
    const win = window as WindowWithFromcode;
    const direct = String(win?.Fromcode?.settings?.timezone || '').trim();
    if (direct) return direct;
    return String(win?.Fromcode?.getState?.()?.settings?.timezone || '').trim();
  }

  private static withTimezoneOption(options: Intl.DateTimeFormatOptions | undefined, timezone: string): Intl.DateTimeFormatOptions {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return { timeZone: timezone };
    }
    if (options.timeZone) return options;
    return { ...options, timeZone: timezone };
  }

  private static toUtcMsFromParts(parts: ZonedDateParts): number {
    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second || 0,
      0
    );
  }

  private static patchLocaleMethod(method: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString', timezone: string) {
    if (
      !dateLocalePatchState.originalToLocaleString ||
      !dateLocalePatchState.originalToLocaleDateString ||
      !dateLocalePatchState.originalToLocaleTimeString
    ) {
      dateLocalePatchState.originalToLocaleString = Date.prototype.toLocaleString;
      dateLocalePatchState.originalToLocaleDateString = Date.prototype.toLocaleDateString;
      dateLocalePatchState.originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    }

    const originals = {
      toLocaleString: dateLocalePatchState.originalToLocaleString!,
      toLocaleDateString: dateLocalePatchState.originalToLocaleDateString!,
      toLocaleTimeString: dateLocalePatchState.originalToLocaleTimeString!
    };

    (Date.prototype as any)[method] = function patchedDateLocale(this: Date, locales?: LocaleArg, options?: Intl.DateTimeFormatOptions) {
      const normalized = TimezoneUtils.withTimezoneOption(options, timezone);
      return originals[method].call(this, locales, normalized);
    } as DateLocaleFormatter;
  }
}