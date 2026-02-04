"use client";

import React, { use, useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { PluginSettingsForm } from '@/components/plugins/PluginSettingsForm';

interface Plugin {
  slug: string;
  name: string;
  version: string;
  category: string;
  description?: string;
  state: string;
  author?: string;
  capabilities?: string[];
}

export default function PluginSettingsPage({ params }: { params: React.Usable<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    async function fetchPlugin() {
      try {
        const data = await api.get(ENDPOINTS.PLUGINS.LIST);
        const found = data.find((p: any) => p.slug === slug);
        if (found) {
          setPlugin(found);
        } else {
          router.push('/plugins');
        }
      } catch (err) {
        console.error("Failed to fetch plugin detail", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlugin();
  }, [slug, router]);

  const handleToggle = async () => {
    if (!plugin) return;
    try {
      const newState = plugin.state === 'active' ? false : true;
      await api.post(`${ENDPOINTS.PLUGINS.BASE}/${plugin.slug}/toggle`, { enabled: newState });

      setPlugin({ ...plugin, state: newState ? 'active' : 'inactive' });
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!plugin) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link 
          href="/plugins"
          className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-sm'}`}
        >
          <FrameworkIcons.Left size={20} />
        </Link>
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            System Management: {plugin.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-slate-500">{plugin.slug}</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-500">Global Settings & Registry</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Plugin Configuration (New Settings API) */}
          <div className="space-y-4">
            <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Plugin Configuration
            </h2>
            <PluginSettingsForm pluginSlug={slug} />
          </div>

          <Card className="p-8">
            <h3 className="text-sm font-bold uppercase text-slate-500 mb-6">Core Registry Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="font-bold text-sm">Enable Plugin</p>
                            <p className="text-xs text-slate-500">Activation state of the plugin bundle</p>
                        </div>
                        <Switch checked={plugin.state === 'active'} onChange={handleToggle} />
                    </div>
                </div>
                
                <div className="space-y-1">
                    <p className="font-bold text-sm">Installation Path</p>
                    <p className="text-xs text-slate-500">Framework detected path for assets</p>
                    <code className="text-[10px] block p-2 bg-slate-100 dark:bg-slate-900 rounded-lg mt-2 text-indigo-500 font-mono">
                       /plugins/{plugin.slug}
                    </code>
                </div>
            </div>
          </Card>

          <Card className="p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                    <FrameworkIcons.ShieldAlert size={20} />
                </div>
                <h3 className="font-bold">Security & Capabilities</h3>
            </div>
            <div className="space-y-4">
                <p className="text-sm text-slate-500">This plugin has been granted the following system permissions:</p>
                <div className="flex flex-wrap gap-2">
                    {(plugin.capabilities || []).map(cap => (
                        <div key={cap} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                           <span className="text-xs font-bold uppercase font-mono">{cap}</span>
                        </div>
                    ))}
                    {(!plugin.capabilities || plugin.capabilities.length === 0) && (
                        <p className="text-xs italic text-slate-400">No special capabilities requested.</p>
                    )}
                </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
            <Card className="p-6">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-6">Information</h4>
                <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Slug</span>
                        <span className="font-mono font-bold text-xs">{plugin.slug}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Version</span>
                        <span className="font-bold">{plugin.version}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Status</span>
                        <Badge variant={plugin.state === 'active' ? 'blue' : 'gray'}>
                            {plugin.state.toUpperCase()}
                        </Badge>
                    </div>
                </div>
            </Card>

            <Card className="p-6 border-red-500/30 bg-red-500/5">
                <h4 className="text-xs font-bold uppercase text-red-500 mb-4">Danger Zone</h4>
                <p className="text-[11px] text-red-500/60 mb-6">
                    Uninstalling will permanently remove this plugin's data and configuration from the system.
                </p>
                <button className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all">
                   Uninstall Completely
                </button>
            </Card>
        </div>
      </div>
    </div>
  );
}
