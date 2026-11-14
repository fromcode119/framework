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
    private readonly parts: Record<string, { section: string; sectionKey?: string; after?: string; empty?: string; emptyUnless?: string[]; menu?: boolean }>,
    private readonly formData: Record<string, any>,
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
    return new CollectionRecordLinksDeclaration(kind, recordId, keys, String(declared.title || ''), String(declared.emptyHint || ''), declared.parts || {}, formData || {});
  }

  get url(): string {
    return AdminConstants.ENDPOINTS.SYSTEM.RECORD_LINKS(this.kind, this.recordId, this.keys);
  }

  /** Changes whenever the question does. */
  get reloadKey(): string {
    return `${this.kind}:${this.recordId}:${Object.values(this.keys).join('|')}`;
  }

  /**
   * The declared part an item or action is drawn as. A provider may name a narrower part than any
   * collection knows — `payment.invoice` — so a collection that gives invoices a place of their own
   * maps that, and every other collection keeps them under `payment`, as before, without a change.
   */
  termOf(part: unknown): string {
    let term = String(part || '');
    while (term && !this.parts[term] && term.includes('.')) term = term.slice(0, term.lastIndexOf('.'));
    return term;
  }

  /**
   * Sections that only parts fill: no field of the collection names them (an order's invoices). The
   * page draws each as a card of its own, so mapping a part to a new section is all it takes.
   */
  sectionsWithoutFields(fieldSectionKeys: string[]): Array<{ title: string; key: string; after: string }> {
    const sections = new Map<string, { title: string; key: string; after: string }>();
    for (const part of Object.values(this.parts)) {
      const title = String(part?.section || '');
      if (!title || fieldSectionKeys.includes(title) || sections.has(title)) continue;
      // `after` names the section (as declared) the card follows; without one it comes last.
      sections.set(title, { title, key: String(part?.sectionKey || ''), after: String(part?.after || '') });
    }
    return [...sections.values()];
  }

  /** The parts this section draws, in the order the collection declared them. */
  partsOf(sectionKey: string): Array<{ term: string; empty: string; menu: boolean; settled: boolean }> {
    return Object.entries(this.parts)
      .filter(([, part]) => String(part?.section || '') === sectionKey)
      .map(([term, part]) => ({ term, empty: String(part?.empty || ''), menu: part?.menu === true, settled: this.isSettled(part?.emptyUnless) }));
  }

  /**
   * The record already states what the part's records would: one of the fields the collection named in
   * `emptyUnless` holds a value (a tracking number on a shipped order). "Nothing yet" would then
   * contradict the record on the same card, so the part says nothing until a record of it exists.
   */
  private isSettled(fields: unknown): boolean {
    return (Array.isArray(fields) ? fields : []).some((field) => {
      const value = this.formData?.[String(field)];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
  }

  /** The part terms that have a section on screen — their records are drawn there, not in the list. */
  placedTerms(visibleSectionKeys: string[]): string[] {
    return Object.entries(this.parts)
      .filter(([, part]) => visibleSectionKeys.includes(String(part?.section || '')))
      .map(([term]) => term);
  }
}
