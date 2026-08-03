import type { IThemeManifest } from '@core/interfaces/theme-manifest.interface';

/** A theme manifest as an AUTHOR writes it: `version` and `layouts` are optional at authoring time. */
export interface IThemeManifestInput extends Omit<IThemeManifest, 'version' | 'layouts'> {
  version?: string;
  layouts?: IThemeManifest['layouts'];
}
