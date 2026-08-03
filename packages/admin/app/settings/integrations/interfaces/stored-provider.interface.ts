

export interface IStoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
