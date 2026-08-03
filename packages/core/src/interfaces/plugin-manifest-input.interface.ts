import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';

/**
 * A plugin manifest as an AUTHOR writes it: `version` and `category` are filled in by the loader, so both
 * are optional here.
 *
 * An `interface extends Omit<…>` rather than an `Omit<…> & { … }` type alias — an interface may extend a
 * mapped type, which keeps this a declaration.
 */
export interface IPluginManifestInput extends Omit<IPluginManifest, 'version' | 'category'> {
  version?: string;
  category?: string;
}
