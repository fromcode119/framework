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
export interface IEntityRecordRef {
  personId?: number | string | null;
  userId?: number | string | null;
  email?: string | null;
}
