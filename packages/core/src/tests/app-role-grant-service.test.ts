import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppRoleGrantService } from '@core/database/app-role-grant-service';

/**
 * The SQL itself is verified against a real PostgreSQL (an owner-created table becomes readable by the
 * runtime role only once the sweep has run). What is worth pinning here is when it declines to run at
 * all — issuing owner-level grants on a deployment that has no separate owner would be noise at best.
 */
class FakeDb {
  statements: string[] = [];

  constructor(readonly dialect: string) {}

  async execute(query: any) {
    this.statements.push(String(query?.queryChunks ? 'sql' : query));
    return { rows: [] };
  }
}

describe('AppRoleGrantService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://fromcode_app:pw@db:5432/fromcode';
    process.env.DATABASE_MIGRATION_URL = 'postgresql://fromcode_owner:pw@db:5432/fromcode';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('grants on postgres when the owner and runtime roles are separate', async () => {
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.statements).toHaveLength(1);
  });

  it('does nothing on a dialect without role separation', async () => {
    const db = new FakeDb('sqlite');
    await AppRoleGrantService.apply(db as any);
    expect(db.statements).toEqual([]);
  });

  it('does nothing when one role does both jobs', async () => {
    process.env.DATABASE_MIGRATION_URL = process.env.DATABASE_URL;
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.statements).toEqual([]);
  });

  it('does nothing, rather than guessing a role, when DATABASE_URL names none', async () => {
    process.env.DATABASE_URL = 'postgresql://db:5432/fromcode';
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.statements).toEqual([]);
  });

  it('survives a database that refuses the grant rather than failing the boot', async () => {
    const db = { dialect: 'postgres', execute: async () => { throw new Error('permission denied'); } };
    await expect(AppRoleGrantService.apply(db as any)).resolves.toBeUndefined();
  });
});
