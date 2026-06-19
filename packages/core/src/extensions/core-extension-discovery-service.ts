import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../logging';
import { CoreExtensionManifest, LoadedCoreExtension } from './types';

/**
 * CoreExtensionDiscoveryService
 *
 * Scans the packages directory for `core-extension` manifests and returns the
 * discovered extensions. Extracted from CoreExtensionManager to keep that class
 * under the size limit; the manager merges the result into its own map and keeps
 * the public discover() entry point.
 */
export class CoreExtensionDiscoveryService {
  constructor(private logger: Logger) {}

  /**
   * Discover core extensions from the given packages directory.
   * Returns the resolved packages root (it may be re-resolved if missing) and
   * the discovered extensions keyed by slug.
   */
  public async discover(packagesRoot: string): Promise<{
    packagesRoot: string;
    extensions: Map<string, LoadedCoreExtension>;
  }> {
    const extensions = new Map<string, LoadedCoreExtension>();
    let resolvedRoot = packagesRoot;

    // Verify packages directory exists, if not try to fix it
    if (!fs.existsSync(resolvedRoot)) {
      this.logger.warn(`Packages directory not found at ${resolvedRoot}, attempting to locate...`);
      // Re-import ProjectPaths to get fresh path resolution
      const { ProjectPaths } = await import('../config/paths');
      resolvedRoot = ProjectPaths.getPackagesDir();
    }

    // If still not found, log a warning and exit discovery gracefully
    if (!fs.existsSync(resolvedRoot)) {
      this.logger.warn(`Packages directory not found at ${resolvedRoot}. Skipping core extension discovery.`);
      this.logger.info(`Discovered 0 core extensions`);
      return { packagesRoot: resolvedRoot, extensions };
    }

    this.logger.info(`Using packages directory: ${resolvedRoot}`);

    // Scan packages directory for manifest.json files
    const packageDirs = fs.readdirSync(resolvedRoot, { withFileTypes: true });

    for (const dir of packageDirs) {
      if (!dir.isDirectory()) continue;

      const manifestPath = path.join(resolvedRoot, dir.name, 'manifest.json');

      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest: CoreExtensionManifest = JSON.parse(manifestContent);

        // Only process core extensions (skip plugins, themes, etc.)
        if (manifest.type !== 'core-extension') continue;

        const extension: LoadedCoreExtension = {
          manifest,
          path: path.join(resolvedRoot, dir.name),
          state: 'discovered',
        };

        extensions.set(manifest.slug, extension);
        this.logger.info(`Discovered core extension: ${manifest.slug}`);

      } catch (error) {
        this.logger.error(`Failed to load manifest for ${dir.name}:`, error);
      }
    }

    this.logger.info(`Discovered ${extensions.size} core extensions`);
    return { packagesRoot: resolvedRoot, extensions };
  }
}
