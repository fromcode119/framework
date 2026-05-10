import fs from 'fs';
import path from 'path';
import type { PluginManifest, ThemeManifest } from './types/manifests.interfaces';
import type { PluginManifestInput, ThemeManifestInput } from './manifest-normalizer.types';

export class ManifestNormalizer {
  static plugin(input: PluginManifestInput, basePath?: string): PluginManifest {
    const version = input.version ?? ManifestNormalizer.readPackageVersion(basePath) ?? '1.0.0';
    return {
      category: 'general',
      ...input,
      version,
    } as PluginManifest;
  }

  static theme(input: ThemeManifestInput, basePath?: string): ThemeManifest {
    const version = input.version ?? ManifestNormalizer.readPackageVersion(basePath) ?? '1.0.0';
    return {
      layouts: [],
      ...input,
      version,
    } as ThemeManifest;
  }

  private static readPackageVersion(basePath?: string): string | undefined {
    if (!basePath) return undefined;
    try {
      const pkgPath = path.join(basePath, 'package.json');
      if (!fs.existsSync(pkgPath)) return undefined;
      return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string | undefined;
    } catch {
      return undefined;
    }
  }
}
