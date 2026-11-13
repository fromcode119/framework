import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * What a collection declared under `admin.recordLinks`, resolved against the record on screen.
 *
 * One reading of the declaration for the two places that draw from it — the sections of the record,
 * which take the parts mapped to them, and the linked-records list, which takes whatever is left — so
 * both ask the framework the same question and it is asked once.
 */
export class CollectionRecordLinksDeclaration {
  private constructor(
    readonly kind: string,
    readonly recordId: string,
    readonly keys: Record<string, string>,
    readonly title: string,
    readonly emptyHint: string,
    private readonly parts: Record<string, { section: string; empty?: string }>,
  ) {}

  /** Null when the collection declares nothing, or this record can offer none of the keys yet. */
  static of(collection: any, formData: Record<string, any>, recordId: string): CollectionRecordLinksDeclaration | null {
    const declared = collection?.admin?.recordLinks;
    const kind = String(declared?.kind || '').trim();
    if (!kind || !declared?.keys) return null;
    // A key whose field is empty is left out rather than sent blank — a provider matching on an empty
    // value would answer for every record there is.
    const keys: Record<string, string> = {};
    for (const [keyName, fieldName] of Object.entries(declared.keys)) {
      const raw = formData?.[String(fieldName)];
      // Only a plain value identifies anything: a relationship loaded as an object would be sent as "[object Object]".
      const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
      if (value) keys[String(keyName)] = value;
    }
    if (!Object.keys(keys).length) return null;
    return new CollectionRecordLinksDeclaration(kind, recordId, keys, String(declared.title || ''), String(declared.emptyHint || ''), declared.parts || {});
  }

  get url(): string {
    return AdminConstants.ENDPOINTS.SYSTEM.RECORD_LINKS(this.kind, this.recordId, this.keys);
  }

  /** Changes whenever the question does. */
  get reloadKey(): string {
    return `${this.kind}:${this.recordId}:${Object.values(this.keys).join('|')}`;
  }

  /** The parts this section draws, in the order the collection declared them. */
  partsOf(sectionKey: string): Array<{ term: string; empty: string }> {
    return Object.entries(this.parts)
      .filter(([, part]) => String(part?.section || '') === sectionKey)
      .map(([term, part]) => ({ term, empty: String(part?.empty || '') }));
  }

  /** The part terms that have a section on screen — their records are drawn there, not in the list. */
  placedTerms(visibleSectionKeys: string[]): string[] {
    return Object.entries(this.parts)
      .filter(([, part]) => visibleSectionKeys.includes(String(part?.section || '')))
      .map(([term]) => term);
  }
}
