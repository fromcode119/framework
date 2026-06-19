import type {
  IntegrationRecord,
  ProviderEditorState,
  StoredProvider,
} from './integrations-settings-page-client.interfaces';

export interface IntegrationProviderListProps {
  activeIntegration: IntegrationRecord | null;
  activeProviders: StoredProvider[];
  selectedProviderId: string;
  editor: ProviderEditorState | null;
  removeCandidateId: string | null;
  changingProviderId: string | null;
  runtimeProviderId: string;
  onAddProvider: () => void;
  onSelectProvider: (providerId: string) => void;
  onToggleProvider: (provider: StoredProvider) => void;
  onRequestRemove: (providerId: string) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (provider: StoredProvider) => void;
}
