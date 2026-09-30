import fs from 'fs';
import path from 'path';
import { Logger } from '@core/logging';
import { ProjectPaths } from '@core/config/paths';
import { PluginModuleLoader } from '@core/plugin/services/installation/plugin-module-loader';
import type { IPluginScanRoots } from '@core/plugin/services/interfaces/plugin-scan-roots.interface';

/** Every directory a discovery pass reads plugins from, and what each means: the framework's bundled root, or one site's. */
export class PluginScanRoots {
  static collect(pluginsRoot: string, logger: Logger): IPluginScanRoots {
    // The framework's OWN extensions ship in the image under a second root. The MOUNTED root is
    // scanned first so a developer editing the source tree still sees their changes — on a
    // deployment that root is empty, so the bundled copy is what loads. Either way the slug is
    // marked bundled, which is what makes it always-on and unremovable.
    const bundledRoot = ProjectPaths.getBundledPluginsDir();
    const bundledSlugs = PluginModuleLoader.listDirectoryNames(bundledRoot);
    const roots = [pluginsRoot, bundledRoot];

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
    const tenantPluginsRoot = ProjectPaths.tenantArtifactsRoot(pluginsRoot);
    if (fs.existsSync(tenantPluginsRoot)) {
      let tenantIds: string[] = [];
      try {
        tenantIds = fs.readdirSync(tenantPluginsRoot);
      } catch (e) {
        logger.error(`Could not read ${tenantPluginsRoot}; no site's own plugins were discovered.`, e);
        tenantIds = [];
      }
      for (const tenantId of tenantIds) {
        if (tenantId.startsWith('.')) continue;
        const tenantRoot = path.join(tenantPluginsRoot, tenantId);
        try {
          if (!fs.statSync(tenantRoot).isDirectory()) continue;
        } catch (e) {
          logger.error(
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

    return { bundledRoot, bundledSlugs, roots, rootOwners };
  }
}
