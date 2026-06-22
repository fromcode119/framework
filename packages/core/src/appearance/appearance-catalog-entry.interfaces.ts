/**
 * A marketplace appearance merged with local install state — powers the Settings → Appearance
 * "available to install" list and the per-appearance "update available" badge.
 */
export interface AppearanceCatalogEntry {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl?: string;
  /** True when this slug is already installed in the appearances dir. */
  installed: boolean;
  /** The locally installed version (empty when not installed). */
  installedVersion: string;
  /** True when the catalog version is newer than the installed version. */
  updateAvailable: boolean;
}
