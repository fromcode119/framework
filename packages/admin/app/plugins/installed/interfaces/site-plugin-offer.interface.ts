/** A plugin the platform offers to sites, as a site sees it. */
export interface ISitePluginOffer {
  slug: string;
  name: string;
  description: string;
  version: string;
  /** Whether it is on for THIS site. */
  enabledHere: boolean;
}
