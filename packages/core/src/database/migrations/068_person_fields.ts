import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * Person fields: attributes of a person that a site's operator declares (full name at birth, birth
 * place, favourite colour…), and each person's values for them.
 *
 * `person_fields` is the declaration — key, localized label, type, the options of a choice, who reads
 * it and whether the person may set it themselves. Every value is personal data: export and erasure cover all. `person_field_values`
 * holds one row per person and field, so a field is queryable on its own and erasure can reach exactly
 * one field.
 *
 * Neither table carries `tenant_id` here: both are in `TenantScopedTables`, and the isolation sweep that
 * runs on every boot adds the column with the current-site default and applies the policy, so one site
 * never sees another site's fields or values.
 */
export class PersonFieldsMigration extends BaseMigration {
  readonly version = 68;
  readonly name = 'Person fields';
  /** Two new tables: the running release never reads them. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS person_fields (
        id ${type.autoId},
        key ${type.key} NOT NULL,
        label ${type.json},
        type ${type.key} NOT NULL,
        options ${type.json},
        description ${type.json},
        self_editable BOOLEAN NOT NULL DEFAULT ${type.boolFalse},
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at ${type.timestamp} DEFAULT ${type.now},
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_person_fields_key ON person_fields (key)'));
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS person_field_values (
        id ${type.autoId},
        person_id INTEGER NOT NULL,
        field_key ${type.key} NOT NULL,
        value ${type.json},
        updated_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_person_field_values_person_key ON person_field_values (person_id, field_key)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_person_field_values_key ON person_field_values (field_key)'));
  }
}
