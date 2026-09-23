export interface IIntegrationStoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  /** The registering plugin's namespace, from the provider's registration (see the definition). */
  namespace?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
