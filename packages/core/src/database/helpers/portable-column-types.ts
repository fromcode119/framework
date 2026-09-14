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
      key: 'TEXT',
      shortText: 'TEXT',
      longTextNullable: "TEXT NOT NULL DEFAULT ''",
      autoId: 'SERIAL PRIMARY KEY',
      boolTrue: 'TRUE',
      boolFalse: 'FALSE',
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
      key: 'TEXT',
      shortText: 'TEXT',
      longTextNullable: "TEXT NOT NULL DEFAULT ''",
      autoId: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      boolTrue: '1',
      boolFalse: '0',
    },
    mysql: {
      json: 'JSON',
      jsonEmptyArray: "('[]')",
      timestamp: 'TIMESTAMP NULL',
      now: 'CURRENT_TIMESTAMP',
      // MySQL indexes a variable-length column only with a declared prefix length, so anything that
      // is a key, a UNIQUE or a foreign-key target cannot be TEXT. 191 because these tables are
      // utf8mb4 — 4 bytes per character against the old 767-byte InnoDB index limit.
      key: 'VARCHAR(191)',
      shortText: 'VARCHAR(191)',
      // MySQL refuses a DEFAULT on TEXT at all, so the column is nullable there instead of
      // defaulting to the empty string. Readers already treat empty and null the same.
      longTextNullable: 'TEXT NULL',
      autoId: 'INT AUTO_INCREMENT PRIMARY KEY',
      boolTrue: 'TRUE',
      boolFalse: 'FALSE',
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
  /**
   * A string column that is a PRIMARY KEY, a UNIQUE, or the target of a FOREIGN KEY.
   *
   * Separate from an ordinary string because MySQL cannot index one of unbounded length, and getting
   * this wrong does not fail at write time — it fails at CREATE TABLE, on that driver only.
   */
  readonly key: string;
  /**
   * A short string that carries a DEFAULT.
   *
   * Separate from an ordinary TEXT because MySQL refuses one outright: "BLOB, TEXT, GEOMETRY or JSON
   * column can't have a default value". Use it for a status, a source, a type — anything with a
   * declared default or compared by value. A long free-text column with no default stays TEXT.
   */
  readonly shortText: string;
  /**
   * A long free-text column that wants to read back as "" rather than null.
   *
   * PostgreSQL and SQLite give TEXT a `DEFAULT ''`; MySQL forbids a default on TEXT entirely, so
   * there it is nullable and the empty string arrives as null. Every reader of these columns already
   * coalesces, which is why this is safe — and why it is a NAMED type rather than a quiet difference.
   */
  readonly longTextNullable: string;
  /** An auto-assigned integer primary key, including the PRIMARY KEY clause. */
  readonly autoId: string;
  /** Literal true/false, as a DEFAULT. SQLite has no boolean type and stores 1/0. */
  readonly boolTrue: string;
  readonly boolFalse: string;
}
