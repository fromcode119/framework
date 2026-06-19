import type { IntegrationsFieldOptionsService } from './integrations-field-options-service';
import type {
  IntegrationProvider,
  IntegrationRecord,
  ProviderEditorState,
} from './integrations-settings-page-client.interfaces';

export interface IntegrationProviderEditorProps {
  activeIntegration: IntegrationRecord | null;
  editor: ProviderEditorState | null;
  currentProviderDefinition: IntegrationProvider | null;
  saving: boolean;
  fieldOptionsService: IntegrationsFieldOptionsService;
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
  patchEditor: (patch: Partial<ProviderEditorState> | ((prev: ProviderEditorState) => ProviderEditorState)) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
}
