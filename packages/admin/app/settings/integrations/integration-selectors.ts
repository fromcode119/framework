import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
/**
 * Pure derived selectors for the integrations settings page state.
 */
export class IntegrationSelectors {
  static integrationOptions(integrations: IIntegrationRecord[]): Array<{ label: string; value: string }> {
    return integrations.map((integration) => ({
      label: integration.label,
      value: integration.key
    }));
  }

  static activeIntegration(integrations: IIntegrationRecord[], activeType: string): IIntegrationRecord | null {
    return integrations.find((integration) => integration.key === activeType) || null;
  }

  static activeProviders(activeIntegration: IIntegrationRecord | null): IStoredProvider[] {
    return activeIntegration?.storedProviders || [];
  }

  static runtimeProviderId(activeIntegration: IIntegrationRecord | null): string {
    if (!activeIntegration) return '';
    const runtimeKey = String(activeIntegration.active?.provider || activeIntegration.stored?.providerKey || '').trim();
    if (!runtimeKey) return '';
    const match = (activeIntegration.storedProviders || []).find(
      (provider) => provider.enabled !== false && provider.providerKey === runtimeKey
    );
    return match?.id || '';
  }

  static currentProviderDefinition(
    activeIntegration: IIntegrationRecord | null,
    editor: IProviderEditorState | null,
  ): IIntegrationProvider | null {
    if (!activeIntegration || !editor?.providerKey) return null;
    return activeIntegration.providers.find((provider) => provider.key === editor.providerKey) || null;
  }

  static selectedProviderDefinition(
    activeIntegration: IIntegrationRecord | null,
    selectedProviderId: string,
  ): IIntegrationProvider | null {
    if (!activeIntegration || !selectedProviderId) return null;
    const selectedProvider = (activeIntegration.storedProviders || []).find((provider) => provider.id === selectedProviderId);
    if (!selectedProvider) return null;
    return activeIntegration.providers.find((provider) => provider.key === selectedProvider.providerKey) || null;
  }
}
