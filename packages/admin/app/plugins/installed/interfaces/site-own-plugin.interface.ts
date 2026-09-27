import type { ISitePluginOffer } from '@/app/plugins/installed/interfaces/site-plugin-offer.interface';

/** A plugin this site uploaded itself. */
export interface ISiteOwnPlugin extends ISitePluginOffer {
  /** Loaded and running on the server; a plugin that failed to start cannot be switched on. */
  running: boolean;
}
