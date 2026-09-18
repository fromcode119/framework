import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Logger } from '@core/logging';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { ProjectPaths } from '@core/config/paths';
import { InstalledPluginManifestService } from '@core/plugin/services/installation/installed-plugin-manifest-service';
import { PluginDependencyInstallerService } from '@core/plugin/services/installation/plugin-dependency-installer-service';
import { PluginModuleResolverService } from '@core/plugin/services/installation/plugin-module-resolver-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';
import { PluginModuleLoader } from '@core/plugin/services/installation/plugin-module-loader';

/**
 * PluginDirectoryScannerService
 *
 * Scans the plugins root (and theme-local plugin dirs) on disk, validates each
 * manifest, loads the plugin module (with CJS/ESM fallback), and stages it.
 * Extracted from DiscoveryService to keep that class under the size limit;
 * DiscoveryService delegates discoverPlugins() to this service unchanged.
 */
export class PluginDirectoryScannerService {
  private static readonly manifestSchema = z.object({
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

  private readonly moduleLoader: PluginModuleLoader;

  constructor(
    private pluginsRoot: string,
    private projectRoot: string,
    private logger: Logger,
    private dependencyInstaller: PluginDependencyInstallerService,
    /** T5: when present, isolated plugins are DESCRIBED by their own process instead of required here. */
    private hosts: { isIsolated(sandbox: unknown): Promise<boolean>; describe(slug: string, dir: string, entry: string, manifest: Record<string, unknown>, active: boolean): Promise<Record<string, unknown>> } | null = null,
  ) {
    this.moduleLoader = new PluginModuleLoader(projectRoot);
    this.moduleLoader.ensureSharedModuleResolution();
  }

  /** @see PluginModuleLoader.loadPluginModule */
  loadPluginModule(...args: Parameters<PluginModuleLoader["loadPluginModule"]>): ReturnType<PluginModuleLoader["loadPluginModule"]> {
    return this.moduleLoader.loadPluginModule(...args);
  }

  public async discoverPlugins(
    existingPlugins: Map<string, ILoadedPlugin>,
    installedState: Record<string, { sandboxConfig?: any; state?: unknown }> = {}
  ): Promise<{
    discovered: { plugin: any, path: string }[],
    errored: { manifest: any, path: string, error: string }[]
  }> {
    this.logger.info(`Scanning for plugins in ${this.pluginsRoot}...`);
    // The framework's OWN extensions ship in the image under a second root. The MOUNTED root is
    // scanned first so a developer editing the source tree still sees their changes — on a
    // deployment that root is empty, so the bundled copy is what loads. Either way the slug is
    // marked bundled, which is what makes it always-on and unremovable.
    const bundledRoot = ProjectPaths.getBundledPluginsDir();
    const bundledSlugs = PluginModuleLoader.listDirectoryNames(bundledRoot);
    const roots = [this.pluginsRoot, bundledRoot];

    const themesDir = ProjectPaths.getThemesDir();
    if (fs.existsSync(themesDir)) {
      const themes = fs.readdirSync(themesDir);
      for (const themeSlug of themes) {
        // `tenants/` under the themes root holds SITES' themes, not a theme called "tenants". A site's
        // theme may not carry plugins at all — a bundled plugin is code, and shipping code is not
        // something an upload does — so this walk deliberately stops at the platform's own themes.
        if (ProjectPaths.isTenantArtifactsDir(themeSlug)) continue;
        const themePluginsPath = path.join(themesDir, themeSlug, 'plugins');
        if (fs.existsSync(themePluginsPath) && fs.statSync(themePluginsPath).isDirectory()) {
          roots.push(themePluginsPath);
        }
      }
    }

    // Each site's own uploaded plugins, one root per site. Tagged by the DIRECTORY they were found
    // in — a manifest cannot name its own owner, or an uploaded plugin would claim to be the
    // platform's and be offered to every site.
    //
    // ONE SITE'S BAD DIRECTORY MUST NOT COST EVERY OTHER SITE ITS PLUGINS. These entries are written
    // by upload rather than curated, so a dangling symlink or an unreadable mode will throw from
    // `statSync`/`readdirSync` — and an unguarded throw here aborts discovery for the whole platform.
    // Each site is inspected inside its own try; one that cannot be read is skipped, not fatal.
    const rootOwners = new Map<string, string>();
    const tenantPluginsRoot = ProjectPaths.tenantArtifactsRoot(this.pluginsRoot);
    if (fs.existsSync(tenantPluginsRoot)) {
      let tenantIds: string[] = [];
      try {
        tenantIds = fs.readdirSync(tenantPluginsRoot);
      } catch (e) {
        this.logger.error(`Could not read ${tenantPluginsRoot}; no site's own plugins were discovered.`, e);
        tenantIds = [];
      }
      for (const tenantId of tenantIds) {
        if (tenantId.startsWith('.')) continue;
        const tenantRoot = path.join(tenantPluginsRoot, tenantId);
        try {
          if (!fs.statSync(tenantRoot).isDirectory()) continue;
        } catch (e) {
          this.logger.error(
            `Could not read the plugins of site "${tenantId}" at ${tenantRoot}. That site has none of `
            + 'its own until this is fixed; every other site is unaffected.',
            e,
          );
          continue;
        }
        rootOwners.set(tenantRoot, tenantId);
        roots.push(tenantRoot);
      }
    }

    const discovered: { plugin: any, path: string }[] = [];
    const errored: { manifest: any, path: string, error: string }[] = [];
    const seenSlugs = new Set<string>();
    const seenPaths = new Set<string>();

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const isBundledRoot = root === bundledRoot;
      const rootOwnerTenantId = rootOwners.get(root);
      // Guarded because a SITE's root now feeds this loop, and those are written by upload rather than
      // curated. A throw here would end discovery for every root still queued behind it.
      let pluginDirs: string[] = [];
      try {
        pluginDirs = fs.readdirSync(root);
      } catch (e) {
        this.logger.error(`Could not read plugin root ${root}; skipping it. Other roots are unaffected.`, e);
        continue;
      }

      for (const dir of pluginDirs) {
        if (dir.startsWith('.')) continue;
        // The `tenants/` level itself is a container of sites, never a plugin.
        if (root === this.pluginsRoot && ProjectPaths.isTenantArtifactsDir(dir)) continue;
        if (dir.startsWith('ext-') || dir.startsWith('fromcode-plugin-ext-')) continue;

        const pluginPath = path.join(root, dir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;
        if (seenPaths.has(pluginPath)) continue;
        seenPaths.add(pluginPath);

        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          let manifest: any;
          try {
            // Read + normalize (category default, version fallback, lowercased slug, stamped
            // ownerTenantId) the same way a hot install/update finalizes one — see
            // InstalledPluginManifestService for why the two must not diverge.
            manifest = InstalledPluginManifestService.read(pluginPath, rootOwnerTenantId);

            // Fill the build-output paths (server entry, UI bundles, migrations dir) from the package
            // layout so a manifest never has to restate what the build already decided. Anything the
            // manifest declares explicitly is left untouched.
            PluginPackageLayout.resolve(pluginPath, manifest);

            // Validate manifest structure early
            const validation = PluginDirectoryScannerService.manifestSchema.safeParse(manifest);
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

            let mainFile = manifest.main || manifest.entry || PluginPackageLayout.SERVER_ENTRY;
            let indexPath = path.join(pluginPath, mainFile);

            if (mainFile.endsWith('.js')) {
              const tsPath = indexPath.replace(/\.js$/, '.ts');
              if (!fs.existsSync(indexPath) && fs.existsSync(tsPath)) {
                indexPath = tsPath;
              }
            }

            if (fs.existsSync(indexPath)) {
              try {
                /**
                 * A bundled extension arrives with its dependencies already inside the image, so
                 * there is nothing to install and nowhere to install it: the image directory is not
                 * writable by the runtime user, and npm's cache is not either. Attempting it failed
                 * the extension outright — first `EACCES /root/.npm`, then `EACCES rmdir
                 * node_modules/.bin` once the image carried them.
                 */
                if (!isBundledRoot) await this.dependencyInstaller.ensureInstalled(pluginPath);
                const savedPluginState = existingPlugins.get(manifest.slug as string);
                const persistedState = installedState[(manifest.slug as string).toLowerCase()];
                const effectiveSandboxConfig = InstalledPluginManifestService.applyPersistedSandbox(
                  manifest,
                  persistedState,
                  savedPluginState?.manifest?.sandbox,
                );

                // T5: an ISOLATED plugin is never required into this process. Its own process loads it
                // and reports which lifecycle hooks and public-API functions it has; what is staged
                // here is a set of forwarding stubs. `shouldSandbox` is therefore a real statement
                // about where the code runs, which the admin's counters report.
                const shouldSandbox = !!this.hosts && await this.hosts.isIsolated(effectiveSandboxConfig);
                const pluginModule = shouldSandbox
                  ? await this.hosts!.describe(String(manifest.slug), pluginPath, indexPath, manifest as Record<string, unknown>, String(persistedState?.state ?? '') === PluginState.ACTIVE.value)
                  : PluginModuleResolverService.resolve(await this.loadPluginModule(indexPath));

                // An inline-manifest plugin (a `static manifest` on the entry class) REPLACES the disk
                // manifest in the spread below, so the layout resolved above would be dropped. Resolve
                // against whichever manifest actually wins; resolve() only fills absent values, so
                // running it again over the disk manifest is a no-op.
                const effectiveManifest = PluginPackageLayout.resolve(pluginPath, pluginModule.manifest || manifest);
                // Bundled extensions are part of the product: always on, never uninstallable, and
                // not subject to the operator's saved state — the admin refuses to disable them.
                if (bundledSlugs.has(String(effectiveManifest.slug || '').toLowerCase())) {
                  effectiveManifest.bundled = true;
                  effectiveManifest.sandbox = false;
                }

                if (shouldSandbox) {
                  this.logger.info(`Staging sandboxed plugin: ${manifest.slug}`);
                  discovered.push({
                    plugin: {
                      ...pluginModule,
                      manifest: effectiveManifest,
                      isSandboxed: true,
                      entryPath: indexPath
                    },
                    path: pluginPath
                  });
                } else {
                  discovered.push({
                    plugin: { ...pluginModule, manifest: effectiveManifest },
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
            } else {
              /**
               * A manifest with nothing behind it. This used to fall through in silence, and that
               * silence shipped: a bundled extension whose build output had been dropped from the
               * commit left a manifest and a package.json in the image, loaded nothing, and reported
               * nothing — the screen was simply absent from the admin with no error anywhere.
               */
              const errorMsg = `Entry file not found: ${path.relative(pluginPath, indexPath)}`;
              this.logger.warn(`Plugin "${manifest.slug}" at ${pluginPath} was not loaded — ${errorMsg}`);
              errored.push({ manifest, path: pluginPath, error: errorMsg });
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
