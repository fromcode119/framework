/**
 * The change summary a version records when the framework writes one itself — nobody typed a summary.
 *
 * These were English sentences built at write time (`Update fcp_cms_pages record`), stored with the
 * version and shown as-is, so every console read them in English and with a table name in them. The
 * framework now stores a short code instead, and the console reads it in the reader's language
 * (`collection.revision.summary.<kind>`). A summary a person typed is stored and shown as typed.
 */
export class VersionChangeSummary {
  private static readonly PREFIX = 'system:';
  static readonly CREATED = 'system:created';
  static readonly UPDATED = 'system:updated';
  static readonly BULK_CREATED = 'system:bulk-created';
  static readonly BULK_UPDATED = 'system:bulk-updated';

  static restored(version: number | string): string {
    return `${VersionChangeSummary.PREFIX}restored:${version}`;
  }

  /** The kind and version of a framework-written summary, or null for one a person typed. */
  static parse(summary: unknown): { kind: string; version?: string } | null {
    const text = String(summary ?? '');
    if (!text.startsWith(VersionChangeSummary.PREFIX)) return null;
    const [kind, version] = text.slice(VersionChangeSummary.PREFIX.length).split(':');
    return kind ? { kind, ...(version ? { version } : {}) } : null;
  }
}
