import type { IntegrationsFieldOptionsService } from './integrations-field-options-service';
import type {
  IntegrationConfigField,
  ProviderEditorState,
} from './integrations-settings-page-client.interfaces';

export interface IntegrationFieldInputProps {
  field: IntegrationConfigField;
  editor: ProviderEditorState;
  fieldOptionsService: IntegrationsFieldOptionsService;
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
  onChange: (nextValue: any) => void;
}
