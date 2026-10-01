import { describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@fromcode119/core';
import { SystemIntegrationController } from '@api/controllers/system/system-integration-controller';

/**
 * A platform-only integration type (monitoring) belongs to the platform admin. Inside a site it is not
 * listed and cannot be changed: a site-level entry would be one nothing reads. Every other type works
 * inside a site exactly as before.
 */
describe('platform-only integration types', () => {
  const types: Record<string, any> = { monitoring: { key: 'monitoring', label: 'Monitoring', platformOnly: true }, email: { key: 'email', platformOnly: false } };
  const setup = () => {
    const integrations = {
      listConfigs: vi.fn(async () => Object.values(types)),
      getConfig: vi.fn(async (type: string) => types[type] ?? null),
      updateConfig: vi.fn(async () => ({ ok: true })),
    };
    return { integrations, controller: new SystemIntegrationController({ manager: { integrations } } as any) };
  };
  const response = () => { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) }; return res; };
  const inSite = <T>(fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId: 'shop' } as any, fn);

  it('is not listed inside a site, and is listed at platform level', async () => {
    const { controller } = setup();
    const site = response();
    await inSite(() => controller.getIntegrations({} as any, site));
    expect(site.json.mock.calls[0][0].docs.map((d: any) => d.key)).toEqual(['email']);
    const platform = response();
    await controller.getIntegrations({} as any, platform);
    expect(platform.json.mock.calls[0][0].docs.map((d: any) => d.key)).toEqual(['monitoring', 'email']);
  });

  it('refuses a change from inside a site, with the reason, and writes nothing', async () => {
    const { controller, integrations } = setup();
    const res = response();
    await inSite(() => controller.updateIntegration({ params: { type: 'monitoring' }, body: { provider: 'email' } } as any, res));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'platform_only_integration', label: 'Monitoring' });
    expect(integrations.updateConfig).not.toHaveBeenCalled();
  });

  it('saves it at platform level, and saves any other type inside a site as before', async () => {
    const { controller, integrations } = setup();
    await controller.updateIntegration({ params: { type: 'monitoring' }, body: { provider: 'email' } } as any, response());
    await inSite(() => controller.updateIntegration({ params: { type: 'email' }, body: { provider: 'smtp' } } as any, response()));
    expect(integrations.updateConfig).toHaveBeenCalledTimes(2);
  });
});
