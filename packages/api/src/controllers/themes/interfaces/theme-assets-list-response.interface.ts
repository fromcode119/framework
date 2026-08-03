import type { IThemeAssetEntry } from '@api/controllers/themes/interfaces/theme-asset-entry.interface';

export interface IThemeAssetsListResponse {
  themeSlug: string | null;
  assets: IThemeAssetEntry[];
}
