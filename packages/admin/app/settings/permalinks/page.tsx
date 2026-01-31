"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { usePlugins } from '@fromcode/react';
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';

const PLACEHOLDERS = [
  { label: ':slug', description: 'The sanitized post title (recommended)', example: 'hello-world' },
  { label: ':id', description: 'The unique numeric ID of the content', example: '123' },
  { label: ':year', description: 'The 4-digit year of publication', example: '2026' },
  { label: ':month', description: 'The 2-digit month of publication', example: '01' },
  { label: ':day', description: 'The 2-digit day of publication', example: '31' },
  { label: ':category', description: 'The primary category slug', example: 'news' },
  { label: ':author', description: 'The author username', example: 'admin' },
];

const PRESETS = [
  { label: 'Plain', value: '/:slug' },
  { label: 'Day and name', value: '/:year/:month/:day/:slug' },
  { label: 'Month and name', value: '/:year/:month/:slug' },
  { label: 'Numeric', value: '/:id' },
  { label: 'Category and name', value: '/:category/:slug' },
];

export default function PermalinksPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const { registerSettings } = usePlugins();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [structure, setStructure] = useState('/:slug');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        const found = docs.find((s: any) => s.key === 'permalink_structure');
        if (found) {
          setStructure(found.value);
        }
      } catch (err) {
        console.error('Failed to fetch permalink structure:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/permalink_structure`, {
        value: structure
      });

      // Update global context so other components (like PermalinkInput) update instantly
      registerSettings({
        permalink_structure: structure
      });

      addNotification({
        title: 'Structure Updated',
        message: 'Global permalink routing has been synced.',
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err.message || 'Failed to save setting.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader label="Loading Routing Protocols..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Sub-Page Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Routing Patterns
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
            Global Permalink & Slug Configuration
          </p>
        </div>
        <Button 
          icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
        >
          Apply Structure
        </Button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <Card title="Global Routing Logic">
          <div className="space-y-8 py-4">
            <div>
              <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Common Structures
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setStructure(preset.value)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      structure === preset.value
                        ? 'border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600'
                        : theme === 'dark'
                          ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-black uppercase tracking-widest ${
                        structure === preset.value ? 'text-indigo-400' : 'text-slate-500'
                      }`}>
                        {preset.label}
                      </span>
                      <code className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                        {preset.value}
                      </code>
                    </div>
                    {structure === preset.value && (
                      <FrameworkIcons.Check size={20} className="text-indigo-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 border-dashed ${
              theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <label className={`block text-[11px] font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Custom Structure
              </label>
              <div className="flex gap-3">
                <div className={`flex-1 flex items-center px-4 rounded-xl border transition-all focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <span className="text-slate-400 font-mono text-sm border-r pr-3 mr-3 py-2.5">https://yourdomain.com</span>
                  <input
                    value={structure}
                    onChange={(e) => setStructure(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium py-2.5"
                    placeholder="/:year/:slug"
                  />
                </div>
                <Button 
                  onClick={handleSave} 
                  isLoading={isSaving}
                  className="px-8 rounded-xl"
                >
                  Apply
                </Button>
              </div>
              <p className="mt-4 text-[11px] text-slate-500 font-medium italic">
                Note: Changing this structure will immediately affect all front-end routing for CMS-controlled content.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Available Placeholders">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
            {PLACEHOLDERS.map((tag) => (
              <button
                key={tag.label}
                onClick={() => {
                  if (!structure.includes(tag.label)) {
                    setStructure(prev => prev.endsWith('/') ? `${prev}${tag.label}` : `${prev}/${tag.label}`);
                  }
                }}
                className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] group ${
                  theme === 'dark' 
                    ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60' 
                    : 'border-slate-100 bg-white hover:shadow-xl hover:shadow-indigo-600/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <code className="text-indigo-500 font-black text-sm px-2 py-1 bg-indigo-500/10 rounded-lg">
                    {tag.label}
                  </code>
                  <FrameworkIcons.Plus size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className={`text-[12px] font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  {tag.description}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Example: <span className="italic">{tag.example}</span>
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
