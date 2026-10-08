import { afterEach, describe, expect, it, vi } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginContextFactory } from '@core/plugin/context';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';

/**
 * `plugins.on` registered the raw handler while `hooks.on` gated it on the site, so a plugin a site
 * had switched off still received that site's events. Events from a site now reach only plugins the
 * site runs — and a platform event with no site (boot's `plugins:ready`) still reaches everyone.
 */
describe('plugin event subscriptions respect the site', () => {
  const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };

  function contextFor(slug: string) {
    const hooks = new HookManager();
    const plugin: any = { manifest: { slug, capabilities: ['hooks'] }, approvedCapabilities: ['hooks'], state: 'active' };
    const manager: any = { hooks, plugins: new Map([[slug, plugin]]), db: {}, jobs: {}, logger: { child: () => ({}) }, middlewares: new MiddlewareManager(), registeredCollections: new Map() };
    return { context: PluginContextFactory.createPluginContext(plugin, manager, logger) as any, hooks };
  }

  afterEach(() => { vi.restoreAllMocks(); TenantMode.reset(); });

  it('plugins.on does not deliver a site’s event to a plugin that site switched off', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    vi.spyOn(PluginTenantAccess, 'isEnabledForCurrentTenant').mockImplementation(() => RequestContextUtils.getTenantId() === 'on-site');
    const { context, hooks } = contextFor('spy');
    const seen: string[] = [];
    context.plugins.on('order:created', async (payload: any) => { seen.push(payload.site); });

    await RequestContextUtils.storage.run({ tenantId: 'off-site' } as any, () => hooks.emit('order:created', { site: 'off-site' }));
    await RequestContextUtils.storage.run({ tenantId: 'on-site' } as any, () => hooks.emit('order:created', { site: 'on-site' }));

    await vi.waitFor(() => expect(seen).toEqual(['on-site']));
  });

  it('plugins.on still delivers a platform event that has no site', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const { context, hooks } = contextFor('peer');
    const handler = vi.fn(async () => undefined);
    context.plugins.on('plugins:ready', handler);

    await hooks.emit('plugins:ready', {});

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  });

  it('plugins.off removes what plugins.on registered', async () => {
    const { context, hooks } = contextFor('peer');
    const handler = vi.fn(async () => undefined);
    context.plugins.on('plugins:ready', handler);
    context.plugins.off('plugins:ready', handler);

    await hooks.emit('plugins:ready', {});

    expect(handler).not.toHaveBeenCalled();
  });
});
