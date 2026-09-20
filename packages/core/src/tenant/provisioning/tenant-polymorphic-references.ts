import { SystemConstants } from '@core/constants/system.constants';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';

/**
 * References whose TARGET TABLE is named by a sibling column, one row at a time.
 *
 * A foreign key and a `relationship` field both name one fixed table, and the id remap follows them
 * because of that. A polymorphic reference names no table at all in its schema: the row itself
 * carries the name, in a second column beside the id. Nothing in the catalog's two discovery
 * sources can see such a pointer — there is no constraint to introspect (a FK cannot span tables)
 * and `relationTo` is either absent or an array, which `schemaReferences` skips for exactly this
 * reason.
 *
 * Left unfollowed, every one of these rows survives the import pointing at whatever now holds its
 * old id. Measured on a real migration: 451 of 451 rows of `_system_record_versions` — the restore
 * points behind "revert this record" — pointed at ids the destination had re-numbered, so not one
 * version of any record could be restored, and nothing said so.
 *
 * Declared, never inferred: a column called `*_id` beside one called `*_type` is a guess, and a
 * wrong guess here rewrites ids that were never references. Only the framework's own tables are
 * declared, because only for those is the framework entitled to know that the type column holds a
 * physical table name — a plugin's `entity_type` holds whatever that plugin means by it, which the
 * framework cannot resolve and must not try to.
 */
export class TenantPolymorphicReferences {
  /**
   * `_system_record_versions.ref_collection` stores the physical table name of the record the
   * snapshot belongs to (`fcp_acme_products`), so the remap of that table is directly
   * addressable once the row is in hand.
   */
  private static readonly DECLARED: ReadonlyArray<{ table: string; column: string; targetTableColumn: string }> = [
    { table: SystemConstants.TABLE.RECORD_VERSIONS, column: 'ref_id', targetTableColumn: 'ref_collection' },
  ];

  /** Declared polymorphic references for the tables in `wanted`, keyed by table. */
  static forTables(wanted: Set<string>, columns: Map<string, Record<string, string>>): Map<string, TenantColumnReference[]> {
    const out = new Map<string, TenantColumnReference[]>();
    for (const declared of TenantPolymorphicReferences.DECLARED) {
      if (!wanted.has(declared.table)) continue;
      const types = columns.get(declared.table) ?? {};
      // Both halves must exist here: an id with no type column beside it cannot be resolved, and
      // rewriting it against a guessed table would point it somewhere worse than where it is.
      if (!(declared.column in types) || !(declared.targetTableColumn in types)) continue;
      out.set(declared.table, [
        new TenantColumnReference(declared.table, declared.column, '', TenantColumnSource.POLYMORPHIC, [], false, false, declared.targetTableColumn),
      ]);
    }
    return out;
  }
}
