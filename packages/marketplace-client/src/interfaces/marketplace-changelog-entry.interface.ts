/** One changelog entry for a marketplace listing. */
export interface IMarketplaceChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}
