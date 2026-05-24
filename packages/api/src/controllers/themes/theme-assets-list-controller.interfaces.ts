export interface ThemeAssetEntry {
  filename: string;
  relativePath: string;
  mimeType: string;
  url: string;
}

export interface ThemeAssetsListResponse {
  themeSlug: string | null;
  assets: ThemeAssetEntry[];
}
