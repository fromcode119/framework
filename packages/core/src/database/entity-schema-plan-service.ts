import { createHash } from 'crypto';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';

export class EntitySchemaPlanService {
  buildPlan(collection: ICollection, exists: boolean, existingColumns: string[]): IEntitySchemaPlan {
    const existing = new Set(existingColumns.map((column) => column.toLowerCase()));

    return {
      collection,
      tableName: collection.slug,
      fingerprint: this.createFingerprint(collection),
      exists,
      missingColumns: exists
        ? this.resolveSyncableFields(collection)
          .filter((field) => !existing.has(this.toColumnName(field.name).toLowerCase()))
          .map((field) => ({ field, columnName: this.toColumnName(field.name) }))
        : [],
      // Only for a table that already exists: on CREATE TABLE the schema builder emits the unique
      // inline, and it is the EXISTING-column case that had no path at all — a field declared unique
      // after its table was created was fingerprinted and then never acted on.
      declaredUniques: exists
        ? this.resolveSyncableFields(collection)
          .filter((field) => Boolean(field.unique))
          .map((field) => this.toColumnName(field.name))
          .filter((column) => existing.has(column.toLowerCase()))
        : [],
      // Only for a table that already exists, and for the same reason as `declaredUniques`: on
      // CREATE TABLE the builder emits the right nullability, and it is the EXISTING column whose
      // `required` was relaxed afterwards that had no path at all.
      declaredOptionals: exists
        ? this.resolveSyncableFields(collection)
          .filter((field) => !field.required)
          .map((field) => this.toColumnName(field.name))
          .filter((column) => existing.has(column.toLowerCase()))
        : [],
      // The REVERSE of `missingColumns`, and the half that was never computed: what the table has
      // that nothing declares. Only ever reported — see `SchemaReconciliationService`.
      undeclaredColumns: exists
        ? existingColumns.filter((column) => !this.isAccountedFor(column, collection))
        : [],
      unsupportedIndexes: this.resolveUnsupportedIndexes(collection),
    };
  }

  createFingerprint(collection: ICollection): string {
    const payload = {
      slug: collection.slug,
      fields: this.resolveSyncableFields(collection).map((field) => ({
        name: field.name,
        type: field.type,
        required: Boolean(field.required),
        unique: Boolean(field.unique),
        localized: Boolean(field.localized),
        relationTo: field.relationTo || null,
        hasMany: Boolean(field.hasMany),
      })),
      indexes: (collection.indexes || []).map((index) => ({
        name: index.name || '',
        fields: [...index.fields].sort(),
        unique: Boolean(index.unique),
      })),
    };

    return createHash('sha256').update(this.stableStringify(payload)).digest('hex');
  }

  toColumnName(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Columns the framework owns rather than a field declaring them.
   *
   * `id`, `created_at` and `updated_at` are emitted by the schema builder when no field claims them;
   * `tenant_id` is added by the isolation sweep. None appears in `collection.fields`, so without
   * this every table would report four orphans.
   */
  private static readonly FRAMEWORK_COLUMNS = new Set<string>(['id', 'created_at', 'updated_at', 'tenant_id']);

  /**
   * Whether some declaration accounts for `column`.
   *
   * Reads `collection.fields` as it stands AT SYNC TIME, which matters: entity registration pushes
   * extra fields onto a collection before it is synced (workflow status, relationship keys), and
   * those are as declared as any other. Comparing against a static list would report them as
   * orphans.
   */
  private isAccountedFor(column: string, collection: ICollection): boolean {
    const name = String(column ?? '').toLowerCase();
    if (EntitySchemaPlanService.FRAMEWORK_COLUMNS.has(name)) return true;
    return (collection.fields || [])
      .some((field) => this.toColumnName(field.name).toLowerCase() === name);
  }

  private resolveSyncableFields(collection: ICollection): IField[] {
    return (collection.fields || []).filter((field) => field.name !== 'id');
  }

  private resolveUnsupportedIndexes(collection: ICollection): string[] {
    return (collection.indexes || [])
      .filter((index) => index.fields.length > 0)
      .map((index) => index.name || `${collection.slug}_${index.fields.join('_')}_idx`);
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => {
        const nextValue = (value as Record<string, unknown>)[key];
        return `${JSON.stringify(key)}:${this.stableStringify(nextValue)}`;
      }).join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
