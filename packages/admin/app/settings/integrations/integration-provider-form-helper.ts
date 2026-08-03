import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
/**
 * Pure helpers for the integrations provider editor: validation, payload
 * building, next-selection resolution, and editor-state construction.
 */
export class IntegrationProviderFormHelper {
  static validate(fields: IIntegrationConfigField[], editor: IProviderEditorState): string[] {
    const errors: string[] = [];
    for (const field of fields) {
      const value = editor.config?.[field.name];
      const hasSavedSecret = field.type === IntegrationFieldType.PASSWORD && editor.preservedSecretFields?.[field.name] === true;
      if (field.required && IntegrationsPageUtils.isBlank(value) && !hasSavedSecret) {
        errors.push(`${field.label} is required.`);
      }
      if (field.type === IntegrationFieldType.NUMBER && !IntegrationsPageUtils.isBlank(value) && Number.isNaN(Number(value))) {
        errors.push(`${field.label} must be a valid number.`);
      }
    }
    return errors;
  }

  static buildSavePayload(providerDefinition: IIntegrationProvider, editor: IProviderEditorState): Record<string, any> {
    const payload: Record<string, any> = {
      provider: editor.providerKey,
      config: IntegrationsPageUtils.copyConfigForFields(providerDefinition.fields || [], editor.config || {}),
      enabled: editor.enabled
    };
    if (!editor.isNew && editor.providerId) payload.providerId = editor.providerId;
    if (editor.providerName.trim()) payload.providerName = editor.providerName.trim();
    return payload;
  }

  static resolveNextProviderId(updated: IIntegrationRecord, editor: IProviderEditorState): string {
    const updatedProviders = updated.storedProviders || [];
    let nextProviderId = '';

    if (!editor.isNew && editor.providerId) {
      nextProviderId = editor.providerId;
    } else if (editor.isNew) {
      const byName = editor.providerName.trim()
        ? updatedProviders.find(
            (provider) =>
              provider.providerKey === editor.providerKey &&
              String(provider.name || '').trim() === editor.providerName.trim()
          )
        : undefined;
      nextProviderId =
        byName?.id ||
        updatedProviders.find((provider) => provider.providerKey === editor.providerKey)?.id ||
        updatedProviders[0]?.id ||
        '';
    }

    if (!nextProviderId && updatedProviders.length) {
      nextProviderId = updatedProviders[0].id;
    }
    return nextProviderId;
  }

  static buildEditorForProvider(
    selected: IStoredProvider,
    providerDefinition: IIntegrationProvider | null,
  ): IProviderEditorState {
    return {
      isNew: false,
      providerId: selected.id,
      providerKey: selected.providerKey,
      providerName: selected.name || '',
      enabled: selected.enabled !== false,
      config: IntegrationsPageUtils.copyConfigWithoutSavedSecrets(providerDefinition?.fields || [], selected.config || {}),
      preservedSecretFields: IntegrationsPageUtils.readPreservedSecretFields(providerDefinition?.fields || [], selected.config || {}),
    };
  }

  static extractUpdatedIntegration(response: any): IIntegrationRecord {
    const updatedIntegration = response?.integration as IIntegrationRecord;
    if (!updatedIntegration?.key) {
      throw new Error('Integration update returned an invalid response.');
    }
    return updatedIntegration;
  }
}
