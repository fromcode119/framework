import { CoercionUtils } from '@core/utils/coercion-utils';

/**
 * What this operator was last working on — the documents themselves, not a count of them.
 *
 * Read from `_system_record_versions`, which the framework already writes on every save, so nothing
 * new is recorded to make this work. One entry per RECORD, newest first: a page saved nine times is
 * one thing you were editing, not nine.
 *
 * The dashboard shows only the CURRENT user's edits. "Recently changed by anyone" is a different
 * question with a different answer (the activity log), and mixing them produces a list where your
 * own work is buried under a colleague's import.
 */
export class RecentEditsService {
  /** Rows scanned before giving up — enough that a burst of saves on one record cannot fill the list. */
  private static readonly SCAN_LIMIT = 60;

  /** Keys tried, in order, for something a human would recognise the record by. */
  private static readonly TITLE_KEYS = ['title', 'name', 'label', 'heading', 'subject', 'slug', 'email'];

  constructor(
    private readonly deps: {
      findVersions: (limit: number) => Promise<Array<Record<string, any>>>;
      listCollections: () => Array<Record<string, any>>;
    },
  ) {}

  async list(userId: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const actor = String(userId || '').trim();
    if (!actor) return [];

    const rows = await this.deps.findVersions(RecentEditsService.SCAN_LIMIT);
    const seen = new Set<string>();
    const edits: Array<Record<string, unknown>> = [];

    for (const row of rows || []) {
      if (edits.length >= limit) break;
      if (RecentEditsService.actorOf(row) !== actor) continue;

      const table = CoercionUtils.toString(row?.ref_collection).trim();
      const recordId = CoercionUtils.toString(row?.ref_id).trim();
      if (!table || !recordId) continue;

      const key = `${table}:${recordId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const collection = this.collectionFor(table);
      edits.push({
        recordId,
        title: RecentEditsService.titleOf(row?.version_data) || `${collection.label} ${recordId}`,
        collectionLabel: collection.label,
        collectionSlug: collection.shortSlug,
        pluginSlug: collection.pluginSlug,
        editedAt: row?.updated_at ?? row?.created_at ?? null,
        version: Number(row?.version || 0),
      });
    }

    return edits;
  }

  /**
   * `updated_by` is a jsonb column written by several call sites: a bare id, a quoted id, or an
   * object carrying one. Reading only the first shape silently produced an empty list for everyone
   * whose saves went through the other two.
   */
  private static actorOf(row: Record<string, any>): string {
    const raw = row?.updated_by;
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'object') return CoercionUtils.toString((raw as any).id ?? (raw as any).userId).trim();
    return CoercionUtils.toString(raw).replace(/^"|"$/g, '').trim();
  }

  private static titleOf(versionData: unknown): string {
    const data = (versionData || {}) as Record<string, unknown>;
    for (const key of RecentEditsService.TITLE_KEYS) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      // Localized fields arrive as { en: "…", bg: "…" } — any language names the record.
      if (value && typeof value === 'object') {
        const first = Object.values(value as Record<string, unknown>).find((entry) => typeof entry === 'string' && entry.trim());
        if (typeof first === 'string') return first.trim();
      }
    }
    return '';
  }

  /** The collection that owns a physical table, so the row can link where the operator edits it. */
  private collectionFor(table: string): { label: string; shortSlug: string; pluginSlug: string } {
    const match = (this.deps.listCollections() || []).find(
      (collection) => String(collection?.tableName || collection?.slug) === table,
    );
    if (!match) {
      return { label: RecentEditsService.prettify(table), shortSlug: '', pluginSlug: '' };
    }
    return {
      label: RecentEditsService.labelOf(match) || RecentEditsService.prettify(table),
      shortSlug: String(match.shortSlug || match.slug || ''),
      pluginSlug: String(match.pluginSlug || 'system'),
    };
  }

  /**
   * A collection's own words for itself, in the order an operator would recognise. Falls through to
   * the prettified table name, because plugin collections are frequently registered with the table
   * name AS the slug — taking `slug` on trust printed "fcp_hub_documents" in the console.
   */
  private static labelOf(collection: Record<string, any>): string {
    const candidates = [
      collection?.labels?.singular,
      collection?.admin?.singularLabel,
      collection?.admin?.label,
      collection?.label,
      collection?.shortSlug,
    ];
    for (const candidate of candidates) {
      const value = CoercionUtils.toString(candidate).trim();
      if (value && !value.startsWith('fcp_')) return RecentEditsService.prettify(value);
    }
    return '';
  }

  /** `fcp_hub_documents` → `Documents`; `blogPosts` → `Blog posts`. */
  private static prettify(value: string): string {
    const words = String(value || '')
      .replace(/^fcp_[a-z0-9]+_/i, '')
      .replace(/^fcp_/i, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : '';
  }
}
