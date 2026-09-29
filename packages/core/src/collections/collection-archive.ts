import { FieldType } from '@core/enums/field-type.enum';
import { FieldPosition } from '@core/enums/field-position.enum';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';

/**
 * The one place that knows what "archived" means for a collection declaring `archive`
 * ({@link ICollectionArchive}): which fields carry it, how a read leaves it out, and which keys tie a
 * record to the records archived with it.
 *
 * Pure — no database, no request — so the registration service, the plugin database view, the REST
 * controllers and the admin all read the same rule.
 */
export class CollectionArchive {
  /** When the record was archived. Empty on every record that is not. */
  static readonly ARCHIVED_AT = 'archivedAt';
  /** The record this one was archived together with (`<collection slug>:<id>`), empty when archived on its own. */
  static readonly ARCHIVED_WITH = 'archivedWith';
  /** The list query parameter choosing between live and archived records. */
  static readonly QUERY_PARAM = 'archived';
  /** `?archived=only` lists the archived records instead of the live ones. */
  static readonly QUERY_ONLY = 'only';

  static isArchivable(collection: Pick<ICollection, 'archive'> | null | undefined): boolean {
    return Boolean(collection?.archive);
  }

  static isArchived(record: Record<string, unknown> | null | undefined): boolean {
    const value = record?.[CollectionArchive.ARCHIVED_AT];
    return value !== null && value !== undefined && value !== '';
  }

  /** The where-predicate leaving archived rows out. */
  static liveWhere(): Record<string, null> {
    return { [CollectionArchive.ARCHIVED_AT]: null };
  }

  /** Whether a where already states something about archiving, in which case the caller decides. */
  static mentionsArchive(where: unknown): boolean {
    return Boolean(where) && typeof where === 'object' && !Array.isArray(where)
      && Object.prototype.hasOwnProperty.call(where, CollectionArchive.ARCHIVED_AT);
  }

  /** How a follower names the leader that archived it. Stable across renames of the collection's label. */
  static reference(collection: Pick<ICollection, 'slug'>, id: unknown): string {
    return `${collection.slug}:${String(id)}`;
  }

  /** Key name → field, for the keys this collection leads. */
  static leads(collection: Pick<ICollection, 'archive'>): Array<[string, string]> {
    return Object.entries(collection.archive?.leads ?? {});
  }

  /** The field on this collection carrying `key` when it follows that key, or null. */
  static followField(collection: Pick<ICollection, 'archive'>, key: string): string | null {
    const field = collection.archive?.follows?.[key];
    return field ? String(field) : null;
  }

  /**
   * The two fields an archivable collection is given. Both are visible and read-only: the operator
   * can always see THAT a record is archived and what took it along, and the only way to change
   * either is Archive / Restore.
   */
  static fields(): IField[] {
    return [
      {
        name: CollectionArchive.ARCHIVED_AT,
        type: FieldType.DATETIME,
        label: 'Archived',
        admin: {
          position: FieldPosition.SIDEBAR,
          readOnly: true,
          description: 'Set by Archive, cleared by Restore. Archived records are left out of every list, report and storefront page.',
        },
      } as IField,
      {
        name: CollectionArchive.ARCHIVED_WITH,
        type: FieldType.TEXT,
        label: 'Archived with',
        admin: {
          position: FieldPosition.SIDEBAR,
          readOnly: true,
          description: 'The record whose archiving took this one along. Restoring that record restores this one.',
        },
      } as IField,
    ];
  }
}
