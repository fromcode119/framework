"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import { AdminConstants } from '@/lib/constants';
import { AdminApi } from '@/lib/api';
import { IntegrationsPageUtils } from './IntegrationsPageUtils';
import { IntegrationsFieldOptionsService } from './integrations-field-options-service';
import { AdminComponent } from '@/components/admin-component';
import { IntegrationProviderList } from './integration-provider-list';
import { IntegrationProviderEditor } from './integration-provider-editor';
import { IntegrationProviderFormHelper } from './integration-provider-form-helper';
import { IntegrationReconciler } from './integration-reconciler';
import { IntegrationHeader } from './integration-header';
import { IntegrationEmptyState } from './integration-empty-state';
import { IntegrationSelectors } from './integration-selectors';
import { IntegrationStaleJsService } from './integration-stale-js-service';
import type {
  IntegrationConfigField,
  IntegrationProvider,
  IntegrationRecord,
  ProviderEditorState,
  StoredProvider,
  IntegrationsSettingsPageClientProps,
  IntegrationsSettingsPageClientState,
} from './integrations-settings-page-client.interfaces';

export class IntegrationsSettingsPageClient extends AdminComponent<IntegrationsSettingsPageClientProps, IntegrationsSettingsPageClientState> {
  private mounted = false;
  private readonly fieldOptionsService = new IntegrationsFieldOptionsService();
  private fieldOptionsLoadToken = 0;
  private prevReconcileKey = '';
  private prevEditorBuildKey = '';
  private prevDynamicKey = '';

  state: IntegrationsSettingsPageClientState = {
    queryType: '',
    resolved: false,
    loading: true,
    saving: false,
    resettingStaleJs: false,
    changingProviderId: null,
    removeCandidateId: null,
    integrations: [],
    activeType: '',
    selectedProviderId: '',
    editor: null,
    dynamicFieldOptions: {},
    dynamicFieldErrors: {},
    dynamicFieldLoading: {},
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const searchParams = this.props.searchParams ? await this.props.searchParams : undefined;
    if (!this.mounted) return;
    const queryType = IntegrationsPageUtils.normalizeKey(String(searchParams?.type || ''));
    this.setState({ queryType, resolved: true }, () => void this.loadIntegrations());
  }

  componentDidUpdate(): void {
    if (!this.state.resolved) return;
    this.reconcileActiveType();
    this.reconcileEditor();
    this.reconcileDynamicFieldOptions();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  // ---- Derived selectors (replace useMemo) ----

  private get integrationOptions(): Array<{ label: string; value: string }> {
    return IntegrationSelectors.integrationOptions(this.state.integrations);
  }

  private get activeIntegration(): IntegrationRecord | null {
    return IntegrationSelectors.activeIntegration(this.state.integrations, this.state.activeType);
  }

  private get activeProviders(): StoredProvider[] {
    return IntegrationSelectors.activeProviders(this.activeIntegration);
  }

  private get runtimeProviderId(): string {
    return IntegrationSelectors.runtimeProviderId(this.activeIntegration);
  }

  private get currentProviderDefinition(): IntegrationProvider | null {
    return IntegrationSelectors.currentProviderDefinition(this.activeIntegration, this.state.editor);
  }

  private get selectedProviderDefinition(): IntegrationProvider | null {
    return IntegrationSelectors.selectedProviderDefinition(this.activeIntegration, this.state.selectedProviderId);
  }

  // ---- Effect reconciliation ----

  private reconcileActiveType(): void {
    const { integrations, queryType, activeType } = this.state;
    if (!integrations.length) return;

    const key = IntegrationReconciler.activeTypeKey(integrations, queryType, activeType);
    if (key === this.prevReconcileKey) return;
    this.prevReconcileKey = key;

    const hasActiveType = integrations.some((integration) => integration.key === activeType);
    const hasQueryType = !!queryType && integrations.some((integration) => integration.key === queryType);
    const nextType = hasQueryType ? queryType : hasActiveType ? activeType : integrations[0].key;

    if (nextType !== activeType) {
      this.setState({ activeType: nextType, selectedProviderId: '', editor: null });
      return;
    }

    if (!hasQueryType && nextType) {
      this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(nextType));
    }
  }

  private reconcileEditor(): void {
    const activeIntegration = this.activeIntegration;
    const { selectedProviderId, editor } = this.state;
    const selectedProviderDefinition = this.selectedProviderDefinition;

    const key = IntegrationReconciler.editorBuildKey(activeIntegration, selectedProviderId, editor, selectedProviderDefinition);
    if (key === this.prevEditorBuildKey) return;
    this.prevEditorBuildKey = key;

    if (!activeIntegration) {
      if (editor) this.setState({ editor: null });
      return;
    }

    if (editor?.isNew) return;

    const providers = activeIntegration.storedProviders || [];
    if (!providers.length) {
      this.setState({ selectedProviderId: '', editor: null });
      return;
    }

    const selected = providers.find((provider) => provider.id === selectedProviderId) || providers[0];

    if (!selectedProviderId || selectedProviderId !== selected.id) {
      this.setState({ selectedProviderId: selected.id });
      return;
    }

    this.setState({
      editor: IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition),
    });
  }

  private reconcileDynamicFieldOptions(): void {
    const editor = this.state.editor;
    const currentProviderDefinition = this.currentProviderDefinition;

    const key = IntegrationReconciler.dynamicKey(currentProviderDefinition, editor);
    if (key === this.prevDynamicKey) return;
    this.prevDynamicKey = key;

    if (!editor || !currentProviderDefinition) {
      this.setState({ dynamicFieldOptions: {}, dynamicFieldErrors: {}, dynamicFieldLoading: {} });
      return;
    }

    const dynamicFields = IntegrationReconciler.dynamicFields(currentProviderDefinition);

    if (!dynamicFields.length) {
      this.setState({ dynamicFieldOptions: {}, dynamicFieldErrors: {}, dynamicFieldLoading: {} });
      return;
    }

    const token = ++this.fieldOptionsLoadToken;
    const providerId = editor.isNew ? '' : editor.providerId;
    const initialLoadingState = IntegrationReconciler.initialLoadingState(this.fieldOptionsService, dynamicFields, providerId, editor.providerKey);

    this.setState({ dynamicFieldLoading: initialLoadingState, dynamicFieldErrors: {} });

    void this.applyFieldOptions(editor, dynamicFields, providerId, token);
  }

  private async applyFieldOptions(
    editor: ProviderEditorState,
    dynamicFields: IntegrationConfigField[],
    providerId: string,
    token: number,
  ): Promise<void> {
    const next = await IntegrationReconciler.loadFieldOptions(this.fieldOptionsService, editor, dynamicFields, providerId);
    if (!this.mounted || token !== this.fieldOptionsLoadToken) return;
    this.setState(next);
  }

  // ---- Actions ----

  private applyIntegrationUpdate(updated: IntegrationRecord): IntegrationRecord {
    this.setState((previous) => {
      const exists = previous.integrations.some((integration) => integration.key === updated.key);
      if (!exists) return null as any;
      return { integrations: previous.integrations.map((integration) => (integration.key === updated.key ? updated : integration)) };
    });
    return updated;
  }

  private activateType(typeKey: string): void {
    const normalized = IntegrationsPageUtils.normalizeKey(typeKey);
    if (!normalized || normalized === this.state.activeType) return;
    this.setState({ activeType: normalized, selectedProviderId: '', editor: null, removeCandidateId: null });
    this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(normalized));
  }

  private async loadIntegrations(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.setState({ loading: true });
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      const sorted = docs
        .filter((doc: any) => doc && typeof doc.key === 'string')
        .sort((a: IntegrationRecord, b: IntegrationRecord) => a.label.localeCompare(b.label));
      if (!this.mounted) return;
      this.setState({ integrations: sorted });
      if (!sorted.length) {
        this.setState({ activeType: '', selectedProviderId: '', editor: null });
        return;
      }

      const queryType = this.state.queryType;
      const preferredType = queryType && sorted.some((integration: IntegrationRecord) => integration.key === queryType)
        ? queryType
        : sorted[0].key;
      this.setState({ activeType: preferredType });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Failed to load integrations',
        message: error?.message || 'Unable to read integration configuration.'
      });
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleResetStaleJavaScript(): Promise<void> {
    if (!IntegrationStaleJsService.isSupported()) return;
    this.setState({ resettingStaleJs: true });

    try {
      await IntegrationStaleJsService.clearCaches();
    } catch (error: any) {
      this.runtime.notify.addNotification({
        type: 'error',
        title: 'Stale JS reset failed',
        message: error?.message || 'Unable to clear cached admin assets.'
      });
      this.setState({ resettingStaleJs: false });
      return;
    }

    IntegrationStaleJsService.reloadWithBuster();
  }

  private startAddProvider(): void {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration?.providers?.length) return;
    const defaultProvider = activeIntegration.providers[0];
    this.setState({
      removeCandidateId: null,
      selectedProviderId: '',
      editor: {
        isNew: true,
        providerId: '',
        providerKey: defaultProvider.key,
        providerName: '',
        enabled: true,
        config: {},
        preservedSecretFields: {}
      },
    });
  }

  private resetEditor(): void {
    const editor = this.state.editor;
    const activeIntegration = this.activeIntegration;
    if (!editor || !activeIntegration) return;
    if (editor.isNew) {
      this.startAddProvider();
      return;
    }

    const selectedProviderDefinition = this.selectedProviderDefinition;
    const selected = (activeIntegration.storedProviders || []).find((provider) => provider.id === editor.providerId);
    if (!selected) return;
    this.setState({
      editor: IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition),
    });
  }

  private cancelNewProvider(): void {
    const firstProvider = this.activeProviders[0];
    this.setState({ editor: null });
    if (firstProvider) {
      this.setState({ selectedProviderId: firstProvider.id });
    }
  }

  private async handleSaveProvider(): Promise<void> {
    const activeIntegration = this.activeIntegration;
    const editor = this.state.editor;
    if (!activeIntegration || !editor) return;
    const addNotification = this.runtime.notify.addNotification;
    const providerDefinition = activeIntegration.providers.find((provider) => provider.key === editor.providerKey);
    if (!providerDefinition) {
      addNotification({
        type: 'error',
        title: 'Invalid provider',
        message: 'Selected provider is not available for this integration type.'
      });
      return;
    }

    const validationErrors = IntegrationProviderFormHelper.validate(providerDefinition.fields || [], editor);
    if (validationErrors.length) {
      addNotification({
        type: 'error',
        title: 'Configuration invalid',
        message: validationErrors[0]
      });
      return;
    }

    this.setState({ saving: true });
    try {
      const payload = IntegrationProviderFormHelper.buildSavePayload(providerDefinition, editor);
      const response = await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION(activeIntegration.key), payload);
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const nextProviderId = IntegrationProviderFormHelper.resolveNextProviderId(updatedIntegration, editor);
      this.setState({ selectedProviderId: nextProviderId, editor: null, removeCandidateId: null });
      addNotification({
        type: 'success',
        title: editor.isNew ? 'Provider added' : 'Provider updated',
        message: `${providerDefinition.label} configuration saved.`
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save failed',
        message: error?.message || 'Unable to save provider configuration.'
      });
    } finally {
      this.setState({ saving: false });
    }
  }

  private async handleToggleProvider(provider: StoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    const addNotification = this.runtime.notify.addNotification;
    this.setState({ changingProviderId: provider.id });
    try {
      const response = await AdminApi.patch(
        AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id),
        { enabled: provider.enabled === false }
      );
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);
      addNotification({
        type: 'success',
        title: 'Provider status updated',
        message: `${provider.name || provider.providerKey} is now ${provider.enabled === false ? 'enabled' : 'disabled'}.`
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Status update failed',
        message: error?.message || 'Unable to change provider status.'
      });
    } finally {
      this.setState({ changingProviderId: null });
    }
  }

  private async handleRemoveProvider(provider: StoredProvider): Promise<void> {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return;
    const addNotification = this.runtime.notify.addNotification;
    this.setState({ changingProviderId: provider.id });
    try {
      const response = await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id));
      const updatedIntegration = IntegrationProviderFormHelper.extractUpdatedIntegration(response);
      this.applyIntegrationUpdate(updatedIntegration);

      const updatedProviders = updatedIntegration.storedProviders || [];
      const nextSelected = updatedProviders[0]?.id || '';
      this.setState({ selectedProviderId: nextSelected, editor: null, removeCandidateId: null });
      addNotification({
        type: 'success',
        title: 'Provider removed',
        message: `${provider.name || provider.providerKey} has been removed.`
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Remove failed',
        message: error?.message || 'Unable to remove provider.'
      });
    } finally {
      this.setState({ changingProviderId: null });
    }
  }

  private patchEditor(patch: Partial<ProviderEditorState> | ((prev: ProviderEditorState) => ProviderEditorState)): void {
    this.setState((previous) => {
      if (!previous.editor) return null as any;
      const nextEditor = typeof patch === 'function' ? patch(previous.editor) : { ...previous.editor, ...patch };
      return { editor: nextEditor };
    });
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const {
      loading,
      saving,
      resettingStaleJs,
      changingProviderId,
      removeCandidateId,
      activeType,
      selectedProviderId,
      editor,
      integrations,
      dynamicFieldOptions,
      dynamicFieldErrors,
      dynamicFieldLoading,
    } = this.state;
    const activeIntegration = this.activeIntegration;
    const activeProviders = this.activeProviders;
    const runtimeProviderId = this.runtimeProviderId;
    const currentProviderDefinition = this.currentProviderDefinition;

    if (loading) {
      return (
        <div className="p-12">
          <Loader label="Loading integration providers..." />
        </div>
      );
    }

    if (!integrations.length) {
      return <IntegrationEmptyState />;
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <IntegrationHeader
          theme={theme}
          activeType={activeType}
          integrationOptions={this.integrationOptions}
          resettingStaleJs={resettingStaleJs}
          onChangeType={(value) => this.activateType(value)}
          onResetStaleJs={() => void this.handleResetStaleJavaScript()}
        />

        <div className="p-8 lg:p-12 space-y-6">
          <Card className="p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeIntegration?.label || 'Integration'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeIntegration?.description || 'Configure provider instances for this integration.'}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <IntegrationProviderList
              activeIntegration={activeIntegration}
              activeProviders={activeProviders}
              selectedProviderId={selectedProviderId}
              editor={editor}
              removeCandidateId={removeCandidateId}
              changingProviderId={changingProviderId}
              runtimeProviderId={runtimeProviderId}
              onAddProvider={() => this.startAddProvider()}
              onSelectProvider={(providerId) => this.setState({ removeCandidateId: null, editor: null, selectedProviderId: providerId })}
              onToggleProvider={(provider) => void this.handleToggleProvider(provider)}
              onRequestRemove={(providerId) => this.setState({ removeCandidateId: providerId })}
              onCancelRemove={() => this.setState({ removeCandidateId: null })}
              onConfirmRemove={(provider) => void this.handleRemoveProvider(provider)}
            />

            <IntegrationProviderEditor
              activeIntegration={activeIntegration}
              editor={editor}
              currentProviderDefinition={currentProviderDefinition}
              saving={saving}
              fieldOptionsService={this.fieldOptionsService}
              dynamicFieldOptions={dynamicFieldOptions}
              dynamicFieldErrors={dynamicFieldErrors}
              dynamicFieldLoading={dynamicFieldLoading}
              patchEditor={(patch) => this.patchEditor(patch)}
              onSubmit={() => void this.handleSaveProvider()}
              onCancel={() => this.cancelNewProvider()}
              onReset={() => this.resetEditor()}
            />
          </div>
        </div>
      </div>
    );
  }
}
