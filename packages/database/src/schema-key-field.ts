import { NamingStrategy } from '@database/naming-strategy';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';

/**
 * The primary key column is the schema builder's to emit — never a declared field's.
 *
 * Both dialect builders prepend their own key column (`id SERIAL PRIMARY KEY` on Postgres,
 * `id INTEGER PRIMARY KEY AUTOINCREMENT` on SQLite) and both used to suppress it the moment the
 * incoming field list contained anything named `id`. A declared `id` then fell through
 * `fieldToSqlFragment`, which has no `'id'` case, to the `TEXT` default — producing a nullable,
 * keyless TEXT column instead of a key.
 *
 * That is what shipped five plugin tables whose rows could not be
 * addressed at all: inserts omitting `id` succeeded and stored NULL, so every later
 * `update(table, { id }, …)` matched nothing and silently discarded the write. It is an easy
 * declaration to write — `BaseMigration`'s own usage example carried `{ name: 'id', type: 'id' }`
 * for months — so the fix belongs here, where no caller can get it wrong, rather than in a lint
 * rule that only catches the spellings we thought of.
 *
 * Dropping the declaration rather than honouring it is the deliberate choice: an `id` field never
 * produced a working key on either dialect, so there is no caller whose intent this defeats.
 */
export class SchemaKeyField {
  /**
   * Strip any field that is trying to declare the primary key, so the builder emits its own.
   */
  static withoutDeclaredKey(fields: ISchemaField[]): ISchemaField[] {
    return fields.filter((field) => !SchemaKeyField.isDeclaredKey(field));
  }

  /**
   * True when `field` is an attempt to declare the primary key column.
   *
   * Matched on the field's TYPE as well as its name, because `{ name: 'id', type: 'id' }` and a bare
   * `{ name: 'id' }` are both in the tree. The name test uses the snake_cased column the field would
   * actually produce, so `userId` (→ `user_id`) and `paid` are untouched — and so is a field named
   * `ID`, which snake-cases to `_i_d` and is therefore a different column, not a key declaration.
   */
  static isDeclaredKey(field: ISchemaField): boolean {
    return NamingStrategy.toSnakeCase(field.name) === 'id' || field.type === 'id';
  }
}
