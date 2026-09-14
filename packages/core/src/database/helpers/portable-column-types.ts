/**
 * The handful of column types that are spelled differently in each dialect.
 *
 * A migration that writes PostgreSQL's spelling directly is a migration SQLite cannot run, and the
 * failure is not subtle — the whole boot dies on `no such table: information_schema.columns` or on a
 * `JSONB` it has never heard of. That is what kept a SQLite installation from ever finishing.
 *
 * The alternative already in the tree is to branch and write the CREATE TABLE out twice, which 001
 * does. That works, and it is why this exists instead: two copies of a column list is two places to
 * add a column, and the one you forget is not an error anywhere — it is a table that quietly has
 * different columns depending on which driver you installed on.
 *
 * So the column list is written ONCE and only the TYPES are resolved per dialect. This is not a
 * translator: it does not parse SQL and it cannot guess. It is a named map of four types, and a
 * dialect it does not know throws rather than guessing a spelling.
 *
 * The SQLite spellings are not invented here either — they are what `001_core_initial_schema-sqlite-tables.ts`
 * already uses for the same concepts (`DATETIME DEFAULT CURRENT_TIMESTAMP`, JSON held as `TEXT`), so
 * a table created by this agrees with the ones created before it.
 */
export class PortableColumnTypes {
  private static readonly BY_DIALECT: Record<string, IPortableColumnTypes> = {
    postgres: {
      json: 'JSONB',
      jsonEmptyArray: "'[]'::jsonb",
      timestamp: 'TIMESTAMPTZ',
      now: 'NOW()',
    },
    sqlite: {
      // SQLite has no JSON column type; every JSON value in this schema is already held as TEXT.
      json: 'TEXT',
      jsonEmptyArray: "'[]'",
      // DATETIME, not TIMESTAMPTZ, and CURRENT_TIMESTAMP rather than NOW() — SQLite has neither of
      // the PostgreSQL spellings. See the note in CLAUDE.md about these columns being TEXT in
      // practice: that is the existing, load-bearing behaviour, not something changed here.
      timestamp: 'DATETIME',
      now: 'CURRENT_TIMESTAMP',
    },
  };

  /**
   * The spellings for one dialect.
   *
   * Throws on a dialect this does not know, deliberately: a migration that silently fell back to
   * PostgreSQL's spelling would fail later, during `CREATE TABLE`, with an error naming a type
   * instead of naming the driver that cannot run it.
   */
  static for(dialect: string): IPortableColumnTypes {
    const key = String(dialect || '').toLowerCase();
    const types = PortableColumnTypes.BY_DIALECT[key]
      ?? PortableColumnTypes.BY_DIALECT[Object.keys(PortableColumnTypes.BY_DIALECT).find((name) => key.includes(name)) ?? ''];

    if (!types) {
      throw new Error(
        `PortableColumnTypes: no column spellings for dialect "${dialect}". `
        + `Known: ${Object.keys(PortableColumnTypes.BY_DIALECT).join(', ')}.`,
      );
    }
    return types;
  }
}

/** One dialect's spelling for each type that differs. Add a type here, not in a migration. */
export interface IPortableColumnTypes {
  /** A column holding a JSON document. */
  readonly json: string;
  /** The literal for an empty JSON array, as a DEFAULT. */
  readonly jsonEmptyArray: string;
  /** A point in time. */
  readonly timestamp: string;
  /** "when this row was written", as a DEFAULT. */
  readonly now: string;
}
