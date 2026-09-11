import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginScheduledTenantRun } from '@core/plugin/tenant/plugin-scheduled-tenant-run';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * A scheduled task has no request, so it has no tenant, so the tenancy guard skipped every query it
 * made and the task read nothing. It still fired on time and still reported success — which is how a
 * "Build automatically" toggle came to be shipped for a build that could never happen.
 */
describe('PluginScheduledTenantRun', () => {
  const tenant = (id: string, isActive = true) => ({ id, isActive });
  let handler: ReturnType<typeof vi.fn>;
  let db: any;

  const givenTenants = (tenants: Array<{ id: string; isActive: boolean }>): void => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({
      listActive: async () => tenants.filter((t) => t.isActive),
    } as any);
  };

  const run = (): Promise<void> => PluginScheduledTenantRun.wrap({
    pluginSlug: 'build-server',
    taskName: 'auto-build',
    db,
    handler,
  })();

  beforeEach(() => {
    handler = vi.fn(async () => undefined);
    db = {
      find: vi.fn(async () => []),
      withTenant: vi.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
    };
    vi.spyOn(PluginTenantAccess, 'warm').mockResolvedValue(undefined);
    vi.spyOn(PluginTenantAccess, 'isPresentFor').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TenantMode.reset?.();
  });

  describe('on a single-tenant deployment', () => {
    beforeEach(() => vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false));

    it('runs the handler once, with no tenant scope at all', async () => {
      await run();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(db.withTenant).not.toHaveBeenCalled();
    });
  });

  describe('on a multi-tenant deployment', () => {
    beforeEach(() => vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true));

    it('runs the handler once for every active tenant', async () => {
      givenTenants([tenant('a'), tenant('b'), tenant('c')]);

      await run();

      expect(handler).toHaveBeenCalledTimes(3);
      expect(db.withTenant.mock.calls.map((call: any[]) => call[0])).toEqual(['a', 'b', 'c']);
    });

    it('gives the handler a tenant the database guard will accept', async () => {
      givenTenants([tenant('a')]);
      let seen: string | undefined;
      handler.mockImplementation(async () => { seen = RequestContextUtils.getTenantId(); });

      await run();

      expect(seen).toBe('a');
    });

    /**
     * "Has the plugin" must mean installed by them OR shipped by the framework. Gating on the
     * tenant's installed set alone ran the Sources task for zero tenants, because a bundled
     * extension is in nobody's installed set.
     */
    it('skips a tenant that does not run this plugin', async () => {
      givenTenants([tenant('a'), tenant('b')]);
      vi.spyOn(PluginTenantAccess, 'isPresentFor')
        .mockImplementation(async (_slug: string, tenantId: string) => tenantId === 'b');

      await run();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(db.withTenant).toHaveBeenCalledWith('b', expect.any(Function));
    });

    it('never runs for a suspended tenant', async () => {
      givenTenants([tenant('a'), tenant('suspended', false)]);

      await run();

      expect(db.withTenant.mock.calls.map((call: any[]) => call[0])).toEqual(['a']);
    });

    /**
     * One customer's bad data must not silently halt everyone else's scheduled work — the failure
     * is contained and named, not swallowed and not fatal.
     */
    it('keeps going when one tenant throws, and does not rethrow', async () => {
      givenTenants([tenant('a'), tenant('b'), tenant('c')]);
      handler.mockImplementation(async () => {
        if (RequestContextUtils.getTenantId() === 'b') throw new Error('boom');
      });

      await expect(run()).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalledTimes(3);
    });

    /**
     * Sequential, never overlapped: two tenant-bound pool clients held at once is how the pool
     * wedges the moment a handler waits on anything out-of-process.
     */
    it('closes one tenant scope before opening the next', async () => {
      givenTenants([tenant('a'), tenant('b')]);
      let open = 0;
      let concurrent = 0;
      db.withTenant = vi.fn(async (_tenantId: string, fn: () => Promise<unknown>) => {
        open += 1;
        concurrent = Math.max(concurrent, open);
        const result = await fn();
        open -= 1;
        return result;
      });

      await run();

      expect(concurrent).toBe(1);
    });
  });
});
