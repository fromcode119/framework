import fs from 'fs';
import path from 'path';
import semver from 'semver';
import AdmZip from 'adm-zip';
import { Logger } from '../../logging/logger';
import { FromcodePlugin, LoadedPlugin, PluginManifest } from '../../types';
import { BackupService } from '../../management/backup';

export class DiscoveryService {
  private logger = new Logger({ namespace: 'DiscoveryService' });

  constructor(private pluginsRoot: string, private projectRoot: string) {}

  public discoverPlugins(existingPlugins: Map<string, LoadedPlugin>): { plugin: any, path: string }[] {
    this.logger.info(`Scanning for plugins in ${this.pluginsRoot}...`);
    const roots = [this.pluginsRoot];
    
    const themesDir = path.resolve(this.projectRoot, 'themes');
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

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const pluginDirs = fs.readdirSync(root);
      
      for (const dir of pluginDirs) {
        if (dir.startsWith('.')) continue;

        const pluginPath = path.join(root, dir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;

        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);

            let mainFile = manifest.main || 'index.js';
            let indexPath = path.join(pluginPath, mainFile);
            
            if (!fs.existsSync(indexPath) && mainFile.endsWith('.js')) {
              const tsPath = indexPath.replace(/\.js$/, '.ts');
              if (fs.existsSync(tsPath)) {
                indexPath = tsPath;
              }
            }

            if (fs.existsSync(indexPath)) {
              try {
                  const resolved = require.resolve(indexPath);
                  if (require.cache[resolved]) delete require.cache[resolved];
              } catch (e) {}

              const pluginModule = require(indexPath);
              discovered.push({
                plugin: { manifest, ...pluginModule },
                path: pluginPath
              });
            }
          } catch (err: any) {
            this.logger.warn(`Failed to stage plugin from ${dir}: ${err.message}`);
          }
        }
      }
    }

    return discovered;
  }

  public resolveDependencies(plugins: FromcodePlugin[]): FromcodePlugin[] {
    const adj: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();
    const pluginMap: Map<string, FromcodePlugin> = new Map();

    plugins.forEach(p => {
      pluginMap.set(p.manifest.slug, p);
      if (!adj.has(p.manifest.slug)) adj.set(p.manifest.slug, []);
      if (!inDegree.has(p.manifest.slug)) inDegree.set(p.manifest.slug, 0);
    });

    plugins.forEach(p => {
      if (p.manifest.dependencies) {
        Object.keys(p.manifest.dependencies).forEach(depSlug => {
          if (pluginMap.has(depSlug)) {
            adj.get(depSlug)!.push(p.manifest.slug);
            inDegree.set(p.manifest.slug, (inDegree.get(p.manifest.slug) || 0) + 1);
          }
        });
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, slug) => {
      if (degree === 0) queue.push(slug);
    });

    const result: FromcodePlugin[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      result.push(pluginMap.get(u)!);

      adj.get(u)?.forEach(v => {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      });
    }

    if (result.length !== plugins.length) {
      const cycleNodes = Array.from(inDegree.keys()).filter(slug => inDegree.get(slug)! > 0);
      throw new Error(`Circular dependency detected involving plugins: ${cycleNodes.join(', ')}`);
    }

    return result;
  }

  public validateDependencies(manifest: PluginManifest, plugins: Map<string, LoadedPlugin>): void {
    if (!manifest.dependencies) return;

    for (const [depSlug, versionRange] of Object.entries(manifest.dependencies)) {
      const dependency = plugins.get(depSlug);
      
      if (!dependency) {
        throw new Error(`Missing dependency: Plugin "${manifest.slug}" requires "${depSlug}" (${versionRange})`);
      }

      if (!semver.satisfies(dependency.manifest.version, versionRange)) {
        throw new Error(`Incompatible dependency: Plugin "${manifest.slug}" requires "${depSlug}" version "${versionRange}", but version "${dependency.manifest.version}" is installed.`);
      }
    }
  }

  public findManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = this.findManifestDir(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  public moveDir(src: string, dest: string) {
    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      
      if (fs.statSync(srcFile).isDirectory()) {
        if (!fs.existsSync(destFile)) fs.mkdirSync(destFile, { recursive: true });
        this.moveDir(srcFile, destFile);
      } else {
        try {
          fs.renameSync(srcFile, destFile);
        } catch (e) {
          fs.copyFileSync(srcFile, destFile);
          fs.unlinkSync(srcFile);
        }
      }
    }
  }

  async installFromZip(filePath: string): Promise<void> {
    const tempDir = path.join(path.dirname(filePath), `ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (filePath.endsWith('.zip')) {
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);
      } else {
        await BackupService.restore(filePath, tempDir);
      }

      const contentDir = this.findManifestDir(tempDir);
      if (!contentDir) {
        throw new Error('Invalid plugin: manifest.json not found anywhere in the archive.');
      }

      const manifestContent = fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestContent);
      const targetDir = path.join(this.pluginsRoot, manifest.slug);

      if (fs.existsSync(targetDir)) {
          await BackupService.create(manifest.slug, targetDir, 'plugins');
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      
      this.moveDir(contentDir, targetDir);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }
}
