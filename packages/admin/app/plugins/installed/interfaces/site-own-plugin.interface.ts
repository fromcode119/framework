import type { ISitePluginOffer } from '@/app/plugins/installed/interfaces/site-plugin-offer.interface';

/** A plugin this site uploaded itself. */
export interface ISiteOwnPlugin extends ISitePluginOffer {
  /** Loaded and running on the server; a plugin that failed to start cannot be switched on. */
  running: boolean;
  /** Why it is not running, when the server stopped it (a crash loop, a resource limit); '' otherwise. */
  error: string;
  /** Placed, but waiting for this site's admin to approve what it asks for. */
  needsApproval: boolean;
}
