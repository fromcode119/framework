import type { PluginManifest, ThemeManifest } from './types/manifests.interfaces';
import type { PluginManifestInput, ThemeManifestInput } from './manifest-normalizer.types';

export class ManifestNormalizer {
  static plugin(input: PluginManifestInput): PluginManifest {
    return {
      version: '1.0.0',
      category: 'general',
      ...input,
    } as PluginManifest;
  }

  static theme(input: ThemeManifestInput): ThemeManifest {
    return {
      version: '1.0.0',
      layouts: [],
      ui: { entry: 'dist/index.js' },
      ...input,
    } as ThemeManifest;
  }
}
