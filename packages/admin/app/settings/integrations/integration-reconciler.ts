import type { IDynamicFieldState } from '@/app/settings/integrations/interfaces/dynamic-field-state.interface';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import type { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';

/**
 * Pure key-builders and dynamic-field option loading for the integrations
 * settings page reconciliation effects.
 */
export class IntegrationReconciler {
  static activeTypeKey(integrations: IIntegrationRecord[], queryType: string, activeType: string): string {
    return JSON.stringify({ ids: integrations.map((i) => i.key), queryType, activeType });
  }

  static editorBuildKey(
    activeIntegration: IIntegrationRecord | null,
    selectedProviderId: string,
    editor: IProviderEditorState | null,
    selectedProviderDefinition: IIntegrationProvider | null,
  ): string {
    return JSON.stringify({
      activeKey: activeIntegration?.key || '',
      providers: (activeIntegration?.storedProviders || []).map((p) => p.id),
      selectedProviderId,
      isNew: editor?.isNew ?? null,
      defFields: (selectedProviderDefinition?.fields || []).map((f) => f.name),
    });
  }

  static dynamicKey(currentProviderDefinition: IIntegrationProvider | null, editor: IProviderEditorState | null): string {
    return JSON.stringify({
      defKey: currentProviderDefinition?.key || '',
      editorId: editor ? editor.providerId : null,
      editorKey: editor?.providerKey ?? null,
      isNew: editor?.isNew ?? null,
      config: editor?.config ?? null,
    });
  }

  static dynamicFields(currentProviderDefinition: IIntegrationProvider): IIntegrationConfigField[] {
    return (currentProviderDefinition.fields || []).filter(
      (field) => field.type === IntegrationFieldType.SELECT && !!field.optionsEndpoint
    );
  }

  static initialLoadingState(
    service: IntegrationsFieldOptionsService,
    dynamicFields: IIntegrationConfigField[],
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
    editor: IProviderEditorState,
    dynamicFields: IIntegrationConfigField[],
    providerId: string,
  ): Promise<IDynamicFieldState> {
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
