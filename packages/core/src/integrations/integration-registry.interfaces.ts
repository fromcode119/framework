import type { IntegrationConfigFieldType } from './integration-registry.types';
import type { Logger } from '../logging';

export interface IntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  optionsEndpoint?: string;
  searchable?: boolean;
  defaultValue?: string | number | boolean;
}
export interface IntegrationProviderDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: Logger }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
}
export interface IntegrationTypeDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
}
export interface IntegrationResolved<TInstance = any> {
  type: string;
  providerKey: string;
  provider: IntegrationProviderDefinition<TInstance>;
  config: Record<string, any>;
  source: 'stored' | 'env' | 'default';
}
export interface IntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IntegrationConfigField[];
  }>;
}
export interface IntegrationStoredProfile {
  id: string;
  name: string;
  providerKey: string;
  config: Record<string, any>;
  activeProviderKey?: string;
  providers?: IntegrationStoredProvider[];
  createdAt?: string;
  updatedAt?: string;
}
export interface IntegrationStoredProfiles {
  activeProfileId: string;
  profiles: IntegrationStoredProfile[];
}
export interface IntegrationStoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface IntegrationTypeRuntime<TInstance = any> {
  definition: IntegrationTypeDefinition<TInstance>;
  providers: Map<string, IntegrationProviderDefinition<TInstance>>;
}
