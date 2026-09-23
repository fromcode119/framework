import { describe, expect, it, vi } from 'vitest';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import { PluginManagerQueryService } from '@core/plugin/services/runtime/plugin-manager-query-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which version the screen calls INSTALLED.
 *
 * It read the manifest held in memory — what this PROCESS loaded at boot. After an install the files
 * and the `_system_plugins` row are the new version while memory is still the old one, so the Sources
 * screen said "installed 0.1.29" where the row, the files and the admin's own Installed page all said
 * 0.1.30. That disagreement is not cosmetic: the panel used it to decide the new version was not in
 * place yet, and refused the rollback at the one moment it was wanted.
 *
 * The row is what every other screen reads. Agreeing with them beats reporting this process's private
 * view of itself.
 */
const service = (row: unknown, loaded: Array<{ slug: string; version: string }> = []) => {
  const plugins = new Map(loaded.map((p) => [p.slug, { manifest: p } as never]));
  const db = { findOne: vi.fn(async () => row) };
  return new PluginManagerQueryService({ warn() {}, info() {} } as never, db as never, {} as never, plugins as never);
};

describe('the installed version of a plugin', () => {
  it('is the recorded row, not the manifest this process loaded', async () => {
    const query = service({ slug: 'newsletter', version: '0.1.30' }, [{ slug: 'newsletter', version: '0.1.29' }]);

    expect(await query.installedExtensionVersion('newsletter', ExtensionScope.PLUGIN)).toBe('0.1.30');
  });

  it('reads the row for the slug being asked about', async () => {
    const query = service({ slug: 'cms', version: '0.1.60' });

    await query.installedExtensionVersion('cms', ExtensionScope.PLUGIN);

    expect((query as any).db.findOne).toHaveBeenCalledWith(SystemConstants.TABLE.PLUGINS, { slug: 'cms' });
  });

  it('falls back to what is loaded when no row exists', async () => {
    // Discovered from disk but never recorded. Answering "not installed" would offer a fresh install
    // of something already running.
    const query = service(null, [{ slug: 'forms', version: '0.1.31' }]);

    expect(await query.installedExtensionVersion('forms', ExtensionScope.PLUGIN)).toBe('0.1.31');
  });

  it('answers null when the plugin is neither recorded nor loaded', async () => {
    expect(await service(null).installedExtensionVersion('absent', ExtensionScope.PLUGIN)).toBeNull();
  });

  it('survives a database that cannot answer', async () => {
    const query = service(null, [{ slug: 'forms', version: '0.1.31' }]);
    (query as any).db.findOne = vi.fn(async () => { throw new Error('connection reset'); });

    expect(await query.installedExtensionVersion('forms', ExtensionScope.PLUGIN)).toBe('0.1.31');
  });

  it('still answers null for CORE, which is not installed beside anything', async () => {
    expect(await service({ version: '9.9.9' }).installedExtensionVersion('core', ExtensionScope.CORE)).toBeNull();
  });
});
