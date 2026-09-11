import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/** Rows come back through the RAW manager, so snake_case — the fixtures mirror that deliberately. */
function fakeDb(rowsByTenant: Record<string, Array<Record<string, unknown>>>, options: { fail?: boolean } = {}) {
  return {
    find: vi.fn(async (_table: string, query: any) => {
      if (options.fail) throw new Error('connection lost');
      return rowsByTenant[String(query?.where?.tenant_id ?? '')] ?? [];
    }),
  } as any;
}

function multiTenant() {
  TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
}

afterEach(() => {
  PluginTenantAccess.reset();
  TenantMode.reset();
});

describe('PluginTenantAccess', () => {
  it('says yes to everything on a SINGLE-TENANT deployment — there is no tenant axis there', () => {
    // Every existing installation is in this state. A tenancy gate that assumes tenants exist would
    // switch off every plugin on every one of them.
    PluginTenantAccess.configure(fakeDb({}));
    expect(PluginTenantAccess.isEnabledForCurrentTenant('anything')).toBe(true);
  });

  it('serves the tenant its own enabled set', async () => {
    multiTenant();
    PluginTenantAccess.configure(fakeDb({
      t1: [{ plugin_slug: 'eta', state: 'active' }, { plugin_slug: 'theta', state: 'active' }],
      t2: [{ plugin_slug: 'eta', state: 'active' }],
    }));

    await PluginTenantAccess.warm('t1');
    await PluginTenantAccess.warm('t2');

    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('theta')).toBe(true);
    });
    RequestContextUtils.storage.run({ tenantId: 't2' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('theta')).toBe(false);
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(true);
    });
  });

  it('treats an INACTIVE row as not enabled, not as merely present', async () => {
    multiTenant();
    PluginTenantAccess.configure(fakeDb({ t1: [{ plugin_slug: 'eta', state: 'inactive' }] }));
    await PluginTenantAccess.warm('t1');
    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(false);
    });
  });

  it('refuses when multi-tenant and NO tenant is bound — never widens to every tenant', () => {
    // "No tenant" must not mean "every tenant". That fail-open shape already had to be closed once
    // in BaseDialect.withTenant, where it silently unisolated MySQL.
    multiTenant();
    PluginTenantAccess.configure(fakeDb({ t1: [{ plugin_slug: 'eta', state: 'active' }] }));
    expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(false);
  });

  it('refuses for a tenant that was never loaded — "we do not know" renders as no', async () => {
    multiTenant();
    PluginTenantAccess.configure(fakeDb({ t1: [{ plugin_slug: 'eta', state: 'active' }] }));
    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(false);
    });
  });

  it('does not CACHE a failed read, so one database blip is not a permanent configuration', async () => {
    multiTenant();
    const failing = fakeDb({}, { fail: true });
    PluginTenantAccess.configure(failing);
    await PluginTenantAccess.warm('t1');

    PluginTenantAccess.configure(fakeDb({ t1: [{ plugin_slug: 'eta', state: 'active' }] }));
    await PluginTenantAccess.warm('t1');
    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(true);
    });
  });

  it('reads the table ONCE per tenant, then serves from memory', async () => {
    multiTenant();
    const db = fakeDb({ t1: [{ plugin_slug: 'eta', state: 'active' }] });
    PluginTenantAccess.configure(db);
    await PluginTenantAccess.warm('t1');
    await PluginTenantAccess.warm('t1');
    await PluginTenantAccess.warm('t1');
    expect(db.find).toHaveBeenCalledTimes(1);
  });

  it('re-reads after invalidate — this is what makes enable/disable need no restart', async () => {
    multiTenant();
    const rows: Record<string, Array<Record<string, unknown>>> = { t1: [] };
    const db = fakeDb(rows);
    PluginTenantAccess.configure(db);
    await PluginTenantAccess.warm('t1');

    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(false);
    });

    rows.t1 = [{ plugin_slug: 'eta', state: 'active' }];
    PluginTenantAccess.invalidate('t1');
    await PluginTenantAccess.warm('t1');

    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      expect(PluginTenantAccess.isEnabledForCurrentTenant('eta')).toBe(true);
    });
  });

  it('invalidates ONLY the named tenant, so one write does not re-query every tenant', async () => {
    multiTenant();
    const db = fakeDb({ t1: [{ plugin_slug: 'eta', state: 'active' }], t2: [] });
    PluginTenantAccess.configure(db);
    await PluginTenantAccess.warm('t1');
    await PluginTenantAccess.warm('t2');
    PluginTenantAccess.invalidate('t2');

    await PluginTenantAccess.warm('t1');
    expect(db.find).toHaveBeenCalledTimes(2);
    await PluginTenantAccess.warm('t2');
    expect(db.find).toHaveBeenCalledTimes(3);
  });

  /**
   * A bundled extension is part of the framework, so it is in NOBODY's installed set. Background
   * work gated on the installed set alone therefore ran for zero tenants on a deployment where the
   * extension was working perfectly in the admin — the Sources auto-build timer, exactly.
   */
  describe('isPresentFor — installed by the tenant, OR shipped by the framework', () => {
    it('answers true for a bundled slug the tenant never installed', async () => {
      multiTenant();
      PluginTenantAccess.configure(fakeDb({ t1: [] }));
      vi.spyOn(PluginTenantAccess, 'isBundledSlug').mockReturnValue(true);

      expect(await PluginTenantAccess.isPresentFor('build-server', 't1')).toBe(true);
    });

    it('still asks the installed set for a slug the framework does not ship', async () => {
      multiTenant();
      PluginTenantAccess.configure(fakeDb({
        t1: [{ plugin_slug: 'eta', state: 'active' }],
        t2: [],
      }));
      vi.spyOn(PluginTenantAccess, 'isBundledSlug').mockReturnValue(false);

      expect(await PluginTenantAccess.isPresentFor('eta', 't1')).toBe(true);
      expect(await PluginTenantAccess.isPresentFor('eta', 't2')).toBe(false);
    });
  });
});
