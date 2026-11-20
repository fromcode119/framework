import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginCoreIncompatibleError } from '@core/plugin/services/installation/plugin-core-incompatible-error';

/**
 * The install/update path must refuse a version this core cannot run BEFORE it replaces the working
 * files, and auto-update-all must skip such versions rather than take them — the think-in-pink incident,
 * where a plugin that needed a newer core was taken by auto-update and its whole bundle stopped loading.
 */
describe('PluginInstallationService — core compatibility gate', () => {
  afterEach(() => vi.restoreAllMocks());

  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  function service(marketplace: any, running: string, plugins = new Map<string, any>()) {
    return new PluginInstallationService(
      logger, marketplace, {} as never, {} as never, {} as never, {} as never,
      plugins, '/tmp/plugins', async () => {}, async () => {},
      undefined, undefined, undefined, undefined, undefined,
      async () => running,
    );
  }

  it('refuses an update whose required core the running core does not meet, without downloading', async () => {
    const downloadAndInstall = vi.fn();
    const marketplace: any = {
      getPluginInfo: vi.fn(async () => ({ slug: 'sample-shop', version: '0.1.483', engines: { core: '>=0.2.603' } })),
      downloadAndInstall,
    };
    const svc = service(marketplace, '0.2.602');

    const error = await svc.installOrUpdateFromMarketplace('sample-shop').catch((e) => e);
    expect(error).toBeInstanceOf(PluginCoreIncompatibleError);
    expect(error.code).toBe('CORE_TOO_OLD');
    expect(String(error.message)).toContain('>=0.2.603');
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  it('lets a compatible version through to the download step', async () => {
    const marketplace: any = {
      getPluginInfo: vi.fn(async () => ({ slug: 'sample-shop', version: '0.1.491', engines: { core: '>=0.2.603' } })),
      // Throw a sentinel right where the real download would start, to prove the gate let it past.
      downloadAndInstall: vi.fn(async () => { throw new Error('REACHED_DOWNLOAD'); }),
    };
    const svc = service(marketplace, '0.2.606');
    await expect(svc.installOrUpdateFromMarketplace('sample-shop')).rejects.toThrow('REACHED_DOWNLOAD');
  });

  it('updateAll holds back a newer version the core cannot run, and updates the rest', async () => {
    const plugins = new Map<string, any>([
      ['sample-shop', { manifest: { slug: 'sample-shop', version: '0.1.480' } }],
      ['sample-courses', { manifest: { slug: 'sample-courses', version: '0.1.0' } }],
    ]);
    const marketplace: any = {
      fetchCatalog: vi.fn(async () => [
        { slug: 'sample-shop', version: '0.1.483', engines: { core: '>=0.2.603' } },
        { slug: 'sample-courses', version: '0.1.5' }, // no requirement → compatible
      ]),
    };
    const svc = service(marketplace, '0.2.602', plugins);
    const install = vi.spyOn(svc, 'installOrUpdateFromMarketplace').mockResolvedValue({} as never);

    const result = await svc.updateAllFromMarketplace();

    expect(result.heldForCore.map((h) => h.slug)).toEqual(['sample-shop']);
    expect(result.heldForCore[0]).toMatchObject({ required: '>=0.2.603' });
    expect(install).toHaveBeenCalledTimes(1);
    expect(install.mock.calls[0][0]).toBe('sample-courses');
    expect(result.updated).toEqual(['sample-courses']);
  });
});
