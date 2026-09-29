import { CollectionArchive, ICollection } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';

/**
 * Which side of the archive a REST read sees: live records by default, only archived ones for the
 * admin's Archived view. Nothing for a collection that is not archivable.
 */
export class CollectionArchiveReadClause {
  static build(db: IDatabaseManager, collection: ICollection, table: any, archivedOnly: boolean): unknown {
    if (!CollectionArchive.isArchivable(collection)) return undefined;
    const column = table[CollectionArchive.ARCHIVED_AT];
    if (!column) return undefined;
    return archivedOnly ? db.isNotNull(column) : db.isNull(column);
  }

  /** ANDs whichever clauses are present; undefined when none is. */
  static combine(db: IDatabaseManager, ...clauses: unknown[]): unknown {
    const present = clauses.filter(Boolean);
    if (present.length === 0) return undefined;
    return present.length === 1 ? present[0] : db.and(...(present as any[]));
  }
}
