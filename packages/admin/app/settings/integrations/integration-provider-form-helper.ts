import { IntegrationsPageUtils } from './IntegrationsPageUtils';
import type {
  IntegrationConfigField,
  IntegrationProvider,
  IntegrationRecord,
  ProviderEditorState,
  StoredProvider,
} from './integrations-settings-page-client.interfaces';

/**
 * Pure helpers for the integrations provider editor: validation, payload
 * building, next-selection resolution, and editor-state construction.
 */
export class IntegrationProviderFormHelper {
  static validate(fields: IntegrationConfigField[], editor: ProviderEditorState): string[] {
    const errors: string[] = [];
    for (const field of fields) {
      const value = editor.config?.[field.name];
      const hasSavedSecret = field.type === 'password' && editor.preservedSecretFields?.[field.name] === true;
      if (field.required && IntegrationsPageUtils.isBlank(value) && !hasSavedSecret) {
        errors.push(`${field.label} is required.`);
      }
      if (field.type === 'number' && !IntegrationsPageUtils.isBlank(value) && Number.isNaN(Number(value))) {
        errors.push(`${field.label} must be a valid number.`);
      }
    }
    return errors;
  }

  static buildSavePayload(providerDefinition: IntegrationProvider, editor: ProviderEditorState): Record<string, any> {
    const payload: Record<string, any> = {
      provider: editor.providerKey,
      config: IntegrationsPageUtils.copyConfigForFields(providerDefinition.fields || [], editor.config || {}),
      enabled: editor.enabled
    };
    if (!editor.isNew && editor.providerId) payload.providerId = editor.providerId;
    if (editor.providerName.trim()) payload.providerName = editor.providerName.trim();
    return payload;
  }

  static resolveNextProviderId(updated: IntegrationRecord, editor: ProviderEditorState): string {
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
    selected: StoredProvider,
    providerDefinition: IntegrationProvider | null,
  ): ProviderEditorState {
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

  static extractUpdatedIntegration(response: any): IntegrationRecord {
    const updatedIntegration = response?.integration as IntegrationRecord;
    if (!updatedIntegration?.key) {
      throw new Error('Integration update returned an invalid response.');
    }
    return updatedIntegration;
  }
}
