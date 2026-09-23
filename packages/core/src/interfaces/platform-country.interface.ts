import type { PlatformCountrySource } from '@core/enums/platform-country-source.enum';

/** The resolved platform country and its provenance. */
export interface IPlatformCountry {
  /** ISO 3166-1 alpha-2, uppercase; '' when none could be resolved. */
  country: string;
  source: PlatformCountrySource;
  /** The language the country was derived from, when `source` is LANGUAGE. */
  language: string;
}
