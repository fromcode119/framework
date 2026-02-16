"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader } from '@/components/ui/loader';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { useNotification } from '@/components/notification-context';

type IntegrationField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';
  description?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

type IntegrationProvider = {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationField[];
};

type IntegrationDoc = {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: IntegrationProvider[];
  active?: {
    provider: string;
    source: 'stored' | 'env' | 'default';
    config?: Record<string, any>;
  } | null;
  stored?: {
    providerKey: string;
    config: Record<string, any>;
  } | null;
};

function buildConfigSeed(provider: IntegrationProvider | undefined, source: Record<string, any>) {
  const next: Record<string, any> = {};
  const fields = provider?.fields || [];

  for (const field of fields) {
    const incoming = source?.[field.name];
    if (incoming !== undefined && incoming !== null) {
      next[field.name] = incoming;
      continue;
    }

    if (field.type === 'boolean') {
      next[field.name] = false;
      continue;
    }

    if (field.type === 'number') {
      next[field.name] = '';
      continue;
    }

    next[field.name] = '';
  }

  return next;
}

function toBoolean(value: any) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export default function IntegrationsSettingsPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [docs, setDocs] = useState<IntegrationDoc[]>([]);
  const [selectedTypeKey, setSelectedTypeKey] = useState('');
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [draftConfig, setDraftConfig] = useState<Record<string, any>>({});
  const [view, setView] = useState<'grid' | 'edit'>('grid');

  const selectedType = useMemo(
    () => docs.find((doc) => doc.key === selectedTypeKey) || null,
    [docs, selectedTypeKey]
  );

  const selectedProvider = useMemo(
    () => selectedType?.providers?.find((provider) => provider.key === selectedProviderKey),
    [selectedType, selectedProviderKey]
  );

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const response = await api.get(ENDPOINTS.SYSTEM.INTEGRATIONS);
        const nextDocs = Array.isArray(response?.docs) ? response.docs : [];
        setDocs(nextDocs);
      } catch (error: any) {
        addNotification({
          title: 'Failed to Load Integrations',
          message: error?.message || 'Could not fetch provider configuration.',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegrations();
  }, [addNotification]);

  const handleEdit = (type: IntegrationDoc) => {
    setSelectedTypeKey(type.key);
    
    const activeProvider = String(type?.active?.provider || type.defaultProvider || '');
    const provider = type.providers.find((entry) => entry.key === activeProvider) || type.providers[0];
    const sourceConfig = type?.active?.config || type?.stored?.config || {};

    setSelectedProviderKey(provider?.key || '');
    setDraftConfig(buildConfigSeed(provider, sourceConfig));
    setView('edit');
  };

  const handleSelectProvider = (providerKey: string) => {
    setSelectedProviderKey(providerKey);
    const provider = selectedType?.providers?.find((entry) => entry.key === providerKey);
    const sourceConfig = selectedType?.active?.config || selectedType?.stored?.config || {};
    setDraftConfig(buildConfigSeed(provider, sourceConfig));
  };

  const handleSave = async () => {
    if (!selectedType || !selectedProviderKey) return;
    setIsSaving(true);
    try {
      const response = await api.put(ENDPOINTS.SYSTEM.INTEGRATION(selectedType.key), {
        provider: selectedProviderKey,
        config: draftConfig
      });

      const updated = response?.integration as IntegrationDoc | undefined;
      if (updated) {
        setDocs((prev) => prev.map((doc) => (doc.key === updated.key ? updated : doc)));
      }

      addNotification({
        title: 'Integration Updated',
        message: `${selectedType.label} now uses provider "${selectedProvider?.label || selectedProviderKey}".`,
        type: 'success'
      });
      setView('grid');
    } catch (error: any) {
      addNotification({
        title: 'Save Failed',
        message: error?.message || 'Could not save integration config.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12">
        <Loader label="Resolving Integration Graph..." />
      </div>
    );
  }

  if (view === 'grid') {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
          theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
        }`}>
          <div>
            <h1 className={`text-xl font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Integrations
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 tracking-wide opacity-60">
              System Service Providers
            </p>
          </div>
        </div>

        <div className="p-8 lg:p-12">
          {!docs.length ? (
            <Card title="Integrations">
              <p className="text-sm text-slate-500">No integration types are registered in the runtime.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
              {docs.map((doc) => (
                <div 
                  key={doc.key}
                  onClick={() => handleEdit(doc)}
                  className={`group cursor-pointer p-6 rounded-3xl border transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 ${
                    theme === 'dark' 
                      ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 hover:border-indigo-500/50' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-2xl ${
                      theme === 'dark' ? 'bg-slate-800 group-hover:bg-indigo-500/10' : 'bg-slate-100 group-hover:bg-indigo-50'
                    }`}>
                      <FrameworkIcons.Settings className={theme === 'dark' ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-500 group-hover:text-indigo-500'} size={24} />
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-tighter ${
                      doc.active?.source === 'env' 
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                        : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                    }`}>
                      {doc.active?.source === 'env' ? 'Environment' : 'Managed'}
                    </div>
                  </div>
                  
                  <h3 className={`text-lg font-semibold tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{doc.label}</h3>
                  <p className="text-sm text-slate-500 mb-6 line-clamp-2 min-h-[40px]">{doc.description || 'Manage system-level service providers for this integration type.'}</p>
                  
                  <div className={`mt-auto pt-5 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-slate-400">
                      <span>Active Provider</span>
                      <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-600'}>{doc.active?.provider || 'default'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('grid')}
            className={`p-2 rounded-xl transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <FrameworkIcons.ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={`text-xl font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {selectedType?.label}
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 tracking-wide opacity-60">
              Configure Service Provider
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setView('grid')}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
            onClick={handleSave}
            isLoading={isSaving}
            className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-8 lg:p-12 max-w-4xl space-y-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-2">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Provider Selection</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Choose which driver or service to use for this integration.</p>
          </div>
          <div className="md:col-span-2">
            <Card>
              <div className="space-y-6">
                <Select
                  value={selectedProviderKey}
                  onChange={handleSelectProvider}
                  options={(selectedType?.providers || []).map(p => ({ value: p.key, label: p.label }))}
                  theme={theme}
                  label="Available Providers"
                  searchable={false}
                />
                {selectedProvider?.description ? (
                  <p className="text-sm text-slate-500 bg-slate-500/5 p-4 rounded-2xl border border-slate-500/10 italic">
                    "{selectedProvider.description}"
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <div className="border-t border-slate-500/10 pt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-2">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Service Configuration</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Enter the required credentials and settings for the selected provider.</p>
          </div>
          <div className="md:col-span-2">
            <Card>
              <div className="space-y-6">
                {!selectedProvider?.fields?.length ? (
                  <div className="text-center py-6 opacity-40">
                    <FrameworkIcons.Settings className="mx-auto mb-2" size={32} />
                    <p className="text-sm font-medium">No configuration needed</p>
                  </div>
                ) : (
                  selectedProvider.fields.map((field) => {
                    const value = draftConfig[field.name];

                    if (field.type === 'boolean') {
                      return (
                        <div key={field.name} className="p-4 rounded-2xl border border-slate-500/10 bg-slate-500/5">
                          <Switch
                            checked={toBoolean(value)}
                            onChange={(checked) => setDraftConfig((prev) => ({ ...prev, [field.name]: checked }))}
                            label={field.label}
                            description={field.description}
                          />
                        </div>
                      );
                    }

                    if (field.type === 'select') {
                      return (
                        <div key={field.name} className="space-y-2">
                          <Select
                            value={String(value || '')}
                            onChange={(next) => setDraftConfig((prev) => ({ ...prev, [field.name]: next }))}
                            options={(field.options || []).map(o => ({ value: o.value, label: o.label }))}
                            theme={theme}
                            label={field.label}
                            searchable={false}
                          />
                          {field.description ? <p className="text-xs text-slate-500 px-1">{field.description}</p> : null}
                        </div>
                      );
                    }

                    if (field.type === 'textarea') {
                      return (
                        <div key={field.name} className="space-y-2">
                          <label className="text-[10px] font-semibold tracking-wide text-slate-500 px-1">{field.label}</label>
                          <textarea
                            value={String(value || '')}
                            onChange={(event) =>
                              setDraftConfig((prev) => ({ ...prev, [field.name]: event.target.value }))
                            }
                            placeholder={field.placeholder || ''}
                            rows={4}
                            className={`w-full rounded-2xl py-3 px-4 text-sm font-medium outline-none border transition-all ${
                              theme === 'dark'
                                ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500'
                                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                            }`}
                          />
                          {field.description ? <p className="text-xs text-slate-500 px-1">{field.description}</p> : null}
                        </div>
                      );
                    }

                    return (
                      <div key={field.name} className="space-y-2">
                        <Input
                          type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                          value={field.type === 'number' ? (value ?? '') : String(value || '')}
                          onChange={(event) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              [field.name]:
                                field.type === 'number'
                                  ? (event.target.value === '' ? '' : Number(event.target.value))
                                  : event.target.value
                            }))
                          }
                          label={field.label}
                          placeholder={field.placeholder}
                        />
                        {field.description ? <p className="text-xs text-slate-500 px-1">{field.description}</p> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
