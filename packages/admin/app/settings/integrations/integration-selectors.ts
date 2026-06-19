import type {
  IntegrationProvider,
  IntegrationRecord,
  ProviderEditorState,
  StoredProvider,
} from './integrations-settings-page-client.interfaces';

/**
 * Pure derived selectors for the integrations settings page state.
 */
export class IntegrationSelectors {
  static integrationOptions(integrations: IntegrationRecord[]): Array<{ label: string; value: string }> {
    return integrations.map((integration) => ({
      label: integration.label,
      value: integration.key
    }));
  }

  static activeIntegration(integrations: IntegrationRecord[], activeType: string): IntegrationRecord | null {
    return integrations.find((integration) => integration.key === activeType) || null;
  }

  static activeProviders(activeIntegration: IntegrationRecord | null): StoredProvider[] {
    return activeIntegration?.storedProviders || [];
  }

  static runtimeProviderId(activeIntegration: IntegrationRecord | null): string {
    if (!activeIntegration) return '';
    const runtimeKey = String(activeIntegration.active?.provider || activeIntegration.stored?.providerKey || '').trim();
    if (!runtimeKey) return '';
    const match = (activeIntegration.storedProviders || []).find(
      (provider) => provider.enabled !== false && provider.providerKey === runtimeKey
    );
    return match?.id || '';
  }

  static currentProviderDefinition(
    activeIntegration: IntegrationRecord | null,
    editor: ProviderEditorState | null,
  ): IntegrationProvider | null {
    if (!activeIntegration || !editor?.providerKey) return null;
    return activeIntegration.providers.find((provider) => provider.key === editor.providerKey) || null;
  }

  static selectedProviderDefinition(
    activeIntegration: IntegrationRecord | null,
    selectedProviderId: string,
  ): IntegrationProvider | null {
    if (!activeIntegration || !selectedProviderId) return null;
    const selectedProvider = (activeIntegration.storedProviders || []).find((provider) => provider.id === selectedProviderId);
    if (!selectedProvider) return null;
    return activeIntegration.providers.find((provider) => provider.key === selectedProvider.providerKey) || null;
  }
}
