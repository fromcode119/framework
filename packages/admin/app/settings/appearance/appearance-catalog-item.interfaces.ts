/** A marketplace appearance row (mirrors the API's AppearanceCatalogEntry, minus the download URL). */
export interface AppearanceCatalogItem {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
  installedVersion: string;
  updateAvailable: boolean;
}
