/** A single record contributed by a provider (one invoice, declaration, order, …). */
export interface IEntityRecordItem {
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
