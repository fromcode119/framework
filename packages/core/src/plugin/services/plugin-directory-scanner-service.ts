import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import Module from 'module';
import { Logger } from '../../logging';
import { LoadedPlugin } from '../../types';
import { ProjectPaths } from '../../config/paths';
import { ManifestNormalizer } from '../../manifest-normalizer';
import { PluginDependencyInstallerService } from './plugin-dependency-installer-service';

const manifestSchema = z.object({
  name: z.string(),
  slug: z.string(),
  version: z.string(),
  description: z.string().optional(),
  main: z.string().optional(),
  entry: z.string().optional(),
  admin: z.any().optional(),
  ui: z.any().optional(),
  runtimeModules: z.any().optional(),
  capabilities: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
}).passthrough();

/**
 * PluginDirectoryScannerService
 *
 * Scans the plugins root (and theme-local plugin dirs) on disk, validates each
 * manifest, loads the plugin module (with CJS/ESM fallback), and stages it.
 * Extracted from DiscoveryService to keep that class under the size limit;
 * DiscoveryService delegates discoverPlugins() to this service unchanged.
 */
export class PluginDirectoryScannerService {
  constructor(
    private pluginsRoot: string,
    private projectRoot: string,
    private logger: Logger,
    private dependencyInstaller: PluginDependencyInstallerService,
  ) {
    this.ensureSharedModuleResolution();
  }

  private ensureSharedModuleResolution(): void {
    try {
      const projectNodeModules = path.resolve(this.projectRoot, 'node_modules');
      if (!fs.existsSync(projectNodeModules) || !fs.statSync(projectNodeModules).isDirectory()) return;

      const delimiter = path.delimiter;
      const existing = String(process.env.NODE_PATH || '')
        .split(delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (!existing.includes(projectNodeModules)) {
        process.env.NODE_PATH = existing.length > 0
          ? `${projectNodeModules}${delimiter}${existing.join(delimiter)}`
          : projectNodeModules;
        (Module as any)._initPaths();
      }
    } catch {
      // Best effort: plugin resolution still has fallback behavior.
    }
  }

  private shouldUseNativeImport(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';

    return code === 'ERR_REQUIRE_ESM'
      || message.includes('Must use import to load ES Module')
      || message.includes('require() of ES Module');
  }

  private async nativeImportModule(filePath: string): Promise<any> {
    const { pathToFileURL } = await import('url');
    const dynamicImport = new Function('specifier', 'return import(specifier);');
    return dynamicImport(pathToFileURL(filePath).href);
  }

  private async loadPluginModule(indexPath: string): Promise<any> {
    try {
      return require(indexPath);
    } catch (error: any) {
      if (!this.shouldUseNativeImport(error)) {
        throw error;
      }

      return this.nativeImportModule(indexPath);
    }
  }

  public async discoverPlugins(
    existingPlugins: Map<string, LoadedPlugin>,
    installedState: Record<string, { sandboxConfig?: any }> = {}
  ): Promise<{
    discovered: { plugin: any, path: string }[],
    errored: { manifest: any, path: string, error: string }[]
  }> {
    this.logger.info(`Scanning for plugins in ${this.pluginsRoot}...`);
    const roots = [this.pluginsRoot];

    const themesDir = ProjectPaths.getThemesDir();
    if (fs.existsSync(themesDir)) {
      const themes = fs.readdirSync(themesDir);
      for (const themeSlug of themes) {
        const themePluginsPath = path.join(themesDir, themeSlug, 'plugins');
        if (fs.existsSync(themePluginsPath) && fs.statSync(themePluginsPath).isDirectory()) {
          roots.push(themePluginsPath);
        }
      }
    }

    const discovered: { plugin: any, path: string }[] = [];
    const errored: { manifest: any, path: string, error: string }[] = [];
    const seenSlugs = new Set<string>();
    const seenPaths = new Set<string>();

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const pluginDirs = fs.readdirSync(root);

      for (const dir of pluginDirs) {
        if (dir.startsWith('.')) continue;
        if (dir.startsWith('ext-') || dir.startsWith('fromcode-plugin-ext-')) continue;

        const pluginPath = path.join(root, dir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;
        if (seenPaths.has(pluginPath)) continue;
        seenPaths.add(pluginPath);

        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          let manifest: any;
          try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            manifest = ManifestNormalizer.plugin(JSON.parse(manifestContent), pluginPath);

            // Normalize slug to lowercase early to avoid casing issues throughout the system
            if (manifest.slug) {
              manifest.slug = manifest.slug.toLowerCase();
            }

            // Validate manifest structure early
            const validation = manifestSchema.safeParse(manifest);
            if (!validation.success) {
              const errorMsg = `Manifest Validation Error: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
              this.logger.warn(`Invalid manifest for ${dir}: ${errorMsg}`);
              errored.push({
                manifest: manifest || { slug: dir },
                path: pluginPath,
                error: errorMsg
              });
              continue;
            }

            if (seenSlugs.has(manifest.slug)) {
              this.logger.debug(`Skipping duplicate plugin slug "${manifest.slug}" found at ${pluginPath}`);
              continue;
            }
            seenSlugs.add(manifest.slug);

            let mainFile = manifest.main || manifest.entry || 'index.js';
            let indexPath = path.join(pluginPath, mainFile);

            if (mainFile.endsWith('.js')) {
              const tsPath = indexPath.replace(/\.js$/, '.ts');
              if (!fs.existsSync(indexPath) && fs.existsSync(tsPath)) {
                indexPath = tsPath;
              }
            }

            if (fs.existsSync(indexPath)) {
              try {
                await this.dependencyInstaller.ensureInstalled(pluginPath);
                const savedPluginState = existingPlugins.get(manifest.slug as string);
                const persistedState = installedState[(manifest.slug as string).toLowerCase()];
                const hasPersistedSandboxConfig = persistedState && Object.prototype.hasOwnProperty.call(persistedState, 'sandboxConfig') && persistedState.sandboxConfig !== undefined;
                const savedSandboxConfig = hasPersistedSandboxConfig
                  ? persistedState.sandboxConfig
                  : savedPluginState?.manifest?.sandbox;
                const effectiveSandboxConfig = savedSandboxConfig !== undefined ? savedSandboxConfig : manifest.sandbox;
                const shouldSandbox = effectiveSandboxConfig !== false;

                // Default to sandbox enabled unless explicitly set to false.
                manifest.sandbox = effectiveSandboxConfig !== undefined ? effectiveSandboxConfig : true;

                // Always load plugin module so lifecycle hooks remain available.
                // Sandbox mode controls runtime isolation policy, not module metadata availability.
                const rawModule = await this.loadPluginModule(indexPath);
                const pluginModule = (rawModule && rawModule.default)
                  ? { ...rawModule.default, ...rawModule }
                  : rawModule;

                if (shouldSandbox) {
                  this.logger.info(`Staging sandboxed plugin: ${manifest.slug}`);
                  discovered.push({
                    plugin: {
                      manifest,
                      ...pluginModule,
                      isSandboxed: true,
                      entryPath: indexPath
                    },
                    path: pluginPath
                  });
                } else {
                  discovered.push({
                    plugin: { manifest, ...pluginModule },
                    path: pluginPath
                  });
                }
              } catch (err: any) {
                this.logger.warn(`Failed to load plugin module from ${dir}: ${err.message}`);
                errored.push({
                   manifest,
                   path: pluginPath,
                   error: err.message
                });
              }
            }
          } catch (err: any) {
            this.logger.warn(`Failed to stage plugin from ${dir}: ${err.message}`);
            if (manifest) {
              errored.push({
                manifest,
                path: pluginPath,
                error: err.message
              });
            }
          }
        }
      }
    }

    return { discovered, errored };
  }
}
