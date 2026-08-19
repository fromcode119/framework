/**
 * The framework-owned head-data contract: what a head-data provider plugin (manifest
 * `ui.headDataPath`) returns for a resolved URL. Web-standard head vocabulary only —
 * title/description, canonical, robots, Open Graph, Twitter card.
 */
export interface IHeadData {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  siteName: string;
  siteUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  twitterHandle: string;
}
