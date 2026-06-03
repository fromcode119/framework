"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/loader';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import { AdminApi } from '@/lib/api';
import { IntegrationsPageUtils } from './IntegrationsPageUtils';
import { IntegrationsFieldOptionsService } from './integrations-field-options-service';
import { AdminComponent } from '@/components/admin-component';
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
    return this.state.integrations.map((integration) => ({
      label: integration.label,
      value: integration.key
    }));
  }

  private get activeIntegration(): IntegrationRecord | null {
    return this.state.integrations.find((integration) => integration.key === this.state.activeType) || null;
  }

  private get activeProviders(): StoredProvider[] {
    return this.activeIntegration?.storedProviders || [];
  }

  private get runtimeProviderId(): string {
    const activeIntegration = this.activeIntegration;
    if (!activeIntegration) return '';
    const runtimeKey = String(activeIntegration.active?.provider || activeIntegration.stored?.providerKey || '').trim();
    if (!runtimeKey) return '';
    const match = (activeIntegration.storedProviders || []).find(
      (provider) => provider.enabled !== false && provider.providerKey === runtimeKey
    );
    return match?.id || '';
  }

  private get currentProviderDefinition(): IntegrationProvider | null {
    const activeIntegration = this.activeIntegration;
    const editor = this.state.editor;
    if (!activeIntegration || !editor?.providerKey) return null;
    return activeIntegration.providers.find((provider) => provider.key === editor.providerKey) || null;
  }

  private get selectedProviderDefinition(): IntegrationProvider | null {
    const activeIntegration = this.activeIntegration;
    const selectedProviderId = this.state.selectedProviderId;
    if (!activeIntegration || !selectedProviderId) return null;
    const selectedProvider = (activeIntegration.storedProviders || []).find((provider) => provider.id === selectedProviderId);
    if (!selectedProvider) return null;
    return activeIntegration.providers.find((provider) => provider.key === selectedProvider.providerKey) || null;
  }

  // ---- Effect reconciliation ----

  private reconcileActiveType(): void {
    const { integrations, queryType, activeType } = this.state;
    if (!integrations.length) return;

    const key = JSON.stringify({ ids: integrations.map((i) => i.key), queryType, activeType });
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

    const key = JSON.stringify({
      activeKey: activeIntegration?.key || '',
      providers: (activeIntegration?.storedProviders || []).map((p) => p.id),
      selectedProviderId,
      isNew: editor?.isNew ?? null,
      defFields: (selectedProviderDefinition?.fields || []).map((f) => f.name),
    });
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
      editor: {
        isNew: false,
        providerId: selected.id,
        providerKey: selected.providerKey,
        providerName: selected.name || '',
        enabled: selected.enabled !== false,
        config: IntegrationsPageUtils.copyConfigWithoutSavedSecrets(selectedProviderDefinition?.fields || [], selected.config || {}),
        preservedSecretFields: IntegrationsPageUtils.readPreservedSecretFields(selectedProviderDefinition?.fields || [], selected.config || {}),
      },
    });
  }

  private reconcileDynamicFieldOptions(): void {
    const editor = this.state.editor;
    const currentProviderDefinition = this.currentProviderDefinition;

    const key = JSON.stringify({
      defKey: currentProviderDefinition?.key || '',
      editorId: editor ? editor.providerId : null,
      editorKey: editor?.providerKey ?? null,
      isNew: editor?.isNew ?? null,
      config: editor?.config ?? null,
    });
    if (key === this.prevDynamicKey) return;
    this.prevDynamicKey = key;

    if (!editor || !currentProviderDefinition) {
      this.setState({ dynamicFieldOptions: {}, dynamicFieldErrors: {}, dynamicFieldLoading: {} });
      return;
    }

    const dynamicFields = (currentProviderDefinition.fields || []).filter(
      (field) => field.type === 'select' && !!field.optionsEndpoint
    );

    if (!dynamicFields.length) {
      this.setState({ dynamicFieldOptions: {}, dynamicFieldErrors: {}, dynamicFieldLoading: {} });
      return;
    }

    const token = ++this.fieldOptionsLoadToken;
    const providerId = editor.isNew ? '' : editor.providerId;
    const initialLoadingState = dynamicFields.reduce<Record<string, boolean>>((acc, field) => {
      acc[this.fieldOptionsService.buildFieldStateKey(providerId, editor.providerKey, field.name)] = !!providerId;
      return acc;
    }, {});

    this.setState({ dynamicFieldLoading: initialLoadingState, dynamicFieldErrors: {} });

    void this.loadFieldOptions(editor, dynamicFields, providerId, token);
  }

  private async loadFieldOptions(
    editor: ProviderEditorState,
    dynamicFields: IntegrationConfigField[],
    providerId: string,
    token: number,
  ): Promise<void> {
    const nextOptions: Record<string, Array<{ label: string; value: string }>> = {};
    const nextErrors: Record<string, string> = {};
    const nextLoading: Record<string, boolean> = {};

    for (const field of dynamicFields) {
      const fieldKey = this.fieldOptionsService.buildFieldStateKey(providerId, editor.providerKey, field.name);
      nextLoading[fieldKey] = false;

      if (!providerId) {
        nextOptions[fieldKey] = this.fieldOptionsService.ensureValueOption(field.options || [], editor.config?.[field.name]);
        continue;
      }

      try {
        const loadedOptions = await this.fieldOptionsService.loadOptions(field, {
          providerId,
          providerKey: editor.providerKey
        });
        nextOptions[fieldKey] = this.fieldOptionsService.ensureValueOption(loadedOptions, editor.config?.[field.name]);
      } catch (error: any) {
        nextOptions[fieldKey] = this.fieldOptionsService.ensureValueOption(field.options || [], editor.config?.[field.name]);
        nextErrors[fieldKey] = error?.message || 'Unable to load options.';
      }
    }

    if (!this.mounted || token !== this.fieldOptionsLoadToken) {
      return;
    }

    this.setState({ dynamicFieldOptions: nextOptions, dynamicFieldErrors: nextErrors, dynamicFieldLoading: nextLoading });
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
    this.setState({ selectedProviderId: '', editor: null, removeCandidateId: null });
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
    if (typeof window === 'undefined') return;
    const addNotification = this.runtime.notify.addNotification;

    this.setState({ resettingStaleJs: true });

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Stale JS reset failed',
        message: error?.message || 'Unable to clear cached admin assets.'
      });
      this.setState({ resettingStaleJs: false });
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('fc_js_reset', Date.now().toString());
    window.location.replace(nextUrl.toString());
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
      editor: {
        isNew: false,
        providerId: selected.id,
        providerKey: selected.providerKey,
        providerName: selected.name || '',
        enabled: selected.enabled !== false,
        config: IntegrationsPageUtils.copyConfigWithoutSavedSecrets(selectedProviderDefinition?.fields || [], selected.config || {}),
        preservedSecretFields: IntegrationsPageUtils.readPreservedSecretFields(selectedProviderDefinition?.fields || [], selected.config || {}),
      },
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

    const validationErrors: string[] = [];
    for (const field of providerDefinition.fields || []) {
      const value = editor.config?.[field.name];
      const hasSavedSecret = field.type === 'password' && editor.preservedSecretFields?.[field.name] === true;
      if (field.required && IntegrationsPageUtils.isBlank(value) && !hasSavedSecret) {
        validationErrors.push(`${field.label} is required.`);
      }
      if (field.type === 'number' && !IntegrationsPageUtils.isBlank(value) && Number.isNaN(Number(value))) {
        validationErrors.push(`${field.label} must be a valid number.`);
      }
    }

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
      const payload: Record<string, any> = {
        provider: editor.providerKey,
        config: IntegrationsPageUtils.copyConfigForFields(providerDefinition.fields || [], editor.config || {}),
        enabled: editor.enabled
      };
      if (!editor.isNew && editor.providerId) payload.providerId = editor.providerId;
      if (editor.providerName.trim()) payload.providerName = editor.providerName.trim();

      const response = await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.INTEGRATION(activeIntegration.key), payload);
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
      this.applyIntegrationUpdate(updatedIntegration);

      const updatedProviders = updatedIntegration.storedProviders || [];
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
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
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
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
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
      return (
        <div className="p-8 lg:p-12">
          <Card className="p-10 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <FrameworkIcons.Orbit size={22} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">No integration types registered</h2>
            <p className="mt-2 text-sm text-slate-500">
              Register at least one integration type in the API runtime to configure providers.
            </p>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <div
          className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 ${
            theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Integrations
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 tracking-tight">
                Add providers, configure each instance, and enable or disable them individually.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px] lg:flex-row lg:items-center lg:justify-end">
              <div className="w-full lg:w-[360px]">
                <Select
                  value={activeType}
                  onChange={(value) => this.activateType(value)}
                  options={this.integrationOptions}
                  placeholder="Select integration..."
                  searchable={false}
                  size="md"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                icon={<FrameworkIcons.Refresh size={14} />}
                onClick={() => void this.handleResetStaleJavaScript()}
                isLoading={resettingStaleJs}
                className="w-full lg:w-auto"
              >
                Reset Stale JS
              </Button>
            </div>
          </div>
        </div>

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
            <Card className="xl:col-span-4" noPadding>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Provider Instances</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Multiple providers are supported, including duplicate provider types.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FrameworkIcons.Plus size={14} />}
                  onClick={() => this.startAddProvider()}
                >
                  Add
                </Button>
              </div>

              <div className="p-4 space-y-3">
                {activeProviders.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No providers configured.</p>
                    <p className="text-xs text-slate-500 mt-1">Add your first provider instance to continue.</p>
                  </div>
                )}

                {activeProviders.map((provider) => {
                  const providerMeta = activeIntegration?.providers.find((item) => item.key === provider.providerKey);
                  const selected = selectedProviderId === provider.id && !editor?.isNew;
                  const enabled = provider.enabled !== false;
                  const pendingRemove = removeCandidateId === provider.id;
                  const isChanging = changingProviderId === provider.id;

                  return (
                    <div
                      key={provider.id}
                      className={`rounded-xl border transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          this.setState({ removeCandidateId: null, editor: null, selectedProviderId: provider.id });
                        }}
                        className="w-full text-left px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                              {provider.name || providerMeta?.label || provider.providerKey.toUpperCase()}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate mt-1">
                              {provider.providerKey}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {runtimeProviderId === provider.id && <Badge variant="info">Runtime</Badge>}
                            <Badge variant={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                          </div>
                        </div>
                      </button>

                      <div className="px-4 pb-3 flex items-center justify-between gap-3">
                        <Switch
                          checked={enabled}
                          onChange={() => {
                            if (!isChanging) void this.handleToggleProvider(provider);
                          }}
                          disabled={isChanging}
                        />
                        {!pendingRemove ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FrameworkIcons.Trash size={14} />}
                            onClick={() => this.setState({ removeCandidateId: provider.id })}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            Remove
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void this.handleRemoveProvider(provider)}
                              isLoading={isChanging}
                            >
                              Confirm
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => this.setState({ removeCandidateId: null })}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="xl:col-span-8" noPadding>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {editor?.isNew ? 'Add Provider' : 'Provider Configuration'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure credentials and behavior for this provider instance.
                </p>
              </div>

              {!editor ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select a provider instance.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Or add a new provider to create an additional configuration.
                  </p>
                </div>
              ) : (
                <form
                  className="p-5 space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void this.handleSaveProvider();
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      value={editor.providerKey}
                      onChange={(providerKey) =>
                        this.patchEditor((previous) => ({
                          ...previous,
                          providerKey,
                          config: {}
                        }))
                      }
                      options={(activeIntegration?.providers || []).map((provider) => ({
                        label: provider.label,
                        value: provider.key
                      }))}
                      label="Provider Type"
                      searchable={false}
                      size="md"
                    />
                    <Input
                      value={editor.providerName}
                      onChange={(event) =>
                        this.patchEditor((previous) => ({
                          ...previous,
                          providerName: event.target.value
                        }))
                      }
                      label="Display Name (Optional)"
                      placeholder="e.g. SMTP - Marketing"
                      autoComplete="off"
                      size="md"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                    <Switch
                      checked={editor.enabled}
                      onChange={(value) =>
                        this.patchEditor((previous) => ({
                          ...previous,
                          enabled: value ?? false
                        }))
                      }
                      label="Enabled"
                      description="Enabled providers are available at runtime."
                    />
                  </div>

                  {(currentProviderDefinition?.fields || []).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(currentProviderDefinition?.fields || []).map((field) => {
                        const value = editor.config?.[field.name];
                        const hasSavedSecret = field.type === 'password' && editor.preservedSecretFields?.[field.name] === true;
                        const setFieldValue = (nextValue: any) =>
                          this.patchEditor((previous) => ({
                            ...previous,
                            preservedSecretFields: field.type === 'password'
                              ? { ...previous.preservedSecretFields, [field.name]: false }
                              : previous.preservedSecretFields,
                            config: {
                              ...previous.config,
                              [field.name]: nextValue
                            }
                          }));

                        if (field.type === 'boolean') {
                          return (
                            <div key={field.name} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 md:col-span-2">
                              <Switch
                                checked={!!value}
                                onChange={setFieldValue}
                                label={field.label}
                                description={field.description}
                              />
                            </div>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <TextArea
                              key={field.name}
                              label={`${field.label}${field.required ? ' *' : ''}`}
                              placeholder={field.placeholder}
                              value={String(value ?? '')}
                              onChange={(event) => setFieldValue(event.target.value)}
                              className="md:col-span-2"
                              size="md"
                            />
                          );
                        }

                        if (field.type === 'select') {
                          const fieldStateKey = this.fieldOptionsService.buildFieldStateKey(
                            editor.isNew ? '' : editor.providerId,
                            editor.providerKey,
                            field.name
                          );
                          const hasDynamicOptions = !!field.optionsEndpoint;
                          const options = this.fieldOptionsService.ensureValueOption(
                            dynamicFieldOptions[fieldStateKey] || (field.options || []).map((option) => ({
                              label: option.label,
                              value: option.value
                            })),
                            value
                          );
                          const isDynamicFieldLoading = !!dynamicFieldLoading[fieldStateKey];
                          const dynamicFieldError = dynamicFieldErrors[fieldStateKey];
                          const helperText = isDynamicFieldLoading
                            ? 'Loading options...'
                            : dynamicFieldError
                              ? dynamicFieldError
                              : !editor.providerId && hasDynamicOptions
                                ? 'Save this provider first to load the office list.'
                                : field.description;
                          return (
                            <div key={field.name}>
                              <Select
                                value={String(value ?? '')}
                                onChange={setFieldValue}
                                options={options}
                                label={`${field.label}${field.required ? ' *' : ''}`}
                                searchable={field.searchable !== false}
                                size="md"
                                disabled={isDynamicFieldLoading || (!editor.providerId && hasDynamicOptions)}
                                placeholder={isDynamicFieldLoading ? 'Loading options...' : undefined}
                              />
                              {helperText && (
                                <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={field.name}>
                            <Input
                              label={`${field.label}${field.required ? ' *' : ''}`}
                              placeholder={field.type === 'password' && !editor.isNew ? 'Leave blank to keep the saved secret' : field.placeholder}
                              value={String(value ?? '')}
                              onChange={(event) => setFieldValue(event.target.value)}
                              type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                              autoComplete={IntegrationsPageUtils.resolveFieldAutocomplete(field)}
                              step={field.type === 'number' ? 'any' : undefined}
                              size="md"
                            />
                            {field.type === 'password' && hasSavedSecret && (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                                <FrameworkIcons.CheckCircle size={12} />
                                <span>Saved securely. Leave this field blank to keep the current secret.</span>
                              </div>
                            )}
                            {(field.description || (field.type === 'password' && !editor.isNew)) && (
                              <p className="mt-1 text-[11px] text-slate-500">
                                {field.description || 'Leave this field blank to keep the saved secret.'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No fields required</p>
                      <p className="text-xs text-slate-500 mt-1">
                        This provider does not define custom configuration fields.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {editor.isNew ? (
                      <Button type="button" variant="secondary" onClick={() => this.cancelNewProvider()}>
                        Cancel
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" onClick={() => this.resetEditor()}>
                        Reset
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      icon={<FrameworkIcons.Save size={14} />}
                      isLoading={saving}
                    >
                      {editor.isNew ? 'Add Provider' : 'Save Provider'}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }
}
