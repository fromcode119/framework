/** One page of `_system_redirects`, newest first, with how many rules match in total. */
export interface RedirectListPage {
  redirects: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}
