/** What a site may upload, as the platform set it (Settings), and how many themes it holds now. */
export interface IInstalledThemesSiteQuota {
  maxBytes: number;
  maxThemes: number;
  themes: number;
}
