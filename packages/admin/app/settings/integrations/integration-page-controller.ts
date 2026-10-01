import type { IIntegrationControllerHost } from '@/app/settings/integrations/interfaces/integration-controller-host.interface';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationSelectors } from '@/app/settings/integrations/integration-selectors';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Orchestrates data-mutation actions (load, save, toggle, remove, editor
 * lifecycle) for the integrations settings page, delegating state/notify to a
 * host adapter so the React component stays a thin shell.
 */
export class IntegrationPageController {
  constructor(private readonly host: IIntegrationControllerHost) {}

  private get activeIntegration(): IIntegrationRecord | null {
    const { integrations, activeType } = this.host.getState();
    return IntegrationSelectors.activeIntegration(integrations, activeType);
  }

  private applyIntegrationUpdate(updated: IIntegrationRecord): void {
    this.host.setState((previous) => {
      const exists = previous.integrations.some((integration) => integration.key === updated.key);
      if (!exists) return null;
      return { integrations: previous.integrations.map((integration) => (integration.key === updated.key ? updated : integration)) };
    });
  }

  activateType(typeKey: string): void {
    const normalized = IntegrationsPageUtils.normalizeKey(typeKey);
    if (!normalized || normalized === this.host.getState().activeType) return;
    this.host.setState({ activeType: normalized, selectedProviderId: '', editor: null, removeCandidateId: null });
    this.host.replaceRoute(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(normalized));
  }

  async loadIntegrations(): Promise<void> {
    this.host.setState({ loading: true });
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      const sorted = docs
        .filter((doc: any) => doc && typeof doc.key === 'string')
        .sort((a: IIntegrationRecord, b: IIntegrationRecord) => a.label.localeCompare(b.label));
      IntegrationsPageUtils.hydrateFieldTypes(sorted);
      if (!this.host.isMounted()) return;
      this.host.setState({ integrations: sorted });
      if (!sorted.length) {
        this.host.setState({ activeType: '', selectedProviderId: '', editor: null });
        return;
      }

      const queryType = this.host.getState().queryType;
      const preferredType = queryType && sorted.some((integration: IIntegrationRecord) => integration.key === queryType)
        ? queryType
        : sorted[0].key;
      this.host.setState({ activeType: preferredType });
    } catch (error: any) {
      this.host.notify({
        type: NotificationType.ERROR,
        title: AdminI18n.t('settings.integrations.failedToLoadIntegrations'),
        message: error?.message || AdminI18n.t('settings.integrations.unableToReadIntegrationConfiguration')
      });
    } finally {
      if (this.host.isMounted()) this.host.setState({ loading: false });
    }
  }

  startAddProvider(): void {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration?.providers?.length) return;
    const defaultProvider = activeIntegration.providers[0];
    this.host.setState({
      removeCandidateId: null,
      selectedProviderId: '',
      editor: {
        isNew: true,
        providerId: '',
        providerKey: defaultProvider.key,
        providerName: '',
        enabled: true,
        config: IntegrationsPageUtils.defaultConfigForFields(defaultProvider.fields),
        preservedSecretFields: {}
      },
    });
  }

  resetEditor(): void {
    const { editor, selectedProviderId } = this.host.getState();
    const activeIntegration = this.activeIntegration;
    if (!editor || !activeIntegration) return;
    if (editor.isNew) {
      this.startAddProvider();
      return;
    }

    const selectedProviderDefinition = IntegrationSelectors.selectedProviderDefinition(activeIntegration, selectedProviderId);
    const selected = (activeIntegration.storedProviders || []).find((provider) => provider.id === editor.providerId);
    if (!selected) return;
    this.host.setState({
      editor: IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition),
    });
  }

  cancelNewProvider(): void {
    const activeIntegration = this.activeIntegration;
    const firstProvider = IntegrationSelectors.activeProviders(activeIntegration)[0];
    this.host.setState({ editor: null });
    if (firstProvider) {
      this.host.setState({ selectedProviderId: firstProvider.id });
    }
  }

  async saveProvider(): Promise<void> {
    const activeIntegration = this.activeIntegration;
    const editor = this.host.getState().editor;
    if (!activeIntegration || !editor) return;
    const providerDefinition = activeIntegration.providers.find((provider) => provider.key === editor.providerKey);
    if (!providerDefinition) {
      this.host.notify({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.invalidProvider'), message: AdminI18n.t('settings.integrations.selectedProviderIsNotAvailable') });
      return;
    }

    const validationErrors = IntegrationProviderFormHelper.validate(providerDefinition.fields || [], editor);
    if (validationErrors.length) {
      this.host.notify({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.configurationInvalid'), message: validationErrors[0] });
      return;
    }

    this.host.setState({ saving: true });
    try {
      const payload = IntegrationProviderFormHelper.buildSavePayload(providerDefinition, editor);
      const response = await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION(activeIntegration.key), payload);
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const nextProviderId = IntegrationProviderFormHelper.resolveNextProviderId(updatedIntegration, editor);
      this.host.setState({ selectedProviderId: nextProviderId, editor: null, removeCandidateId: null });
      this.host.notify({
        type: NotificationType.SUCCESS,
        title: editor.isNew ? AdminI18n.t('settings.integrations.providerAdded') : AdminI18n.t('settings.integrations.providerUpdated'),
        message: AdminI18n.t('settings.integrations.configurationSaved', { label: providerDefinition.label })
      });
    } catch (error: any) {
      this.host.notify({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.saveFailed'), message: error?.message || AdminI18n.t('settings.integrations.unableToSaveProviderConfiguration') });
    } finally {
      this.host.setState({ saving: false });
    }
  }

  async toggleProvider(provider: IStoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    this.host.setState({ changingProviderId: provider.id });
    try {
      const response = await AdminApi.patch(
        AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id),
        { enabled: provider.enabled === false }
      );
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);
      this.host.notify({
        type: NotificationType.SUCCESS,
        title: AdminI18n.t('settings.integrations.providerStatusUpdated'),
        message: `${provider.name || provider.providerKey} is now ${provider.enabled === false ? 'enabled' : 'disabled'}.`
      });
    } catch (error: any) {
      this.host.notify({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.statusUpdateFailed'), message: error?.message || AdminI18n.t('settings.integrations.unableToChangeProviderStatus') });
    } finally {
      this.host.setState({ changingProviderId: null });
    }
  }

  async removeProvider(provider: IStoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    this.host.setState({ changingProviderId: provider.id });
    try {
      const response = await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id));
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const nextSelected = (updatedIntegration.storedProviders || [])[0]?.id || '';
      this.host.setState({ selectedProviderId: nextSelected, editor: null, removeCandidateId: null });
      this.host.notify({
        type: NotificationType.SUCCESS,
        title: AdminI18n.t('settings.integrations.providerRemoved'),
        message: AdminI18n.t('settings.integrations.hasBeenRemoved', { name: provider.name || provider.providerKey })
      });
    } catch (error: any) {
      this.host.notify({ type: NotificationType.ERROR, title: AdminI18n.t('settings.integrations.removeFailed'), message: error?.message || AdminI18n.t('settings.integrations.unableToRemoveProvider') });
    } finally {
      this.host.setState({ changingProviderId: null });
    }
  }

  patchEditor(patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)): void {
    this.host.setState((previous) => {
      if (!previous.editor) return null;
      const nextEditor = typeof patch === 'function' ? patch(previous.editor) : { ...previous.editor, ...patch };
      return { editor: nextEditor };
    });
  }
}
