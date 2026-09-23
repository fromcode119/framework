import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { TimestampsCarryTheirZoneMigration } from '@core/database/migrations/054_timestamps_carry_their_zone';

describe('054 timestamps carry their zone', () => {
  const dbWith = (dialect: string, columns: Array<Record<string, string>>) => {
    const executed: string[] = [];
    return {
      executed,
      db: {
        dialect,
        queryRaw: async () => columns,
        execute: async (query: any) => { executed.push(new PgDialect().sqlToQuery(query).sql); },
      } as any,
    };
  };

  it('converts every zone-less timestamp, reading the stored value as UTC', async () => {
    const { db, executed } = dbWith('postgres', [
      { table_name: '_system_tenants', column_name: 'created_at' },
      { table_name: '_system_file_grants', column_name: 'expires_at' },
    ]);

    await new TimestampsCarryTheirZoneMigration().up(db);

    expect(executed).toEqual([
      'ALTER TABLE "_system_tenants" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE USING "created_at" AT TIME ZONE \'UTC\'',
      'ALTER TABLE "_system_file_grants" ALTER COLUMN "expires_at" TYPE TIMESTAMP WITH TIME ZONE USING "expires_at" AT TIME ZONE \'UTC\'',
    ]);
  });

  it('does nothing outside PostgreSQL', async () => {
    const { db, executed } = dbWith('sqlite', [{ table_name: 'x', column_name: 'y' }]);
    await new TimestampsCarryTheirZoneMigration().up(db);
    expect(executed).toEqual([]);
  });
});
