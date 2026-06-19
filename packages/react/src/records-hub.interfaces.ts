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

export interface RecordsHubItem {
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

export interface RecordsHubGroup {
  group: string;
  items: RecordsHubItem[];
}

export interface RecordsHubResult {
  items?: RecordsHubItem[];
  groups?: RecordsHubGroup[];
  providers?: string[];
  errors?: Array<{ provider: string; message: string }>;
}

export interface RecordsHubProps {
  /** Fetch the aggregated records (host owns auth). */
  load: () => Promise<RecordsHubResult>;
  /** Host handler for opening/downloading an item (href nav or authed download). */
  onOpenItem?: (item: RecordsHubItem) => void;
  theme?: 'dark' | 'light' | string;
  title?: string;
  emptyHint?: string;
  /** Re-run load() when this value changes (e.g. the person/route id). */
  reloadKey?: string | number;
}

export interface RecordsHubState {
  loading: boolean;
  error: string;
  groups: RecordsHubGroup[];
  total: number;
  activeGroup: string;
  errors: Array<{ provider: string; message: string }>;
}
