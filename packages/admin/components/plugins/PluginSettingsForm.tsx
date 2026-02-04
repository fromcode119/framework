'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FrameworkIcons } from '@/lib/icons';
import { FieldRenderer } from '@/components/collection/FieldRenderer';
import { useTheme } from '@/components/ThemeContext';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface PluginSettingsFormProps {
  pluginSlug: string;
}

export const PluginSettingsForm: React.FC<PluginSettingsFormProps> = ({
  pluginSlug,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [pluginSlug]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [schemaRes, settingsRes] = await Promise.all([
        api.get(ENDPOINTS.PLUGINS.SETTINGS_SCHEMA(pluginSlug)),
        api.get(ENDPOINTS.PLUGINS.SETTINGS(pluginSlug)),
      ]);
      
      setSchema(schemaRes);
      setSettings(settingsRes.settings || {});
      
      if (schemaRes.tabs && schemaRes.tabs.length > 0) {
        setActiveTab(schemaRes.tabs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      // If schema fails with 404, it might mean no settings registered
      if (err.status === 404) {
        setSchema({ fields: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    
    try {
      await api.put(ENDPOINTS.PLUGINS.SETTINGS(pluginSlug), settings);
      setIsDirty(false);
      alert('Settings saved successfully!');
    } catch (err: any) {
      if (err.errors) {
        setErrors(err.errors);
      } else {
        alert('Failed to save settings: ' + (err.message || 'Unknown error'));
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
      const res = await api.post(ENDPOINTS.PLUGINS.SETTINGS_RESET(pluginSlug));
      setSettings(res.settings || {});
      setIsDirty(false);
    } catch (err: any) {
      alert('Failed to reset settings: ' + (err.message || 'Unknown error'));
    }
  };

  const handleExport = async () => {
    const url = api.getURL(ENDPOINTS.PLUGINS.SETTINGS_EXPORT(pluginSlug));
    window.open(url, '_blank');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedSettings = JSON.parse(content);
        
        await api.post(ENDPOINTS.PLUGINS.SETTINGS_IMPORT(pluginSlug), importedSettings);
        await loadSettings();
        setIsDirty(false);
        alert('Settings imported successfully!');
      } catch (error: any) {
        alert('Import failed: ' + error.message);
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
    <div className="space-y-6">
      {/* Tabs */}
      {schema.tabs && schema.tabs.length > 0 && (
        <div className={`flex gap-2 p-2 rounded-2xl ${
          theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
        }`}>
          {schema.tabs.map((tab: any) => (
            <button
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
              errors={errors[field.name] ? [errors[field.name]] : undefined}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExport}
            icon={<FrameworkIcons.Download size={16} />}
          >
            Export
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="secondary"
              as="span"
              icon={<FrameworkIcons.Upload size={16} />}
            >
              Import
            </Button>
          </label>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="text-red-500 hover:text-red-600"
            icon={<FrameworkIcons.Refresh size={16} />}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-sm font-bold text-amber-500 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
            icon={saving ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Check size={16} />}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};
