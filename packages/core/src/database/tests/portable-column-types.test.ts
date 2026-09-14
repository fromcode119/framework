import { describe, expect, it } from 'vitest';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * The four column types that made a SQLite installation impossible.
 *
 * What matters here is not that the strings are right — it is that an UNKNOWN dialect throws. A map
 * that quietly fell back to PostgreSQL's spelling would move the failure from this line, where it
 * names the driver, to a `CREATE TABLE` several migrations later that names only a type nobody
 * recognises. That is precisely how migrations 040-042 came to be undiagnosed for so long.
 */
describe('PortableColumnTypes', () => {
  it('gives PostgreSQL its own spellings', () => {
    const type = PortableColumnTypes.for('postgres');

    expect(type.json).toBe('JSONB');
    expect(type.jsonEmptyArray).toBe("'[]'::jsonb");
    expect(type.timestamp).toBe('TIMESTAMPTZ');
    expect(type.now).toBe('NOW()');
  });

  /**
   * These are not invented for this helper — they are what `001_core_initial_schema-sqlite-tables.ts`
   * already used for the same concepts, so a table created by a later migration agrees with the ones
   * created before it.
   */
  it('gives SQLite the spellings the initial schema already uses', () => {
    const type = PortableColumnTypes.for('sqlite');

    expect(type.json).toBe('TEXT');
    expect(type.jsonEmptyArray).toBe("'[]'");
    expect(type.timestamp).toBe('DATETIME');
    expect(type.now).toBe('CURRENT_TIMESTAMP');
  });

  it('THROWS on a dialect it does not know, rather than guessing a spelling', () => {
    expect(() => PortableColumnTypes.for('mysql')).toThrow(/no column spellings for dialect "mysql"/);
    expect(() => PortableColumnTypes.for('')).toThrow(/no column spellings/);
  });

  it('names the alternatives in the error, because the reader is choosing a driver', () => {
    expect(() => PortableColumnTypes.for('oracle')).toThrow(/Known: postgres, sqlite/);
  });

  it('matches the dialect however the driver spells it', () => {
    // `db.dialect` is whatever the resolver produced — `postgres`, `postgresql`, a cased variant.
    expect(PortableColumnTypes.for('PostgreSQL').json).toBe('JSONB');
    expect(PortableColumnTypes.for('postgresql').json).toBe('JSONB');
  });
});
