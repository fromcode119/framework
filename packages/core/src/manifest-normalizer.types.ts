import type { PluginManifest, ThemeManifest } from './types/manifests.interfaces';

export type PluginManifestInput = Omit<PluginManifest, 'version' | 'category'> & {
  version?: string;
  category?: string;
};

export type ThemeManifestInput = Omit<ThemeManifest, 'version' | 'layouts'> & {
  version?: string;
  layouts?: ThemeManifest['layouts'];
};
