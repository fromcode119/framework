import { NamingStrategy } from '@fromcode119/database';
import { TenantColumnFold } from '@core/tenant/provisioning/tenant-column-fold';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

/** Reads `IField.legacyColumns` off the registered collections — see {@link TenantColumnFold}. */
export class TenantSchemaFolds {
  /**
   * Destination columns that ABSORB an older schema's columns, from `IField.legacyColumns`.
   *
   * Read exactly as a relationship is: a generic property on a declared field. The framework learns
   * that some field claims some older column names; it never learns whose. A claim is kept only when
   * the destination column actually exists here and holds JSON — folding eight values into a `text`
   * column would write a shape nothing reads.
   */
  static forCollections(
    collections: Array<{ collection: ICollection }>,
    wanted: Set<string>,
    columns: Map<string, Record<string, string>>,
  ): Map<string, TenantColumnFold[]> {
    const out = new Map<string, TenantColumnFold[]>();
    for (const { collection } of collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!wanted.has(table)) continue;
      for (const field of collection.fields ?? []) {
        const legacy = field.legacyColumns;
        if (!legacy || Object.keys(legacy).length === 0) continue;
        const column = NamingStrategy.toSnakeCase(field.name);
        const type = columns.get(table)?.[column];
        if (!type || !TenantTableDescriptor.isJsonType(type)) continue;
        const existing = out.get(table) ?? [];
        existing.push(new TenantColumnFold(column, { ...legacy }));
        out.set(table, existing);
      }
    }
    return out;
  }
}
