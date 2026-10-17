/**
 * The statements behind Postgres row protection. One trigger function serves every protected table: its
 * first argument says whether rows may be deleted, the rest name the write-once columns. A column counts
 * as written once it holds anything but NULL or an empty string; from then on an UPDATE that changes it
 * is refused, as is a DELETE or TRUNCATE where deletes are not allowed.
 *
 * The only way past it is the transaction-local setting `fromcode.protected_rows_override = 'on'`, which
 * the framework sets in exactly one place: erasing a whole site after its export was written. Any role
 * can set a custom setting for its own session, so the setting alone proves nothing: it is honoured only
 * when the role running the statement OWNS the table (the schema-owning connection the eraser runs on).
 * The request role is not the owner, so it cannot unlock protected rows by setting the flag itself.
 */
export class RowProtectionSql {
  static readonly FUNCTION = 'fc_protect_written_rows';
  static readonly OVERRIDE_SETTING = 'fromcode.protected_rows_override';

  static functionStatement(): string {
    return `CREATE OR REPLACE FUNCTION ${RowProtectionSql.FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  col text;
  old_value jsonb;
  new_value jsonb;
BEGIN
  IF current_setting('${RowProtectionSql.OVERRIDE_SETTING}', true) = 'on'
     AND pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = TG_RELID), 'USAGE') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'TRUNCATE' THEN RETURN NULL; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'The rows of % are kept as written: the table cannot be truncated', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF TG_ARGV[0] = 'no_delete' THEN
      RAISE EXCEPTION 'The rows of % are kept as written: a row cannot be deleted', TG_TABLE_NAME USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  FOR i IN 1 .. TG_NARGS - 1 LOOP
    col := TG_ARGV[i];
    old_value := to_jsonb(OLD) -> col;
    new_value := to_jsonb(NEW) -> col;
    IF old_value IS NOT NULL AND old_value <> 'null'::jsonb AND old_value <> '""'::jsonb AND new_value IS DISTINCT FROM old_value THEN
      RAISE EXCEPTION 'The column %.% is kept as written: it cannot change once set', TG_TABLE_NAME, col USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END
$fn$`;
  }

  static triggerStatements(table: string, writeOnceColumns: string[], noDelete: boolean): string[] {
    const quoted = RowProtectionSql.identifier(table);
    const args = [noDelete ? 'no_delete' : 'allow_delete', ...writeOnceColumns].map((value) => RowProtectionSql.literal(value)).join(', ');
    const rows = RowProtectionSql.identifier(`${table}_protect_rows`);
    const truncate = RowProtectionSql.identifier(`${table}_protect_truncate`);
    const statements = [
      `DROP TRIGGER IF EXISTS ${rows} ON ${quoted}`,
      `CREATE TRIGGER ${rows} BEFORE UPDATE OR DELETE ON ${quoted} FOR EACH ROW EXECUTE FUNCTION ${RowProtectionSql.FUNCTION}(${args})`,
      `DROP TRIGGER IF EXISTS ${truncate} ON ${quoted}`,
    ];
    if (noDelete) statements.push(`CREATE TRIGGER ${truncate} BEFORE TRUNCATE ON ${quoted} FOR EACH STATEMENT EXECUTE FUNCTION ${RowProtectionSql.FUNCTION}('no_delete')`);
    return statements;
  }

  /** `SET LOCAL` for the one caller allowed past the protection; only meaningful inside a transaction. */
  static overrideStatement(): string {
    return `SET LOCAL ${RowProtectionSql.OVERRIDE_SETTING} = 'on'`;
  }

  private static identifier(name: string): string {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Refusing an unexpected identifier: ${name}`);
    return `"${name}"`;
  }

  private static literal(value: string): string {
    if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Refusing an unexpected column name: ${value}`);
    return `'${value}'`;
  }
}
