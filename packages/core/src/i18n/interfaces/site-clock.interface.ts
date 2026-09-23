/** How a site writes a moment in time: its timezone and its 12- or 24-hour clock. */
export interface ISiteClock {
  /** IANA timezone (Settings → General → System Timezone), e.g. `Europe/Sofia`. */
  timeZone: string;
  /** `h12` or `h23`, from Settings → General → Time format and the site's language. */
  hourCycle: Intl.DateTimeFormatOptions['hourCycle'];
}
