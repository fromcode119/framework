import fs from 'fs';
import path from 'path';
import { SystemConstants } from '../../constants';
import { ProjectPaths } from '../../config/paths';
import type { LoadedPlugin } from '../../types';
import { PluginContextFileReader } from './plugin-context-file-reader';
import type { PluginManagerInterface } from './utils.interfaces';

export class PluginPathContextProxy {
  private readonly fileReader: PluginContextFileReader;

  constructor(
    private readonly plugin: LoadedPlugin,
    private readonly manager: PluginManagerInterface,
  ) {
    this.fileReader = new PluginContextFileReader(
      () => this.resolveCurrentPluginRoot(),
      () => this.resolveActiveThemeRoot(),
    );
  }

  get frameworkRoot(): string {
    return ProjectPaths.getProjectRoot();
  }

  get pluginsRoot(): string {
    return ProjectPaths.getPluginsDir();
  }

  get themesRoot(): string {
    return ProjectPaths.getThemesDir();
  }

  get currentPluginRoot(): string {
    const explicitPath = String(this.plugin.path || '').trim();
    if (explicitPath) {
      return path.resolve(explicitPath);
    }

    const directPath = path.join(this.pluginsRoot, this.plugin.manifest.slug);
    if (this.isDirectory(directPath)) {
      return directPath;
    }

    return this.findThemePluginRoot(this.plugin.manifest.slug) || directPath;
  }

  resolveCurrentPluginRoot(): string {
    return this.currentPluginRoot;
  }

  async resolveActiveThemeSlug(): Promise<string | null> {
    const activeTheme = await this.manager.db.findOne(SystemConstants.TABLE.THEMES, { state: 'active' });
    const slug = String(activeTheme?.slug || '').trim();
    return slug || null;
  }

  async resolveActiveThemeRoot(): Promise<string | null> {
    const activeThemeSlug = await this.resolveActiveThemeSlug();
    if (!activeThemeSlug) {
      return null;
    }

    const directPath = path.join(this.themesRoot, activeThemeSlug);
    if (this.isDirectory(directPath)) {
      return directPath;
    }

    if (!this.isDirectory(this.themesRoot)) {
      return null;
    }

    for (const directoryName of fs.readdirSync(this.themesRoot)) {
      if (directoryName.startsWith('.')) {
        continue;
      }

      const themeDirectory = path.join(this.themesRoot, directoryName);
      if (!this.isDirectory(themeDirectory)) {
        continue;
      }

      const manifestSlug = this.readThemeSlug(themeDirectory);
      if (manifestSlug === activeThemeSlug) {
        return themeDirectory;
      }
    }

    return null;
  }

  async readCurrentPluginTemplate(relativePath: string): Promise<string> {
    return this.readCurrentPluginText(relativePath, {
      pluginDirectory: 'src/templates',
      themeDirectory: path.posix.join('src', 'templates', 'plugins', this.plugin.manifest.slug),
    });
  }

  async readCurrentPluginText(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<string> {
    return this.fileReader.readText(relativePath, options);
  }

  async readCurrentPluginJson(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<Record<string, any>> {
    return this.fileReader.readJson(relativePath, options);
  }

  private findThemePluginRoot(pluginSlug: string): string | null {
    if (!this.isDirectory(this.themesRoot)) {
      return null;
    }

    for (const themeDirectoryName of fs.readdirSync(this.themesRoot)) {
      if (themeDirectoryName.startsWith('.')) {
        continue;
      }

      const pluginsDirectory = path.join(this.themesRoot, themeDirectoryName, 'plugins');
      if (!this.isDirectory(pluginsDirectory)) {
        continue;
      }

      for (const pluginDirectoryName of fs.readdirSync(pluginsDirectory)) {
        if (pluginDirectoryName.startsWith('.')) {
          continue;
        }

        const pluginDirectory = path.join(pluginsDirectory, pluginDirectoryName);
        if (!this.isDirectory(pluginDirectory)) {
          continue;
        }

        if (pluginDirectoryName === pluginSlug) {
          return pluginDirectory;
        }

        const manifestPath = path.join(pluginDirectory, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          if (String(manifest?.slug || '').trim() === pluginSlug) {
            return pluginDirectory;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private readThemeSlug(themeDirectory: string): string | null {
    const manifestPath = path.join(themeDirectory, 'theme.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const slug = String(manifest?.slug || '').trim();
      return slug || null;
    } catch {
      return null;
    }
  }

  private isDirectory(candidatePath: string): boolean {
    try {
      return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory();
    } catch {
      return false;
    }
  }
}
