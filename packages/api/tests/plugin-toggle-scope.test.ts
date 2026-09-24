import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginState, PluginTenantStateService, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { PluginLifecycleController } from '@api/controllers/plugins/plugin-lifecycle-controller';

/**
 * Which axis a plugin switch moves on a multi-tenant deployment. With a site bound it is that site's
 * enablement. With NO site bound — the admin's platform scope, where Sites → Access and a plugin's own
 * page both live — it can only be the platform axis. It used to answer `no_tenant_selected`, so a newly
 * installed plugin could not be activated from the admin at all.
 */
describe('toggling a plugin on a multi-tenant deployment', () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = (platformAdmin: boolean) => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(TenantMembershipService.prototype, 'isPlatformAdminAccount').mockResolvedValue(platformAdmin);
    const siteEnable = vi.spyOn(PluginTenantStateService.prototype, 'enable').mockResolvedValue();
    const manager: any = {
      db: {}, schemaDb: {},
      plugins: new Map([['acme-pay', { state: PluginState.ACTIVE }]]),
      enable: vi.fn(async () => undefined),
      disable: vi.fn(async () => undefined),
    };
    const res: any = { statusCode: 200, body: null };
    res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
    res.json = vi.fn((body: unknown) => { res.body = body; return res; });
    return { controller: new PluginLifecycleController(manager), manager, res, siteEnable };
  };
  const request = (tenantId?: string) => ({ params: { slug: 'acme-pay' }, body: { enabled: true }, tenantId, user: { id: '1' } }) as any;

  it('activates the plugin on the platform when no site is bound and the caller is a platform admin', async () => {
    const { controller, manager, res, siteEnable } = setup(true);

    await controller.toggle(request(), res);

    expect(manager.enable).toHaveBeenCalledWith('acme-pay', expect.anything());
    expect(siteEnable).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true, state: 'active' });
  });

  it('refuses a caller who is not a platform admin when no site is bound', async () => {
    const { controller, manager, res } = setup(false);

    await controller.toggle(request(), res);

    expect(res.statusCode).toBe(403);
    expect(manager.enable).not.toHaveBeenCalled();
  });

  it('turns the plugin on for the bound site only, never the platform, when a site is bound', async () => {
    const { controller, manager, res, siteEnable } = setup(true);

    await controller.toggle(request('site-a'), res);

    expect(siteEnable).toHaveBeenCalledWith('site-a', 'acme-pay');
    expect(manager.enable).not.toHaveBeenCalled();
  });
});
