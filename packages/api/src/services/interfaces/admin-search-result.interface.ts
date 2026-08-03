export interface IAdminSearchResult {
  /** Result group label shown in the palette (collection name, "Users", "People"). */
  group: string;
  /** Physical collection slug (`fcp_...`) or the system source (`users` / `people`). */
  source: string;
  pluginSlug: string;
  id: number | string;
  label: string;
  sublabel: string;
}
