import fs from 'fs';
import path from 'path';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import type { IThemeManifest } from '@core/interfaces/theme-manifest.interface';
import type { IPluginManifestInput } from '@core/interfaces/plugin-manifest-input.interface';
import type { IThemeManifestInput } from '@core/interfaces/theme-manifest-input.interface';

export class ManifestNormalizer {
  static plugin(input: IPluginManifestInput, basePath?: string): IPluginManifest {
    const version = input.version ?? ManifestNormalizer.readPackageVersion(basePath) ?? '1.0.0';
    return {
      category: 'general',
      ...input,
      version,
    } as IPluginManifest;
  }

  static theme(input: IThemeManifestInput, basePath?: string): IThemeManifest {
    const version = input.version ?? ManifestNormalizer.readPackageVersion(basePath) ?? '1.0.0';
    return {
      layouts: [],
      ...input,
      version,
    } as IThemeManifest;
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
