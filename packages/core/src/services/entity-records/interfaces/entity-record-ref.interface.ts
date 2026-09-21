import type { IEntityRecordSubject } from '@core/services/entity-records/interfaces/entity-record-subject.interface';

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

/**
 * What records are being asked about.
 *
 * Either a PERSON (the original use: Person 360) or a SUBJECT — any other record that can identify
 * itself with correlation keys. The two never mix: a person provider must not dump a customer's whole
 * history onto one of their orders, so the resolution service runs person providers for person refs
 * and key-matched providers for subject refs, and never the other way round.
 */
export interface IEntityRecordRef {
  personId?: number | string | null;
  userId?: number | string | null;
  email?: string | null;
  /** Present when the question is "what relates to THIS record?" rather than "to this person?". */
  subject?: IEntityRecordSubject | null;
}
