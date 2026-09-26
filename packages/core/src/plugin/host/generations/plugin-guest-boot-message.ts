import { ProjectPaths } from '@core/config/paths';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';

/** The `boot` message a plugin process gets — the only configuration it has (its environment is empty). */
export class PluginGuestBootMessage {
  static build(generation: PluginGuestGeneration, plugin: { slug: string; pluginDir: string; entryPath: string; manifest: Record<string, unknown>; projectRoot: string; defaultLocale: string }, lingerMs = 0): IPluginGuestBoot {
    const { slug, pluginDir, entryPath, manifest, projectRoot, defaultLocale } = plugin;
    return {
      slug,
      pluginDir,
      entryPath,
      manifest,
      socketPath: generation.socketPath,
      socketMode: generation.guest.socketMode,
      projectRoot,
      defaultLocale,
      attachSecret: generation.attachSecret,
      lingerMs,
      plugin: {
        slug,
        namespace: String(manifest.namespace || '').trim(),
        version: String(manifest.version || ''),
        dataDir: ProjectPaths.getPluginDataPath(slug),
        rootDir: pluginDir,
        config: (manifest.config as Record<string, unknown>) || {},
      },
    };
  }
}
