'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';
import { FieldRenderer } from '@/components/collection/field-renderer';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { PluginSettingsFormHandle, PluginSettingsFormProps } from './plugin-settings-form.interfaces';

function PluginSettingsFormComponent({
  pluginSlug,
  formId,
  onStateChange,
}: PluginSettingsFormProps, ref: React.ForwardedRef<PluginSettingsFormHandle>) {
  const { triggerRefresh } = ContextHooks.usePlugins() as any;
  const { theme } = ThemeHooks.useTheme();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string | string[]>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [pluginSlug]);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    onStateChange?.(isDirty, saving);
  }, [isDirty, saving]);

  const loadSettings = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [schemaRes, settingsRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_SCHEMA(pluginSlug)),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS(pluginSlug)),
      ]);

      const nextSchema = schemaRes;
      const nextSettings = settingsRes.settings || {};

      setSchema(nextSchema);
      setSettings(nextSettings);
      
      if (nextSchema.tabs && nextSchema.tabs.length > 0) {
        setActiveTab(nextSchema.tabs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      // If schema fails with 404, it might mean no settings registered
      if (err.status === 404) {
        setSchema({ fields: [] });
      } else {
        setStatus({ type: 'error', message: 'Failed to load plugin settings.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    setStatus(null);
    
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS(pluginSlug), settings);
      setIsDirty(false);
      setStatus({ type: 'success', message: 'Settings saved successfully!' });
      triggerRefresh();
    } catch (err: any) {
      console.error('Save error:', err);
      if (err.data?.errors) {
        setErrors(err.data.errors);
        setStatus({ type: 'error', message: 'Validation failed. Please check the fields below.' });
      } else {
        setStatus({ type: 'error', message: err.message || 'Failed to save settings.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }
    
    try {
      const res = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_RESET(pluginSlug));
      const nextSettings = res.settings || {};
      setSettings(nextSettings);
      setIsDirty(false);
      setStatus({ type: 'success', message: 'Settings reset to defaults.' });
      triggerRefresh();
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Failed to reset: ' + err.message });
    }
  };

  const handleExport = () => {
    window.open(AdminApi.getURL(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_EXPORT(pluginSlug)), '_blank');
  };

  useImperativeHandle(ref, () => ({
    exportSettings: handleExport,
    importSettings: () => importInputRef.current?.click(),
    resetSettings: handleReset,
  }));

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedSettings = JSON.parse(content);
        
        await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SETTINGS_IMPORT(pluginSlug), importedSettings);
        await loadSettings();
        setIsDirty(false);
        triggerRefresh();
        setStatus({ type: 'success', message: 'Settings imported successfully.' });
      } catch (error: any) {
        setStatus({ type: 'error', message: 'Import failed: ' + error.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [fieldName]: value,
    }));
    setIsDirty(true);
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin text-indigo-500">
           <FrameworkIcons.Loader size={32} />
        </div>
      </div>
    );
  }

  if (!schema || !schema.fields || schema.fields.length === 0) {
    return (
      <div className={`p-8 rounded-2xl border text-center ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <FrameworkIcons.Settings size={48} className="mx-auto mb-4 text-slate-400" />
        <p className="text-slate-500 font-bold">
          This plugin has no configurable settings.
        </p>
      </div>
    );
  }

  const getVisibleFields = () => {
    if (!schema.tabs || schema.tabs.length === 0) {
      return schema.fields;
    }
    
    const currentTab = schema.tabs.find((t: any) => t.id === activeTab);
    if (!currentTab) return schema.fields;
    
    return schema.fields.filter((f: any) => {
      // Check if field specifically belongs to this tab
      if (f.tab === activeTab) return true;
      
      // Check if tab definition explicitly lists this field
      if (currentTab.fields && Array.isArray(currentTab.fields)) {
        return currentTab.fields.includes(f.name);
      }
      
      return false;
    });
  };

  const visibleFields = getVisibleFields();

  return (
    <form
      id={formId}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      {status && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          status.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          {status.type === 'success' ? <FrameworkIcons.Check size={18} /> : <FrameworkIcons.Alert size={18} />}
          <p className="text-sm font-bold">{status.message}</p>
        </div>
      )}

      {/* hidden file input for import */}
      <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Tabs */}
      {schema.tabs && schema.tabs.length > 0 && (
        <div className={`flex gap-2 p-2 rounded-2xl ${
          theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
        }`}>
          {schema.tabs.map((tab: any) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? theme === 'dark'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white text-slate-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className={`p-8 rounded-2xl border ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleFields.map((field: any) => (
            <FieldRenderer
              key={field.name}
              field={field}
              value={settings[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
              theme={theme}
              collectionSlug={`settings-${pluginSlug}`}
              errors={errors[field.name] ? (Array.isArray(errors[field.name]) ? (errors[field.name] as string[]) : [errors[field.name] as string]) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-sm font-semibold text-amber-600">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={handleExport}>
            Export
          </Button>
          <Button type="button" variant="ghost" onClick={handleReset}>
            Reset
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>

    </form>
  );
}

const PluginSettingsForm = forwardRef<PluginSettingsFormHandle, PluginSettingsFormProps>(PluginSettingsFormComponent);

PluginSettingsForm.displayName = 'PluginSettingsForm';

export default PluginSettingsForm;
