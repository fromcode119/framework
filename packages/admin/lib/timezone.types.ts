// ─── Companion types file for timezone.ts ───────────────────────────────────

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type LocaleArg = string | string[] | undefined;

export type DateLocaleFormatter = (
  locales?: LocaleArg,
  options?: Intl.DateTimeFormatOptions
) => string;

export type WindowWithFromcode = Window & {
  Fromcode?: {
    locale?: string;
    settings?: Record<string, any>;
    getState?: () => { settings?: Record<string, any> } | undefined;
  };
};
