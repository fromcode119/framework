export interface IPluginBatchSettleHost {
  /** Cache-bypassed catalog refetch that does NOT flip the page into its loading state, and THROWS on failure so the settle loop can tell "api still restarting" from "fetched but not settled yet". */
  refetchCatalogInBackground(): Promise<void>;
  /** True when no installed plugin is still below its marketplace version. */
  isCatalogSettled(): boolean;
  isStillMounted(): boolean;
  reportSettleProgress(message: string): void;
}
