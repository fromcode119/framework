import type { IntegrationFieldType } from './integrations-settings-page-client.types';

export interface IntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  optionsEndpoint?: string;
  searchable?: boolean;
  defaultValue?: string | number | boolean;
}

export interface IntegrationProvider {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
}

export interface StoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IntegrationRecord {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: IntegrationProvider[];
  active?: { provider: string; source: string; config: Record<string, any> } | null;
  stored?: { providerKey: string; config: Record<string, any> } | null;
  storedProviders?: StoredProvider[] | null;
}

export interface ProviderEditorState {
  isNew: boolean;
  providerId: string;
  providerKey: string;
  providerName: string;
  enabled: boolean;
  config: Record<string, any>;
  preservedSecretFields: Record<string, boolean>;
}

export interface IntegrationsSettingsPageClientProps {
  searchParams?: Promise<Record<string, string | string[]>>;
}

export interface IntegrationsSettingsPageClientState {
  queryType: string;
  resolved: boolean;
  loading: boolean;
  saving: boolean;
  resettingStaleJs: boolean;
  changingProviderId: string | null;
  removeCandidateId: string | null;
  integrations: IntegrationRecord[];
  activeType: string;
  selectedProviderId: string;
  editor: ProviderEditorState | null;
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
}