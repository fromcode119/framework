import { NamingStrategy } from '@fromcode119/database';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

/**
 * References a `json` field DECLARES inside its own document (`IField.jsonReferences`).
 *
 * The remap already follows a `relationship` field and a relationship nested in an `array`/`group`.
 * A `json` field is the gap: its document is opaque, so an id in it keeps the source deployment's
 * numbering. That is right for a courier's own office id or an earlier migration's record, and
 * wrong for ids that are this platform's — an order line naming a product by id is read back as a
 * product id, and after an import it names a different product.
 *
 * Resolved to the SAME {@link TenantColumnReference} the other two sources produce, so the walk,
 * the dangling-id handling and the preview all treat it identically. The declaration is the whole
 * safeguard: nothing here infers that a number is an id, because on this data that inference would
 * rewrite a city id, an office id and a legacy order number along with the real ones.
 */
export class TenantJsonReferences {
  /** table → references, from every `json` field that declared where its ids are. */
  static forCollections(
    collections: Array<{ collection: ICollection; pluginSlug: string }>,
    wanted: Set<string>,
    columns: Map<string, Record<string, string>>,
    resolveTarget: (relationTo: string, pluginSlug: string) => string | null,
  ): Map<string, TenantColumnReference[]> {
    const out = new Map<string, TenantColumnReference[]>();
    for (const { collection, pluginSlug } of collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!wanted.has(table)) continue;
      for (const field of collection.fields ?? []) {
        const declared = field.jsonReferences;
        if (!declared || declared.length === 0) continue;
        const column = NamingStrategy.toSnakeCase(field.name);
        const type = columns.get(table)?.[column];
        // Only a column that exists here and actually holds JSON: a declaration against a `text`
        // column would have the walk parse and re-serialise a document this platform does not store.
        if (!type || !TenantTableDescriptor.isJsonType(type)) continue;
        for (const reference of declared) {
          if (reference.path.length === 0) continue;
          const target = resolveTarget(String(reference.relationTo), pluginSlug);
          if (!target) continue;
          const list = out.get(table) ?? [];
          list.push(new TenantColumnReference(table, column, target, TenantColumnSource.SCHEMA, [...reference.path], true, reference.required === true));
          out.set(table, list);
        }
      }
    }
    return out;
  }
}
