export interface IIntegrationStoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  /** The registering plugin's namespace, from the provider's registration (see the definition). */
  namespace?: string;
  /**
   * Who held the provider when these credentials were saved. Only that registrant is handed them: a
   * different plugin that later claims the same provider key gets nothing (IntegrationResolverService).
   */
  registeredBy?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
