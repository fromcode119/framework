import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppRoleGrantService } from '@core/database/app-role-grant-service';

/**
 * The SQL itself is verified against a real PostgreSQL (an owner-created table becomes readable by the
 * runtime role only once the sweep has run). What is worth pinning here is when it declines to run at
 * all — issuing owner-level grants on a deployment that has no separate owner would be noise at best.
 */
class FakeDb {
  granted: string[] = [];

  constructor(readonly dialect: string, private readonly supported = true) {}

  async grantRuntimePrivileges(role: string) {
    this.granted.push(role);
    return this.supported
      ? { supported: true, reason: '' }
      : { supported: false, reason: 'no login system here' };
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

  it('grants to the role DATABASE_URL names when owner and runtime are separate', async () => {
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.granted).toEqual(['fromcode_app']);
  });

  it('reports a driver with no login system instead of failing', async () => {
    const db = new FakeDb('postgres', false);
    await expect(AppRoleGrantService.apply(db as any)).resolves.toBeUndefined();
  });

  it('does nothing on a dialect without role separation', async () => {
    const db = new FakeDb('sqlite');
    await AppRoleGrantService.apply(db as any);
    expect(db.granted).toEqual([]);
  });

  it('does nothing when one role does both jobs', async () => {
    process.env.DATABASE_MIGRATION_URL = process.env.DATABASE_URL;
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.granted).toEqual([]);
  });

  it('does nothing, rather than guessing a role, when DATABASE_URL names none', async () => {
    process.env.DATABASE_URL = 'postgresql://db:5432/fromcode';
    const db = new FakeDb('postgres');
    await AppRoleGrantService.apply(db as any);
    expect(db.granted).toEqual([]);
  });

  it('survives a database that refuses the grant rather than failing the boot', async () => {
    const db = { dialect: 'postgres', grantRuntimePrivileges: async () => { throw new Error('permission denied'); } };
    await expect(AppRoleGrantService.apply(db as any)).resolves.toBeUndefined();
  });
});
