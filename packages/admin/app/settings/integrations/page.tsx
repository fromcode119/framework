"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../components/theme-context';
import { useNotification } from '../../../components/notification-context';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { TextArea } from '../../../components/ui/text-area';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Loader } from '../../../components/ui/loader';
import { FrameworkIcons } from '../../../lib/icons';
import { ENDPOINTS, ROUTES } from '../../../lib/constants';
import { api } from '../../../lib/api';

type IntegrationFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

interface IntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

interface IntegrationProvider {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
}

interface StoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface IntegrationRecord {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: IntegrationProvider[];
  active?: { provider: string; source: string; config: Record<string, any> } | null;
  stored?: { providerKey: string; config: Record<string, any> } | null;
  storedProviders?: StoredProvider[] | null;
}

interface ProviderEditorState {
  isNew: boolean;
  providerId: string;
  providerKey: string;
  providerName: string;
  enabled: boolean;
  config: Record<string, any>;
}

const normalizeKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

const isBlank = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
};

export default function IntegrationsSettingsPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryType = normalizeKey(String(searchParams.get('type') || ''));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingProviderId, setChangingProviderId] = useState<string | null>(null);
  const [removeCandidateId, setRemoveCandidateId] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [activeType, setActiveType] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [editor, setEditor] = useState<ProviderEditorState | null>(null);

  const integrationOptions = useMemo(
    () =>
      integrations.map((integration) => ({
        label: integration.label,
        value: integration.key
      })),
    [integrations]
  );

  const activeIntegration = useMemo(
    () => integrations.find((integration) => integration.key === activeType) || null,
    [integrations, activeType]
  );

  const activeProviders = useMemo(
    () => activeIntegration?.storedProviders || [],
    [activeIntegration]
  );

  const runtimeProviderId = useMemo(() => {
    if (!activeIntegration) return '';
    const runtimeKey = String(activeIntegration.active?.provider || activeIntegration.stored?.providerKey || '').trim();
    if (!runtimeKey) return '';
    const match = (activeIntegration.storedProviders || []).find(
      (provider) => provider.enabled !== false && provider.providerKey === runtimeKey
    );
    return match?.id || '';
  }, [activeIntegration]);

  const currentProviderDefinition = useMemo(() => {
    if (!activeIntegration || !editor?.providerKey) return null;
    return activeIntegration.providers.find((provider) => provider.key === editor.providerKey) || null;
  }, [activeIntegration, editor?.providerKey]);

  const applyIntegrationUpdate = (updated: IntegrationRecord): IntegrationRecord => {
    setIntegrations((previous) => {
      const exists = previous.some((integration) => integration.key === updated.key);
      if (!exists) return previous;
      return previous.map((integration) => (integration.key === updated.key ? updated : integration));
    });
    return updated;
  };

  const activateType = (typeKey: string) => {
    const normalized = normalizeKey(typeKey);
    if (!normalized || normalized === activeType) return;
    setSelectedProviderId('');
    setEditor(null);
    setRemoveCandidateId(null);
    router.replace(ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(normalized));
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await api.get(ENDPOINTS.SYSTEM.INTEGRATIONS);
      const docs = Array.isArray(response?.docs) ? response.docs : [];
      const sorted = docs
        .filter((doc: any) => doc && typeof doc.key === 'string')
        .sort((a: IntegrationRecord, b: IntegrationRecord) => a.label.localeCompare(b.label));
      setIntegrations(sorted);
      if (!sorted.length) {
        setActiveType('');
        setSelectedProviderId('');
        setEditor(null);
        return;
      }

      const preferredType = queryType && sorted.some((integration: IntegrationRecord) => integration.key === queryType)
        ? queryType
        : sorted[0].key;
      setActiveType(preferredType);
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Failed to load integrations',
        message: error?.message || 'Unable to read integration configuration.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!integrations.length) return;

    const hasActiveType = integrations.some((integration) => integration.key === activeType);
    const hasQueryType = !!queryType && integrations.some((integration) => integration.key === queryType);
    const nextType = hasQueryType ? queryType : hasActiveType ? activeType : integrations[0].key;

    if (nextType !== activeType) {
      setActiveType(nextType);
      setSelectedProviderId('');
      setEditor(null);
      return;
    }

    if (!hasQueryType && nextType) {
      router.replace(ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(nextType));
    }
  }, [integrations, queryType, activeType, router]);

  useEffect(() => {
    if (!activeIntegration) {
      setEditor(null);
      return;
    }

    if (editor?.isNew) return;

    const providers = activeIntegration.storedProviders || [];
    if (!providers.length) {
      setSelectedProviderId('');
      setEditor(null);
      return;
    }

    const selected =
      providers.find((provider) => provider.id === selectedProviderId) ||
      providers[0];

    if (!selectedProviderId || selectedProviderId !== selected.id) {
      setSelectedProviderId(selected.id);
      return;
    }

    setEditor({
      isNew: false,
      providerId: selected.id,
      providerKey: selected.providerKey,
      providerName: selected.name || '',
      enabled: selected.enabled !== false,
      config: { ...(selected.config || {}) }
    });
  }, [activeIntegration, selectedProviderId, editor?.isNew]);

  const startAddProvider = () => {
    if (!activeIntegration?.providers?.length) return;
    const defaultProvider = activeIntegration.providers[0];
    setRemoveCandidateId(null);
    setSelectedProviderId('');
    setEditor({
      isNew: true,
      providerId: '',
      providerKey: defaultProvider.key,
      providerName: '',
      enabled: true,
      config: {}
    });
  };

  const resetEditor = () => {
    if (!editor || !activeIntegration) return;
    if (editor.isNew) {
      startAddProvider();
      return;
    }

    const selected = (activeIntegration.storedProviders || []).find((provider) => provider.id === editor.providerId);
    if (!selected) return;
    setEditor({
      isNew: false,
      providerId: selected.id,
      providerKey: selected.providerKey,
      providerName: selected.name || '',
      enabled: selected.enabled !== false,
      config: { ...(selected.config || {}) }
    });
  };

  const cancelNewProvider = () => {
    setEditor(null);
    const firstProvider = activeProviders[0];
    if (firstProvider) {
      setSelectedProviderId(firstProvider.id);
    }
  };

  const handleSaveProvider = async () => {
    if (!activeIntegration || !editor) return;
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
      if (field.required && isBlank(value)) {
        validationErrors.push(`${field.label} is required.`);
      }
      if (field.type === 'number' && !isBlank(value) && Number.isNaN(Number(value))) {
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

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        provider: editor.providerKey,
        config: editor.config || {},
        enabled: editor.enabled
      };
      if (!editor.isNew && editor.providerId) payload.providerId = editor.providerId;
      if (editor.providerName.trim()) payload.providerName = editor.providerName.trim();

      const response = await api.put(ENDPOINTS.SYSTEM.INTEGRATION(activeIntegration.key), payload);
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
      applyIntegrationUpdate(updatedIntegration);

      const updatedProviders = updatedIntegration.storedProviders || [];
      let nextProviderId = '';

      if (!editor.isNew && editor.providerId) {
        nextProviderId = editor.providerId;
      } else if (editor.isNew) {
        const reverseCandidates = [...updatedProviders].reverse();
        const byName = editor.providerName.trim()
          ? reverseCandidates.find(
              (provider) =>
                provider.providerKey === editor.providerKey &&
                String(provider.name || '').trim() === editor.providerName.trim()
            )
          : undefined;
        nextProviderId =
          byName?.id ||
          reverseCandidates.find((provider) => provider.providerKey === editor.providerKey)?.id ||
          updatedProviders[updatedProviders.length - 1]?.id ||
          '';
      }

      if (!nextProviderId && updatedProviders.length) {
        nextProviderId = updatedProviders[0].id;
      }

      setSelectedProviderId(nextProviderId);
      setEditor(null);
      setRemoveCandidateId(null);
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
      setSaving(false);
    }
  };

  const handleToggleProvider = async (provider: StoredProvider) => {
    if (!activeIntegration) return;
    setChangingProviderId(provider.id);
    try {
      const response = await api.patch(
        ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id),
        { enabled: provider.enabled === false }
      );
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
      applyIntegrationUpdate(updatedIntegration);
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
      setChangingProviderId(null);
    }
  };

  const handleRemoveProvider = async (provider: StoredProvider) => {
    if (!activeIntegration) return;
    setChangingProviderId(provider.id);
    try {
      const response = await api.delete(ENDPOINTS.SYSTEM.INTEGRATION_PROVIDER(activeIntegration.key, provider.id));
      const updatedIntegration = response?.integration as IntegrationRecord;
      if (!updatedIntegration?.key) {
        throw new Error('Integration update returned an invalid response.');
      }
      applyIntegrationUpdate(updatedIntegration);

      const updatedProviders = updatedIntegration.storedProviders || [];
      const nextSelected = updatedProviders[0]?.id || '';
      setSelectedProviderId(nextSelected);
      setEditor(null);
      setRemoveCandidateId(null);
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
      setChangingProviderId(null);
    }
  };

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
          <div className="w-full lg:w-[360px]">
            <Select
              value={activeType}
              onChange={activateType}
              options={integrationOptions}
              placeholder="Select integration..."
              searchable={false}
              size="md"
            />
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
                onClick={startAddProvider}
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
                        setRemoveCandidateId(null);
                        setEditor(null);
                        setSelectedProviderId(provider.id);
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
                          if (!isChanging) void handleToggleProvider(provider);
                        }}
                        disabled={isChanging}
                      />
                      {!pendingRemove ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<FrameworkIcons.Trash size={14} />}
                          onClick={() => setRemoveCandidateId(provider.id)}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          Remove
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleRemoveProvider(provider)}
                            isLoading={isChanging}
                          >
                            Confirm
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setRemoveCandidateId(null)}>
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
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    value={editor.providerKey}
                    onChange={(providerKey) =>
                      setEditor((previous) =>
                        previous
                          ? {
                              ...previous,
                              providerKey,
                              config: {}
                            }
                          : previous
                      )
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
                      setEditor((previous) =>
                        previous
                          ? {
                              ...previous,
                              providerName: event.target.value
                            }
                          : previous
                      )
                    }
                    label="Display Name (Optional)"
                    placeholder="e.g. SMTP - Marketing"
                    size="md"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                  <Switch
                    checked={editor.enabled}
                    onChange={(value) =>
                      setEditor((previous) =>
                        previous
                          ? {
                              ...previous,
                              enabled: value
                            }
                          : previous
                      )
                    }
                    label="Enabled"
                    description="Enabled providers are available at runtime."
                  />
                </div>

                {(currentProviderDefinition?.fields || []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(currentProviderDefinition?.fields || []).map((field) => {
                      const value = editor.config?.[field.name];
                      const setFieldValue = (nextValue: any) =>
                        setEditor((previous) =>
                          previous
                            ? {
                                ...previous,
                                config: {
                                  ...previous.config,
                                  [field.name]: nextValue
                                }
                              }
                            : previous
                        );

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
                        const options = (field.options || []).map((option) => ({
                          label: option.label,
                          value: option.value
                        }));
                        return (
                          <div key={field.name}>
                            <Select
                              value={String(value ?? '')}
                              onChange={setFieldValue}
                              options={options}
                              label={`${field.label}${field.required ? ' *' : ''}`}
                              searchable={false}
                              size="md"
                            />
                            {field.description && (
                              <p className="mt-1 text-[11px] text-slate-500">{field.description}</p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={field.name}>
                          <Input
                            label={`${field.label}${field.required ? ' *' : ''}`}
                            placeholder={field.placeholder}
                            value={String(value ?? '')}
                            onChange={(event) => setFieldValue(event.target.value)}
                            type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            size="md"
                          />
                          {field.description && (
                            <p className="mt-1 text-[11px] text-slate-500">{field.description}</p>
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
                    <Button variant="secondary" onClick={cancelNewProvider}>
                      Cancel
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={resetEditor}>
                      Reset
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    icon={<FrameworkIcons.Save size={14} />}
                    onClick={() => void handleSaveProvider()}
                    isLoading={saving}
                  >
                    {editor.isNew ? 'Add Provider' : 'Save Provider'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
