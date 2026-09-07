import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseRoleBootstrapService } from '@core/database/database-role-bootstrap-service';
import { DatabaseRoleOutcome } from '@fromcode119/database';

/**
 * The provisioning SQL is exercised against a real PostgreSQL (roles created with the right attributes,
 * idempotent on a second pass, a password full of quotes and backslashes round-tripping, and SQLite
 * reporting "unsupported" instead of throwing). What is pinned here is how the PLAN is derived, because
 * that is what decides which logins a deployment ends up with.
 */
describe('DatabaseRoleBootstrapService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://app_role:app_pw@db:5432/fromcode';
    process.env.DATABASE_MIGRATION_URL = 'postgresql://owner_role:owner_pw@db:5432/fromcode';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('takes both logins, and the database, from the connection strings alone', () => {
    const plan = DatabaseRoleBootstrapService.plan()!;
    expect(plan.database).toBe('fromcode');
    expect(plan.owner.name).toBe('owner_role');
    expect(plan.owner.password).toBe('owner_pw');
    expect(plan.runtime.name).toBe('app_role');
    expect(plan.isSingleRole).toBe(false);
  });

  it('collapses to one login when no separate migration connection is configured', () => {
    delete process.env.DATABASE_MIGRATION_URL;
    const plan = DatabaseRoleBootstrapService.plan()!;
    expect(plan.isSingleRole).toBe(true);
    expect(plan.owner.name).toBe('app_role');
  });

  it('decodes credentials that had to be percent-encoded to fit in a URL', () => {
    process.env.DATABASE_URL = "postgresql://app%40host:p%27w%3B%20DROP@db:5432/fromcode";
    const plan = DatabaseRoleBootstrapService.plan()!;
    expect(plan.runtime.name).toBe('app@host');
    expect(plan.runtime.password).toBe("p'w; DROP");
  });

  it('plans nothing when DATABASE_URL names no role, rather than inventing one', () => {
    process.env.DATABASE_URL = 'postgresql://db:5432/fromcode';
    delete process.env.DATABASE_MIGRATION_URL;
    expect(DatabaseRoleBootstrapService.plan()).toBeNull();
  });

  it('reports a driver with no login system as done, not failed', async () => {
    const manager = { provisionRoles: async () => DatabaseRoleOutcome.unsupported('no logins here') };
    await expect(DatabaseRoleBootstrapService.run(manager)).resolves.toBe(true);
  });

  it('does nothing when there is no usable plan', async () => {
    process.env.DATABASE_URL = '';
    delete process.env.DATABASE_MIGRATION_URL;
    let called = false;
    const manager = { provisionRoles: async () => { called = true; return DatabaseRoleOutcome.applied([]); } };
    await expect(DatabaseRoleBootstrapService.run(manager)).resolves.toBe(false);
    expect(called).toBe(false);
  });
});
