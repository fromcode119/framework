/** The stored settings a site's clock is derived from. Blank means "not set here". */
export interface ISiteClockSettings {
  timezone?: string;
  timeFormat?: string;
  /** The site's default (frontend) language — what "follow the language" follows. */
  locale?: string;
}
