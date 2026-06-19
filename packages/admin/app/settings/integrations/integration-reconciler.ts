import type { IntegrationsFieldOptionsService } from './integrations-field-options-service';
import type {
  IntegrationConfigField,
  IntegrationProvider,
  IntegrationRecord,
  ProviderEditorState,
} from './integrations-settings-page-client.interfaces';

interface DynamicFieldState {
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
}

/**
 * Pure key-builders and dynamic-field option loading for the integrations
 * settings page reconciliation effects.
 */
export class IntegrationReconciler {
  static activeTypeKey(integrations: IntegrationRecord[], queryType: string, activeType: string): string {
    return JSON.stringify({ ids: integrations.map((i) => i.key), queryType, activeType });
  }

  static editorBuildKey(
    activeIntegration: IntegrationRecord | null,
    selectedProviderId: string,
    editor: ProviderEditorState | null,
    selectedProviderDefinition: IntegrationProvider | null,
  ): string {
    return JSON.stringify({
      activeKey: activeIntegration?.key || '',
      providers: (activeIntegration?.storedProviders || []).map((p) => p.id),
      selectedProviderId,
      isNew: editor?.isNew ?? null,
      defFields: (selectedProviderDefinition?.fields || []).map((f) => f.name),
    });
  }

  static dynamicKey(currentProviderDefinition: IntegrationProvider | null, editor: ProviderEditorState | null): string {
    return JSON.stringify({
      defKey: currentProviderDefinition?.key || '',
      editorId: editor ? editor.providerId : null,
      editorKey: editor?.providerKey ?? null,
      isNew: editor?.isNew ?? null,
      config: editor?.config ?? null,
    });
  }

  static dynamicFields(currentProviderDefinition: IntegrationProvider): IntegrationConfigField[] {
    return (currentProviderDefinition.fields || []).filter(
      (field) => field.type === 'select' && !!field.optionsEndpoint
    );
  }

  static initialLoadingState(
    service: IntegrationsFieldOptionsService,
    dynamicFields: IntegrationConfigField[],
    providerId: string,
    providerKey: string,
  ): Record<string, boolean> {
    return dynamicFields.reduce<Record<string, boolean>>((acc, field) => {
      acc[service.buildFieldStateKey(providerId, providerKey, field.name)] = !!providerId;
      return acc;
    }, {});
  }

  static async loadFieldOptions(
    service: IntegrationsFieldOptionsService,
    editor: ProviderEditorState,
    dynamicFields: IntegrationConfigField[],
    providerId: string,
  ): Promise<DynamicFieldState> {
    const dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>> = {};
    const dynamicFieldErrors: Record<string, string> = {};
    const dynamicFieldLoading: Record<string, boolean> = {};

    for (const field of dynamicFields) {
      const fieldKey = service.buildFieldStateKey(providerId, editor.providerKey, field.name);
      dynamicFieldLoading[fieldKey] = false;

      if (!providerId) {
        dynamicFieldOptions[fieldKey] = service.ensureValueOption(field.options || [], editor.config?.[field.name]);
        continue;
      }

      try {
        const loadedOptions = await service.loadOptions(field, {
          providerId,
          providerKey: editor.providerKey
        });
        dynamicFieldOptions[fieldKey] = service.ensureValueOption(loadedOptions, editor.config?.[field.name]);
      } catch (error: any) {
        dynamicFieldOptions[fieldKey] = service.ensureValueOption(field.options || [], editor.config?.[field.name]);
        dynamicFieldErrors[fieldKey] = error?.message || 'Unable to load options.';
      }
    }

    return { dynamicFieldOptions, dynamicFieldErrors, dynamicFieldLoading };
  }
}
