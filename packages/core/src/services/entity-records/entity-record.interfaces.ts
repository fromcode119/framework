/**
 * Entity Records — a framework-owned "what records does this person have?" registry.
 *
 * Plugins register a provider that, given a person reference, returns the records
 * (invoices, declarations, agreements, orders, shipments, …) that plugin owns for
 * that person. The framework aggregates every provider's records into one grouped,
 * sorted timeline — the backbone of the Person 360 / partner-CRM view, reusable on
 * any record detail page (affiliate, customer, …) keyed by the same person.
 *
 * The framework stays plugin-agnostic: it only resolves the person reference and
 * runs the registered providers; each plugin owns how its records map to items.
 */

/** How a person is referenced when asking providers for their records. */
export interface EntityRecordRef {
  personId?: number | string | null;
  userId?: number | string | null;
  email?: string | null;
}

/** A single record contributed by a provider (one invoice, declaration, order, …). */
export interface EntityRecordItem {
  /** Stable id, unique within the contributing provider. */
  id: string;
  /** Display bucket, e.g. 'Invoices', 'Declarations', 'Orders'. */
  group: string;
  /** Machine kind for filtering/icons, e.g. 'finance:invoice', 'mlm:agreement'. */
  kind: string;
  title: string;
  subtitle?: string;
  status?: string;
  /**
   * Opaque trailing label, rendered VERBATIM by the framework at the row's trailing
   * edge. The framework attaches NO meaning to it — the owning plugin decides what it
   * is (a money string it formatted itself, a count, a short status, …). The framework
   * is domain-agnostic and holds no money/currency concept whatsoever.
   */
  trailing?: string;
  /** ISO date used for timeline sorting (newest first). */
  date?: string;
  /** Admin path to open the record (RuntimeLocationUtils.toAdminPath on the client). */
  href?: string;
  /** API path to download the document (PDF, file, …). */
  downloadUrl?: string;
  /** lucide-react icon name. */
  icon?: string;
  badges?: string[];
}

/** What a plugin passes to context.entityRecords.registerProvider(). */
export interface EntityRecordProviderRegistration {
  namespace: string;
  pluginSlug: string;
  /** Provider key, unique within the plugin, e.g. 'invoices'. */
  key: string;
  /** Human label for the provider's records, used as a default group label. */
  label: string;
  /** Resolve the records this provider owns for the given person. */
  resolve: (ref: EntityRecordRef) => Promise<EntityRecordItem[]>;
}

/** A registration after normalization, with its canonical key. */
export interface RegisteredEntityRecordProvider extends EntityRecordProviderRegistration {
  canonicalKey: string;
}

/** Records sharing one display bucket. */
export interface EntityRecordGroup {
  group: string;
  items: EntityRecordItem[];
}

/** A provider that threw while resolving — surfaced, never fatal. */
export interface EntityRecordProviderError {
  provider: string;
  message: string;
}

/** The aggregated result for one person reference. */
export interface EntityRecordsResult {
  ref: EntityRecordRef;
  items: EntityRecordItem[];
  groups: EntityRecordGroup[];
  providers: string[];
  errors: EntityRecordProviderError[];
}
