import fs from 'fs-extra';
import path from 'path';
import { PluginDependencyInstallerService, ProjectPaths } from '@fromcode119/core';

export class PluginDependencyCommandService {
  private installer = new PluginDependencyInstallerService(ProjectPaths.getProjectRoot());

  async installAll(): Promise<number> {
    const pluginDirs = this.collectPluginDirs();
    let installedCount = 0;

    for (const pluginDir of pluginDirs) {
      if (!this.installer.hasPackageManifest(pluginDir)) {
        continue;
      }

      await this.installer.ensureInstalled(pluginDir);
      installedCount += 1;
    }

    return installedCount;
  }

  async installForSlug(slug: string): Promise<string> {
    const pluginDir = this.findPluginDir(slug);
    if (!pluginDir) {
      throw new Error(`Plugin directory not found for slug: ${slug}`);
    }

    await this.installer.ensureInstalled(pluginDir);
    return pluginDir;
  }

  async getBackendExternalModules(pluginDir: string): Promise<string[]> {
    const pkgPath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return [];
    }

    const pkg = await fs.readJson(pkgPath);
    return [
      ...Object.keys(pkg?.dependencies || {}),
      ...Object.keys(pkg?.peerDependencies || {}),
    ];
  }

  private findPluginDir(slug: string): string {
    return this.collectPluginDirs().find((pluginDir) => path.basename(pluginDir) === slug) || '';
  }

  private collectPluginDirs(): string[] {
    const dirs: string[] = [];
    const pluginsDir = ProjectPaths.getPluginsDir();
    const themesDir = ProjectPaths.getThemesDir();

    if (fs.existsSync(pluginsDir)) {
      dirs.push(...this.collectChildPluginDirs(pluginsDir));
    }

    if (fs.existsSync(themesDir)) {
      const themes = fs.readdirSync(themesDir);
      for (const themeSlug of themes) {
        const themePluginsDir = path.join(themesDir, themeSlug, 'plugins');
        if (!fs.existsSync(themePluginsDir)) {
          continue;
        }

        dirs.push(...this.collectChildPluginDirs(themePluginsDir));
      }
    }

    return Array.from(new Set(dirs));
  }

  private collectChildPluginDirs(rootDir: string): string[] {
    return fs.readdirSync(rootDir)
      .map((entry) => path.join(rootDir, entry))
      .filter((entryPath) => fs.existsSync(path.join(entryPath, 'manifest.json')));
  }
}
