/**
 * The native `Date#toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` signature.
 *
 * A genuine BEHAVIOURAL contract — a call signature, which has no class form — so it stays an
 * `interface` rather than becoming a data class. `TimezoneUtils` keeps the originals under this type
 * while its timezone patch is installed, and restores them from it.
 */
export interface IDateLocaleFormatter {
  (locales?: string | string[], options?: Intl.DateTimeFormatOptions): string;
}
