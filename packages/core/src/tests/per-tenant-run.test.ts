import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * Boot and timers have no request to borrow a tenant from, and both were silently broken by it: a
 * scheduled task read nothing, and every person-catalog seed was refused by row-level security
 * because a row written with no tenant can never satisfy `tenant_id = current_setting(...)`.
 */
describe('PerTenantRun', () => {
  let db: any;
  let work: ReturnType<typeof vi.fn>;

  const givenTenants = (ids: string[]): void => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({
      listActive: async () => ids.map((id) => ({ id, isActive: true })),
    } as any);
  };

  beforeEach(() => {
    work = vi.fn(async () => undefined);
    db = { withTenant: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()) };
  });

  afterEach(() => { vi.restoreAllMocks(); TenantMode.reset?.(); });

  it('runs once, unscoped, on a single-tenant deployment', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);

    await PerTenantRun.forEach({ label: 'seed', db, work });

    expect(work).toHaveBeenCalledTimes(1);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  describe('on a multi-tenant deployment', () => {
    beforeEach(() => vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true));

    it('runs once per tenant, each inside its own scope', async () => {
      givenTenants(['a', 'b', 'c']);

      await PerTenantRun.forEach({ label: 'seed', db, work });

      expect(work).toHaveBeenCalledTimes(3);
      expect(db.withTenant.mock.calls.map((c: any[]) => c[0])).toEqual(['a', 'b', 'c']);
    });

    /** Both scopes or neither: the store stops the guard skipping, `withTenant` satisfies the policy. */
    it('gives the work a tenant the guard and the policy both accept', async () => {
      givenTenants(['a']);
      let seen: string | undefined;
      work.mockImplementation(async () => { seen = RequestContextUtils.getTenantId(); });

      await PerTenantRun.forEach({ label: 'seed', db, work });

      expect(seen).toBe('a');
    });

    it('skips tenants the work does not apply to', async () => {
      givenTenants(['a', 'b']);

      const ran = await PerTenantRun.forEach({
        label: 'seed', db, work, appliesTo: async (id) => id === 'b',
      });

      expect(ran).toBe(1);
      expect(db.withTenant).toHaveBeenCalledWith('b', expect.any(Function));
    });

    it('keeps going when one tenant throws, and reports how many ran', async () => {
      givenTenants(['a', 'b', 'c']);
      work.mockImplementation(async () => {
        if (RequestContextUtils.getTenantId() === 'b') throw new Error('boom');
      });

      await expect(PerTenantRun.forEach({ label: 'seed', db, work })).resolves.toBe(2);
      expect(work).toHaveBeenCalledTimes(3);
    });
  });
});
