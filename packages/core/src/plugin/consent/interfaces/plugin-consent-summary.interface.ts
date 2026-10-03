import type { IPluginConsentEntry } from '@core/plugin/consent/interfaces/plugin-consent-entry.interface';

/** Everything the consent dialog shows before an operator approves a plugin. */
export interface IPluginConsentSummary {
  slug: string;
  name: string;
  version: string;
  /** Every entry the plugin asks for, the riskiest first. */
  entries: IPluginConsentEntry[];
  /** The exact list an approval must send back; the server refuses one that differs. */
  consent: string[];
  /** Whether anything in `consent` is not approved yet. */
  requiresApproval: boolean;
  /** Entries approved before that the plugin no longer asks for. */
  dropped: string[];
  /** The plugin's own words on why it needs every host, when it asks for that. */
  anyHostReason: string;
  /** `network.hosts` entries that are not host names; the plugin cannot reach them. */
  invalidHosts: string[];
  /** Collections the plugin creates (tables of its own). */
  collections: string[];
  /** It adds screens to the console. */
  adminScreens: boolean;
  /** Sandboxed frames it places on the storefront. */
  storefrontWidgets: number;
  /** It ships code that runs inside the storefront page itself. */
  storefrontCode: boolean;
  /** It runs in its own process, with these limits when it sets them. */
  isolated: boolean;
  memoryLimitMb: number | null;
  timeoutMs: number | null;
}
