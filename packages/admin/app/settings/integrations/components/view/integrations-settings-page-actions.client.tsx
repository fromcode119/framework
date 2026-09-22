import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationStaleJsService } from '@/app/settings/integrations/integration-stale-js-service';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
import { IntegrationsSettingsPageReconcile } from '@/app/settings/integrations/components/view/integrations-settings-page-reconcile.client';

/**
 * What the operator can DO here: load, add, save, enable, disable and remove a provider.
 *
 * Each write updates the one record it changed rather than re-loading the whole list, so the
 * selection and the open editor survive it.
 */
export abstract class IntegrationsSettingsPageActions extends IntegrationsSettingsPageReconcile {
  protected async loadIntegrations(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.loading = true;
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      const sorted = docs
        .filter((doc: any) => doc && typeof doc.key === 'string')
        .sort((a: IIntegrationRecord, b: IIntegrationRecord) => a.label.localeCompare(b.label));
      IntegrationsPageUtils.hydrateFieldTypes(sorted);
      if (!this.mounted) return;
      this.integrations = sorted;
      if (!sorted.length) {
        this.activeType = '';
        this.selectedProviderId = '';
        this.editor = null;
        return;
      }

      const queryType = this.queryType;
      const preferredType = queryType && sorted.some((integration: IIntegrationRecord) => integration.key === queryType)
        ? queryType
        : sorted[0].key;
      this.activeType = preferredType;
    } catch (error: any) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Failed to load integrations',
        message: error?.message || 'Unable to read integration configuration.'
      });
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  protected async handleResetStaleJavaScript(): Promise<void> {
    if (!IntegrationStaleJsService.isSupported()) return;
    this.resettingStaleJs = true;

    try {
      await IntegrationStaleJsService.clearCaches();
    } catch (error: any) {
      this.runtime.notify.addNotification({
        type: NotificationType.ERROR,
        title: 'Stale JS reset failed',
        message: error?.message || 'Unable to clear cached admin assets.'
      });
      this.resettingStaleJs = false;
      return;
    }

    IntegrationStaleJsService.reloadWithBuster();
  }

  protected startAddProvider(): void {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration?.providers?.length) return;
    const defaultProvider = activeIntegration.providers[0];
    this.removeCandidateId = null;
    this.selectedProviderId = '';
    this.editor = {
      isNew: true,
      providerId: '',
      providerKey: defaultProvider.key,
      providerName: '',
      enabled: true,
      config: {},
      preservedSecretFields: {}
    };
  }

  protected resetEditor(): void {
    const editor = this.editor;
    const activeIntegration = this.activeIntegration;
    if (!editor || !activeIntegration) return;
    if (editor.isNew) {
      this.startAddProvider();
      return;
    }

    const selectedProviderDefinition = this.selectedProviderDefinition;
    const selected = (activeIntegration.storedProviders || []).find((provider) => provider.id === editor.providerId);
    if (!selected) return;
    this.editor = IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition);
  }

  protected cancelNewProvider(): void {
    const firstProvider = this.activeProviders[0];
    this.editor = null;
    if (firstProvider) {
      this.selectedProviderId = firstProvider.id;
    }
  }

  protected async handleSaveProvider(): Promise<void> {
    const activeIntegration = this.activeIntegration;
    const editor = this.editor;
    if (!activeIntegration || !editor) return;
    const addNotification = this.runtime.notify.addNotification;
    const providerDefinition = activeIntegration.providers.find((provider) => provider.key === editor.providerKey);
    if (!providerDefinition) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Invalid provider',
        message: 'Selected provider is not available for this integration type.'
      });
      return;
    }

    const validationErrors = IntegrationProviderFormHelper.validate(providerDefinition.fields || [], editor);
    if (validationErrors.length) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Configuration invalid',
        message: validationErrors[0]
      });
      return;
    }

    this.saving = true;
    try {
      const payload = IntegrationProviderFormHelper.buildSavePayload(providerDefinition, editor);
      const response = await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION(activeIntegration.key), payload);
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const nextProviderId = IntegrationProviderFormHelper.resolveNextProviderId(updatedIntegration, editor);
      this.selectedProviderId = nextProviderId;
      this.editor = null;
      this.removeCandidateId = null;
      addNotification({
        type: NotificationType.SUCCESS,
        title: editor.isNew ? 'Provider added' : 'Provider updated',
        message: `${providerDefinition.label} configuration saved.`
      });
    } catch (error: any) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Save failed',
        message: error?.message || 'Unable to save provider configuration.'
      });
    } finally {
      this.saving = false;
    }
  }

  protected async handleToggleProvider(provider: IStoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    const addNotification = this.runtime.notify.addNotification;
    this.changingProviderId = provider.id;
    try {
      const response = await AdminApi.patch(
        AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id),
        { enabled: provider.enabled === false }
      );
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);
      addNotification({
        type: NotificationType.SUCCESS,
        title: 'Provider status updated',
        message: `${provider.name || provider.providerKey} is now ${provider.enabled === false ? 'enabled' : 'disabled'}.`
      });
    } catch (error: any) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Status update failed',
        message: error?.message || 'Unable to change provider status.'
      });
    } finally {
      this.changingProviderId = null;
    }
  }

  protected async handleRemoveProvider(provider: IStoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    const addNotification = this.runtime.notify.addNotification;
    this.changingProviderId = provider.id;
    try {
      const response = await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id));
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const updatedProviders = updatedIntegration.storedProviders || [];
      const nextSelected = updatedProviders[0]?.id || '';
      this.selectedProviderId = nextSelected;
      this.editor = null;
      this.removeCandidateId = null;
      addNotification({
        type: NotificationType.SUCCESS,
        title: 'Provider removed',
        message: `${provider.name || provider.providerKey} has been removed.`
      });
    } catch (error: any) {
      addNotification({
        type: NotificationType.ERROR,
        title: 'Remove failed',
        message: error?.message || 'Unable to remove provider.'
      });
    } finally {
      this.changingProviderId = null;
    }
  }
}
