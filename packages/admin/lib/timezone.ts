import { DateLocaleMethod } from '@/lib/enums/date-locale-method.enum';
import { Platform } from '@fromcode119/reactor';
import { RuntimeRegistryAccess } from '@fromcode119/core/client';
import { IZonedDateParts } from '@/lib/interfaces/zoned-date-parts.interface';
import { ITimezoneOption } from '@/lib/interfaces/timezone-option.interface';
import { IDateLocaleFormatter } from '@/lib/interfaces/date-locale-formatter.interface';

export class TimezoneUtils {
  private static readonly DEFAULT_TIMEZONE = 'UTC';
  private static readonly DEFAULT_LOCALE = 'en-US';

  // State of the Date#toLocale* patch: the timezone currently installed, and the untouched originals to
  // format against. Four named fields rather than one anonymous-typed bag — the bag was a data shape
  // declared inline in a class file, which is the thing the conventions forbid.
  private static patchedTimezone: string | null = null;
  private static originalToLocaleString: IDateLocaleFormatter | null = null;
  private static originalToLocaleDateString: IDateLocaleFormatter | null = null;
  private static originalToLocaleTimeString: IDateLocaleFormatter | null = null;

  /** The framework runtime bridge, resolved from the single runtime registry (no window.Fromcode). */
  private static runtimeBridge(): any {
    if (!Platform.isBrowser) return null;
    return (window as any)?.[RuntimeRegistryAccess.globalName]?.[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] || null;
  }

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
        new Intl.DateTimeFormat(TimezoneUtils.DEFAULT_LOCALE, { timeZone: tz }).format(new Date());
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

      return TimezoneUtils.DEFAULT_TIMEZONE;

  }

  static resolveSystemLocale(preferred?: string): string {
      const explicit = String(preferred || '').trim();
      if (explicit) return explicit;
      if (!Platform.isBrowser) return TimezoneUtils.DEFAULT_LOCALE;

      const fromBridge = String(TimezoneUtils.runtimeBridge()?.locale || '').trim();
      if (fromBridge) return fromBridge;

      const fromNavigator = String(window.navigator?.language || '').trim();
      if (fromNavigator) return fromNavigator;

      return TimezoneUtils.DEFAULT_LOCALE;

  }

  static getTimezoneOptions(preferred?: string): ITimezoneOption[] {
      const knownTimezones = new Set<string>(TimezoneUtils.readSupportedTimezoneValues());
      const explicit = String(preferred || '').trim();
      if (explicit && TimezoneUtils.isValidTimezone(explicit)) {
        knownTimezones.add(explicit);
      }

      return Array.from(knownTimezones)
        .sort((left, right) => left.localeCompare(right))
        .map((timezone) => ({
          value: timezone,
          label: TimezoneUtils.formatTimezoneLabel(timezone),
          group: timezone.includes('/') ? timezone.split('/')[0] : 'General'
        }));

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

  static getZonedDateParts(value: any, preferredTimezone?: string): IZonedDateParts | null {
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

  static zonedPartsToUtcDate(parts: IZonedDateParts, preferredTimezone?: string): Date {
      const timeZone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);
      const desiredUtcMs = TimezoneUtils.toUtcMsFromParts(parts);
      let targetMs = desiredUtcMs;

      for (let i = 0; i < 3; i += 1) {
        const current = TimezoneUtils.getZonedDateParts(new Date(targetMs), timeZone);
        if (!current) break;
        const offsetMs = TimezoneUtils.toUtcMsFromParts(current) - targetMs;
        const nextTargetMs = desiredUtcMs - offsetMs;
        if (nextTargetMs === targetMs) break;
        targetMs = nextTargetMs;
      }

      return new Date(targetMs);

  }

  static applyDateLocaleTimezonePatch(preferredTimezone?: string): string {
      const timezone = TimezoneUtils.resolveSystemTimezone(preferredTimezone);
      if (!Platform.isBrowser) return timezone;
      if (TimezoneUtils.patchedTimezone === timezone) return timezone;

      TimezoneUtils.patchLocaleMethod(DateLocaleMethod.TO_LOCALE_STRING, timezone);
      TimezoneUtils.patchLocaleMethod(DateLocaleMethod.TO_LOCALE_DATE_STRING, timezone);
      TimezoneUtils.patchLocaleMethod(DateLocaleMethod.TO_LOCALE_TIME_STRING, timezone);
      TimezoneUtils.patchedTimezone = timezone;
      return timezone;

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static readTimezoneFromBridge(): string {
    if (!Platform.isBrowser) return '';
    const bridge = TimezoneUtils.runtimeBridge();
    const direct = String(bridge?.settings?.timezone || '').trim();
    if (direct) return direct;
    return String(bridge?.getState?.()?.settings?.timezone || '').trim();
  }

  private static readSupportedTimezoneValues(): string[] {
    const intlWithSupportedValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    };
    const timezoneValues = intlWithSupportedValues.supportedValuesOf?.('timeZone');
    if (Array.isArray(timezoneValues) && timezoneValues.length > 0) {
      return timezoneValues;
    }
    return [TimezoneUtils.DEFAULT_TIMEZONE];
  }

  private static formatTimezoneLabel(timezone: string): string {
    return String(timezone || '')
      .split('/')
      .map((segment) => segment.replace(/_/g, ' '))
      .join(' / ');
  }

  private static withTimezoneOption(options: Intl.DateTimeFormatOptions | undefined, timezone: string): Intl.DateTimeFormatOptions {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return { timeZone: timezone };
    }
    if (options.timeZone) return options;
    return { ...options, timeZone: timezone };
  }

  private static toUtcMsFromParts(parts: IZonedDateParts): number {
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

  private static patchLocaleMethod(method: DateLocaleMethod, timezone: string) {
    if (
      !TimezoneUtils.originalToLocaleString ||
      !TimezoneUtils.originalToLocaleDateString ||
      !TimezoneUtils.originalToLocaleTimeString
    ) {
      TimezoneUtils.originalToLocaleString = Date.prototype.toLocaleString;
      TimezoneUtils.originalToLocaleDateString = Date.prototype.toLocaleDateString;
      TimezoneUtils.originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    }

    const originals: Record<string, any> = {
      toLocaleString: TimezoneUtils.originalToLocaleString!,
      toLocaleDateString: TimezoneUtils.originalToLocaleDateString!,
      toLocaleTimeString: TimezoneUtils.originalToLocaleTimeString!
    };

    (Date.prototype as any)[method.value] = function patchedDateLocale(this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      const normalized = TimezoneUtils.withTimezoneOption(options, timezone);
      return originals[method.value].call(this, locales, normalized);
    } as IDateLocaleFormatter;
  }
}
