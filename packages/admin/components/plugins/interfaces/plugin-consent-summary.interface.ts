import type { IPluginConsentEntry } from '@/components/plugins/interfaces/plugin-consent-entry.interface';

/** What a plugin asks to be approved for (`GET /plugins/:slug/consent`). */
export interface IPluginConsentSummary {
  slug: string;
  name: string;
  version: string;
  entries: IPluginConsentEntry[];
  /** The exact list an approval sends back. */
  consent: string[];
  requiresApproval: boolean;
  dropped: string[];
  anyHostReason: string;
  invalidHosts: string[];
  collections: string[];
  adminScreens: boolean;
  storefrontWidgets: number;
  storefrontCode: boolean;
  storefrontHosts: string[];
  isolated: boolean;
  memoryLimitMb: number | null;
  timeoutMs: number | null;
}
