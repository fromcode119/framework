import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
/**
 * Pure derived selectors for the integrations settings page state.
 */
export class IntegrationSelectors {
  /**
   * One tab per owner of at least one type: the framework's types first, then each plugin's, in the
   * order the plugins first appear. An empty slug is the framework.
   */
  static ownerTabs(integrations: IIntegrationRecord[]): Array<{ slug: string; label: string }> {
    const tabs: Array<{ slug: string; label: string }> = [];
    for (const integration of integrations) {
      const slug = integration.owner?.slug || '';
      if (tabs.some((tab) => tab.slug === slug)) continue;
      tabs.push({ slug, label: integration.owner?.label || slug });
    }
    return tabs.sort((a, b) => (a.slug === '' ? -1 : b.slug === '' ? 1 : 0));
  }

  static typesOfOwner(integrations: IIntegrationRecord[], ownerSlug: string): IIntegrationRecord[] {
    return integrations.filter((integration) => (integration.owner?.slug || '') === ownerSlug);
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
}
