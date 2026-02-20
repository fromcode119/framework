import fs from 'fs';
import path from 'path';
import semver from 'semver';
import AdmZip from 'adm-zip';
import { Logger } from '../../logging/logger';
import { FromcodePlugin, LoadedPlugin, PluginManifest } from '../../types';
import { BackupService } from '../../management/backup-service';
import { z } from 'zod';
import { pathToFileURL } from 'url';

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

export interface DependencyIssue {
  slug: string;
  expected: string;
  actual?: string;
  type: 'missing' | 'incompatible' | 'inactive';
}

export class DiscoveryService {
  private logger = new Logger({ namespace: 'discovery-service' });

  constructor(private pluginsRoot: string, private projectRoot: string) {}

  public async discoverPlugins(
    existingPlugins: Map<string, LoadedPlugin>,
    installedState: Record<string, { sandboxConfig?: any }> = {}
  ): Promise<{ 
    discovered: { plugin: any, path: string }[], 
    errored: { manifest: any, path: string, error: string }[] 
  }> {
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
    const errored: { manifest: any, path: string, error: string }[] = [];
    const seenSlugs = new Set<string>();
    const seenPaths = new Set<string>();

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const pluginDirs = fs.readdirSync(root);
      
      for (const dir of pluginDirs) {
        if (dir.startsWith('.')) continue;

        const pluginPath = path.join(root, dir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;
        if (seenPaths.has(pluginPath)) continue;
        seenPaths.add(pluginPath);

        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          let manifest: any;
          try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            manifest = JSON.parse(manifestContent);
            
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
            
            if (!fs.existsSync(indexPath) && mainFile.endsWith('.js')) {
              const tsPath = indexPath.replace(/\.js$/, '.ts');
              if (fs.existsSync(tsPath)) {
                indexPath = tsPath;
              }
            }

            if (fs.existsSync(indexPath)) {
              try {
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
                const fileUrl = pathToFileURL(indexPath).href;
                const rawModule = await import(fileUrl);
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
          } else {
            // Log missing dependency but don't block sorting here
            // validation should happen elsewhere or we can throw here
            this.logger.warn(`Plugin "${p.manifest.slug}" depends on "${depSlug}" but it's not installed.`);
          }
        });
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, slug) => {
      if (degree === 0) queue.push(slug);
    });

    const result: FromcodePlugin[] = [];
    const processed = new Set<string>();

    while (queue.length > 0) {
      const u = queue.shift()!;
      result.push(pluginMap.get(u)!);
      processed.add(u);

      adj.get(u)?.forEach(v => {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      });
    }

    if (result.length !== plugins.length) {
      const missing = plugins.filter(p => !processed.has(p.manifest.slug));
      const cycleNodes = missing.map(p => p.manifest.slug);
      
      // Check if it's really a cycle or just missing dependencies
      const realMissingDeps = new Set<string>();
      cycleNodes.forEach(slug => {
         const p = pluginMap.get(slug);
         if (p?.manifest.dependencies) {
            Object.keys(p.manifest.dependencies).forEach(dep => {
               if (!pluginMap.has(dep)) realMissingDeps.add(dep);
            });
         }
      });

      if (realMissingDeps.size > 0) {
         throw new Error(`Missing dependencies detected: ${Array.from(realMissingDeps).join(', ')}. Please install them.`);
      }

      throw new Error(`Circular dependency detected involving plugins: ${cycleNodes.join(', ')}`);
    }

    return result;
  }

  public checkDependencies(manifest: PluginManifest, plugins: Map<string, LoadedPlugin>, options: { checkActive?: boolean } = {}): DependencyIssue[] {
    const issues: DependencyIssue[] = [];
    if (!manifest.dependencies) return issues;

    for (const [depSlug, versionRange] of Object.entries(manifest.dependencies)) {
      const dependency = plugins.get(depSlug);
      
      if (!dependency) {
        issues.push({ slug: depSlug, expected: versionRange, type: 'missing' });
        continue;
      }

      if (!semver.satisfies(dependency.manifest.version, versionRange)) {
        issues.push({ slug: depSlug, expected: versionRange, actual: dependency.manifest.version, type: 'incompatible' });
        continue;
      }

      if (options.checkActive && dependency.state !== 'active') {
        issues.push({ slug: depSlug, expected: versionRange, type: 'inactive' });
      }
    }
    return issues;
  }

  public validateDependencies(manifest: PluginManifest, plugins: Map<string, LoadedPlugin>): void {
    const issues = this.checkDependencies(manifest, plugins);
    if (issues.length > 0) {
      const issue = issues[0];
      if (issue.type === 'missing') {
        throw new Error(`Missing dependency: Plugin "${manifest.slug}" requires "${issue.slug}" (${issue.expected})`);
      } else if (issue.type === 'incompatible') {
        throw new Error(`Incompatible dependency: Plugin "${manifest.slug}" requires "${issue.slug}" version "${issue.expected}", but version "${issue.actual}" is installed.`);
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

  async installFromZip(filePath: string): Promise<PluginManifest> {
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
      const manifest: PluginManifest = JSON.parse(manifestContent);
      const targetDir = path.join(this.pluginsRoot, manifest.slug);

      if (fs.existsSync(targetDir)) {
          await BackupService.create(manifest.slug, targetDir, 'plugins');
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      
      this.moveDir(contentDir, targetDir);
      return manifest;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }
}
