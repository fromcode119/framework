import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { Logger } from '../../logging';
import { FromcodePlugin, LoadedPlugin, PluginManifest } from '../../types';

import type { DependencyIssue } from './discovery-service.interfaces';
import { PluginDependencyInstallerService } from './plugin-dependency-installer-service';
import { PluginArchiveInstallerService } from './plugin-archive-installer-service';
import { PluginDirectoryScannerService } from './plugin-directory-scanner-service';

export class DiscoveryService {
  private logger = new Logger({ namespace: 'discovery-service' });
  private dependencyInstaller: PluginDependencyInstallerService;
  private archiveInstaller: PluginArchiveInstallerService;
  private scanner: PluginDirectoryScannerService;

  constructor(private pluginsRoot: string, private projectRoot: string) {
    this.dependencyInstaller = new PluginDependencyInstallerService(projectRoot);
    this.archiveInstaller = new PluginArchiveInstallerService(pluginsRoot, this.dependencyInstaller);
    this.scanner = new PluginDirectoryScannerService(pluginsRoot, projectRoot, this.logger, this.dependencyInstaller);
  }

  public async discoverPlugins(
    existingPlugins: Map<string, LoadedPlugin>,
    installedState: Record<string, { sandboxConfig?: any }> = {}
  ): Promise<{
    discovered: { plugin: any, path: string }[],
    errored: { manifest: any, path: string, error: string }[]
  }> {
    return this.scanner.discoverPlugins(existingPlugins, installedState);
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
    return this.archiveInstaller.findManifestDir(dir);
  }

  public moveDir(src: string, dest: string) {
    this.archiveInstaller.moveDir(src, dest);
  }

  async installFromZip(filePath: string): Promise<PluginManifest> {
    return this.archiveInstaller.installFromZip(filePath);
  }
}
