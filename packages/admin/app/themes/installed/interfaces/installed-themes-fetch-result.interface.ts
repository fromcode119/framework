

import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';

export interface IInstalledThemesFetchResult {
  themes: IInstalledThemeManifest[];
  marketplaceThemes: IInstalledThemeManifest[];
}
