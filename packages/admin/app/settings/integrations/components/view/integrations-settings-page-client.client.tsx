import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import { IntegrationsFieldOptionsService } from '@/app/settings/integrations/integrations-field-options-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { IntegrationProviderList } from '@/app/settings/integrations/integration-provider-list';
import { IntegrationProviderEditor } from '@/app/settings/integrations/integration-provider-editor';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationReconciler } from '@/app/settings/integrations/integration-reconciler';
import { IntegrationHeader } from '@/app/settings/integrations/integration-header';
import { IntegrationEmptyState } from '@/app/settings/integrations/integration-empty-state';
import { IntegrationSelectors } from '@/app/settings/integrations/integration-selectors';
import { IntegrationStaleJsService } from '@/app/settings/integrations/integration-stale-js-service';
import { prop, state } from '@fromcode119/reactor';
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';

export class IntegrationsSettingsPageClient extends AdminComponent {
  @prop declare searchParams?: Promise<Record<string, string | string[]>>;

  @state queryType = '';
  @state resolved = false;
  @state loading = true;
  @state saving = false;
  @state resettingStaleJs = false;
  @state changingProviderId: string | null = null;
  @state removeCandidateId: string | null = null;
  @state integrations: IIntegrationRecord[] = [];
  @state activeType = '';
  @state selectedProviderId = '';
  @state editor: IProviderEditorState | null = null;
  @state dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>> = {};
  @state dynamicFieldErrors: Record<string, string> = {};
  @state dynamicFieldLoading: Record<string, boolean> = {};

  private mounted = false;
  private readonly fieldOptionsService = new IntegrationsFieldOptionsService();
  private fieldOptionsLoadToken = 0;
  private prevReconcileKey = '';
  private prevEditorBuildKey = '';
  private prevDynamicKey = '';

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const searchParams = this.searchParams ? await this.searchParams : undefined;
    if (!this.mounted) return;
    this.queryType = IntegrationsPageUtils.normalizeKey(String(searchParams?.type || ''));
    this.resolved = true;
    void this.loadIntegrations();
  }

  componentDidUpdate(): void {
    if (!this.resolved) return;
    this.reconcileActiveType();
    this.reconcileEditor();
    this.reconcileDynamicFieldOptions();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  // ---- Derived selectors (replace useMemo) ----

  private get integrationOptions(): Array<{ label: string; value: string }> {
    return IntegrationSelectors.integrationOptions(this.integrations);
  }

  private get activeIntegration(): IIntegrationRecord | null {
    return IntegrationSelectors.activeIntegration(this.integrations, this.activeType);
  }

  private get activeProviders(): IStoredProvider[] {
    return IntegrationSelectors.activeProviders(this.activeIntegration);
  }

  private get runtimeProviderId(): string {
    return IntegrationSelectors.runtimeProviderId(this.activeIntegration);
  }

  private get currentProviderDefinition(): IIntegrationProvider | null {
    return IntegrationSelectors.currentProviderDefinition(this.activeIntegration, this.editor);
  }

  private get selectedProviderDefinition(): IIntegrationProvider | null {
    return IntegrationSelectors.selectedProviderDefinition(this.activeIntegration, this.selectedProviderId);
  }

  // ---- Effect reconciliation ----

  private reconcileActiveType(): void {
    const { integrations, queryType, activeType } = this;
    if (!integrations.length) return;

    const key = IntegrationReconciler.activeTypeKey(integrations, queryType, activeType);
    if (key === this.prevReconcileKey) return;
    this.prevReconcileKey = key;

    const hasActiveType = integrations.some((integration) => integration.key === activeType);
    const hasQueryType = !!queryType && integrations.some((integration) => integration.key === queryType);
    const nextType = hasQueryType ? queryType : hasActiveType ? activeType : integrations[0].key;

    if (nextType !== activeType) {
      this.activeType = nextType;
      this.selectedProviderId = '';
      this.editor = null;
      return;
    }

    if (!hasQueryType && nextType) {
      this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(nextType));
    }
  }

  private reconcileEditor(): void {
    const activeIntegration = this.activeIntegration;
    const { selectedProviderId, editor } = this;
    const selectedProviderDefinition = this.selectedProviderDefinition;

    const key = IntegrationReconciler.editorBuildKey(activeIntegration, selectedProviderId, editor, selectedProviderDefinition);
    if (key === this.prevEditorBuildKey) return;
    this.prevEditorBuildKey = key;

    if (!activeIntegration) {
      if (editor) this.editor = null;
      return;
    }

    if (editor?.isNew) return;

    const providers = activeIntegration.storedProviders || [];
    if (!providers.length) {
      this.selectedProviderId = '';
      this.editor = null;
      return;
    }

    const selected = providers.find((provider) => provider.id === selectedProviderId) || providers[0];

    if (!selectedProviderId || selectedProviderId !== selected.id) {
      this.selectedProviderId = selected.id;
      return;
    }

    this.editor = IntegrationProviderFormHelper.buildEditorForProvider(selected, selectedProviderDefinition);
  }

  private reconcileDynamicFieldOptions(): void {
    const editor = this.editor;
    const currentProviderDefinition = this.currentProviderDefinition;

    const key = IntegrationReconciler.dynamicKey(currentProviderDefinition, editor);
    if (key === this.prevDynamicKey) return;
    this.prevDynamicKey = key;

    if (!editor || !currentProviderDefinition) {
      this.dynamicFieldOptions = {};
      this.dynamicFieldErrors = {};
      this.dynamicFieldLoading = {};
      return;
    }

    const dynamicFields = IntegrationReconciler.dynamicFields(currentProviderDefinition);

    if (!dynamicFields.length) {
      this.dynamicFieldOptions = {};
      this.dynamicFieldErrors = {};
      this.dynamicFieldLoading = {};
      return;
    }

    const token = ++this.fieldOptionsLoadToken;
    const providerId = editor.isNew ? '' : editor.providerId;
    const initialLoadingState = IntegrationReconciler.initialLoadingState(this.fieldOptionsService, dynamicFields, providerId, editor.providerKey);

    this.dynamicFieldLoading = initialLoadingState;
    this.dynamicFieldErrors = {};

    void this.applyFieldOptions(editor, dynamicFields, providerId, token);
  }

  private async applyFieldOptions(
    editor: IProviderEditorState,
    dynamicFields: IIntegrationConfigField[],
    providerId: string,
    token: number,
  ): Promise<void> {
    const next = await IntegrationReconciler.loadFieldOptions(this.fieldOptionsService, editor, dynamicFields, providerId);
    if (!this.mounted || token !== this.fieldOptionsLoadToken) return;
    this.dynamicFieldOptions = next.dynamicFieldOptions;
    this.dynamicFieldErrors = next.dynamicFieldErrors;
    this.dynamicFieldLoading = next.dynamicFieldLoading;
  }

  // ---- Actions ----

  private applyIntegrationUpdate(updated: IIntegrationRecord): IIntegrationRecord {
    const exists = this.integrations.some((integration) => integration.key === updated.key);
    if (exists) {
      this.integrations = this.integrations.map((integration) => (integration.key === updated.key ? updated : integration));
    }
    return updated;
  }

  private activateType(typeKey: string): void {
    const normalized = IntegrationsPageUtils.normalizeKey(typeKey);
    if (!normalized || normalized === this.activeType) return;
    this.activeType = normalized;
    this.selectedProviderId = '';
    this.editor = null;
    this.removeCandidateId = null;
    this.router.replace(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(normalized));
  }

  private async loadIntegrations(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.loading = true;
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      const sorted = docs
        .filter((doc: any) => doc && typeof doc.key === 'string')
        .sort((a: IIntegrationRecord, b: IIntegrationRecord) => a.label.localeCompare(b.label));
      sorted.forEach((integration: any) => integration.providers?.forEach((p: any) => p.fields?.forEach((fld: any) => { fld.type = IntegrationFieldType.resolve(fld.type); })));
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

  private async handleResetStaleJavaScript(): Promise<void> {
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

  private startAddProvider(): void {
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

  private resetEditor(): void {
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

  private cancelNewProvider(): void {
    const firstProvider = this.activeProviders[0];
    this.editor = null;
    if (firstProvider) {
      this.selectedProviderId = firstProvider.id;
    }
  }

  private async handleSaveProvider(): Promise<void> {
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

  private async handleToggleProvider(provider: IStoredProvider): Promise<void> {
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

  private async handleRemoveProvider(provider: IStoredProvider): Promise<void> {
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

  private patchEditor(patch: Partial<IProviderEditorState> | ((prev: IProviderEditorState) => IProviderEditorState)): void {
    const previous = this.editor;
    if (!previous) return;
    this.editor = typeof patch === 'function' ? patch(previous) : { ...previous, ...patch };
  }

  render(): ReactElement {
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
    } = this;
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
              onSelectProvider={(providerId) => {
                this.removeCandidateId = null;
                this.editor = null;
                this.selectedProviderId = providerId;
              }}
              onToggleProvider={(provider) => void this.handleToggleProvider(provider)}
              onRequestRemove={(providerId) => { this.removeCandidateId = providerId; }}
              onCancelRemove={() => { this.removeCandidateId = null; }}
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
