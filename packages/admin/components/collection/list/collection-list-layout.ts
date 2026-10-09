import { QuickEditControl } from '@/components/collection/list/quick-edit-control';
import { QuickEditField } from '@/components/collection/list/quick-edit-field';

/**
 * How one collection's records read in the list, resolved from its `admin.list` declaration.
 *
 * Every part names a field the collection declares. What it leaves out falls back to something the
 * collection already says — `useAsTitle`, its `status` select, its `defaultColumns` — never to a
 * value made up here. Names that cannot be used are collected in `refused`, so the list can say which
 * declaration it ignored and why instead of dropping it quietly.
 */
export class CollectionListLayout {
  constructor(
    readonly titleField: string,
    readonly mediaField: string,
    readonly badgeField: string,
    readonly metaFields: readonly string[],
    readonly trailingField: string,
    readonly inlineFields: readonly string[],
    readonly rowFields: readonly QuickEditField[],
    readonly refused: readonly string[],
    /**
     * Labels for the meta fields whose bare value means nothing on its own — a number or a yes/no.
     * "12" under a product could be anything; "Stock 12" cannot.
     */
    readonly metaLabels: Readonly<Record<string, string>> = {},
  ) {}

  static readonly EMPTY = new CollectionListLayout('', '', '', [], '', [], [], []);

  /** Columns that never belong on a card's meta line: they are the card's frame, not its content. */
  private static readonly FRAME = ['id', 'createdAt', 'updatedAt'];

  static from(collection: any): CollectionListLayout {
    if (!collection) return CollectionListLayout.EMPTY;
    const fields: any[] = Array.isArray(collection.fields) ? collection.fields : [];
    const fieldNamed = (name: string) => fields.find((field) => field?.name === name);
    const list = collection.admin?.list || {};
    const refused: string[] = [];
    const declared = (role: string, name: unknown): string => {
      const value = String(name || '');
      if (!value) return '';
      if (fieldNamed(value)) return value;
      refused.push(`${role} "${value}" is not a field of this collection`);
      return '';
    };

    const titleField = CollectionListLayout.resolveTitle(collection, fieldNamed);
    const defaults: string[] = Array.isArray(collection.admin?.defaultColumns) ? collection.admin.defaultColumns : [];
    const mediaField = declared('media', list.media)
      || defaults.find((name) => fieldNamed(name)?.type === 'relationship' && fieldNamed(name)?.relationTo === 'media') || '';
    const badgeField = declared('badge', list.badge)
      || (fieldNamed('status')?.type === 'select' ? 'status' : '');
    const trailingField = declared('trailing', list.trailing);
    const frame = new Set([...CollectionListLayout.FRAME, titleField, mediaField, badgeField, trailingField]);
    const metaFields = Array.isArray(list.meta)
      ? list.meta.map((name: string) => declared('meta', name)).filter(Boolean)
      : defaults.filter((name) => fieldNamed(name) && !frame.has(name)).slice(0, 2);

    const inlineFields = CollectionListLayout.resolveInline(list.quickEdit?.inline, fieldNamed, refused);
    const rowFields = Array.isArray(list.quickEdit?.row)
      ? CollectionListLayout.resolveRow(list.quickEdit.row, fieldNamed, refused)
      : CollectionListLayout.automaticRow(fields);

    const metaLabels: Record<string, string> = {};
    for (const name of metaFields) {
      const field = fieldNamed(name);
      if (['number', 'checkbox', 'boolean'].includes(String(field?.type))) metaLabels[name] = String(field.label || name);
    }
    return new CollectionListLayout(titleField, mediaField, badgeField, metaFields, trailingField, inlineFields, rowFields, refused, metaLabels);
  }

  private static readonly REPORTED = new Set<string>();

  /**
   * Says once per collection which parts of its `admin.list` the list ignored. A plugin author reads
   * the console; an operator never sees a half-applied declaration presented as the whole one.
   */
  reportRefused(collectionSlug: string): void {
    if (!this.refused.length || CollectionListLayout.REPORTED.has(collectionSlug)) return;
    CollectionListLayout.REPORTED.add(collectionSlug);
    for (const reason of this.refused) console.warn(`[CollectionList] ${collectionSlug}: admin.list ${reason} — ignored.`);
  }

  isInline(fieldName: string): boolean {
    return this.inlineFields.includes(fieldName);
  }

  private static resolveTitle(collection: any, fieldNamed: (name: string) => any): string {
    const useAsTitle = String(collection.admin?.useAsTitle || '');
    if (useAsTitle && fieldNamed(useAsTitle)) return useAsTitle;
    return ['name', 'title', 'label'].find((name) => fieldNamed(name)) || '';
  }

  private static resolveInline(names: unknown, fieldNamed: (name: string) => any, refused: string[]): string[] {
    if (!Array.isArray(names)) return [];
    return names.map(String).filter((name) => {
      const reason = QuickEditControl.refusal(fieldNamed(name));
      if (reason) refused.push(`quickEdit.inline "${name}" ${reason}`);
      return !reason;
    });
  }

  private static resolveRow(entries: readonly unknown[], fieldNamed: (name: string) => any, refused: string[]): QuickEditField[] {
    const resolved: QuickEditField[] = [];
    for (const entry of entries) {
      const spec = (entry || {}) as { field?: string; control?: string; span?: number };
      const name = String(spec.field || '');
      const field = fieldNamed(name);
      const reason = QuickEditControl.refusal(field) || (spec.control ? QuickEditControl.mismatch(field, spec.control) : '');
      if (reason) {
        refused.push(`quickEdit.row "${name}" ${reason}`);
        continue;
      }
      const span = Math.min(4, Math.max(1, Math.round(Number(spec.span) || 1)));
      resolved.push(new QuickEditField(QuickEditControl.apply(field, spec.control), span));
    }
    return resolved;
  }

  /**
   * The form a collection gets when it declares no `quickEdit.row`: every field the list can edit, as
   * the list has always offered. Textareas are left out here only — a declared one is welcome.
   */
  private static automaticRow(fields: any[]): QuickEditField[] {
    return fields
      .filter((field) => field?.name && !CollectionListLayout.FRAME.includes(field.name))
      .filter((field) => !QuickEditControl.refusal(field) && field.type !== 'textarea')
      .map((field) => new QuickEditField(field, 1));
  }
}
