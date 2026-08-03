/**
 * Shared "records hub" — a grouped, newest-first timeline of every record a
 * person owns across plugins (invoices, declarations, agreements, orders, …).
 *
 * The component is presentation-only: the host supplies a `load()` closure that
 * fetches `/people/:id/records` with its own authed client (AdminApi in the admin,
 * `this.api` in a plugin UI) and an optional `onOpenItem` handler. This keeps the
 * hub reusable on the Person 360 page and embedded in any plugin record detail
 * (affiliate, customer, …) without coupling it to one HTTP client.
 */

export interface IRecordsHubItem {
  id: string;
  group: string;
  kind: string;
  title: string;
  subtitle?: string;
  status?: string;
  /** Opaque trailing label rendered verbatim — framework attaches no meaning (no money concept). */
  trailing?: string;
  date?: string;
  href?: string;
  downloadUrl?: string;
  icon?: string;
  badges?: string[];
}
