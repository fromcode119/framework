import { describe, expect, it } from 'vitest';
import { DatabaseRoleGuard } from '@core/tenant/database-role-guard';

class FakeDb {
  executed = 0;
  constructor(
    private readonly row: Record<string, unknown> | undefined,
    public readonly dialect: string = 'postgres',
  ) {}
  async execute() { this.executed += 1; return { rows: this.row ? [this.row] : [] }; }
}

describe('DatabaseRoleGuard', () => {
  it('accepts a non-superuser, non-owner role', async () => {
    const db = new FakeDb({ is_superuser: false, owns_tables: false });
    await expect(DatabaseRoleGuard.assertNotPrivileged(db)).resolves.toBeUndefined();
  });

  it('refuses a superuser — RLS is bypassed entirely for superusers', async () => {
    const db = new FakeDb({ is_superuser: true, owns_tables: false });
    await expect(DatabaseRoleGuard.assertNotPrivileged(db)).rejects.toThrow(/superuser/i);
  });

  it('refuses a table owner — without FORCE the owner bypasses every policy', async () => {
    const db = new FakeDb({ is_superuser: false, owns_tables: true });
    await expect(DatabaseRoleGuard.assertNotPrivileged(db)).rejects.toThrow(/owner/i);
  });

  it('refuses when it cannot determine the role, rather than assuming it is safe', async () => {
    const db = new FakeDb(undefined);
    await expect(DatabaseRoleGuard.assertNotPrivileged(db)).rejects.toThrow(/could not determine/i);
  });

  it('skips dialects that have no row-level security, without pretending to have checked', async () => {
    const db = new FakeDb({ is_superuser: true, owns_tables: true }, 'sqlite');
    await expect(DatabaseRoleGuard.assertNotPrivileged(db)).resolves.toBeUndefined();
    expect(db.executed).toBe(0);
  });
});
