
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';

export interface IIntegrationsSettingsPageClientState {
  queryType: string;
  resolved: boolean;
  loading: boolean;
  saving: boolean;
  resettingStaleJs: boolean;
  changingProviderId: string | null;
  removeCandidateId: string | null;
  integrations: IIntegrationRecord[];
  activeType: string;
  selectedProviderId: string;
  editor: IProviderEditorState | null;
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
}
