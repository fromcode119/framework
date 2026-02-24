"use client";

import React, { use, useState, useEffect, useRef } from 'react';
import { Slot, usePlugins, Plugin } from '@fromcode119/react';
import { useTheme } from '../../../components/theme-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { FrameworkIcons } from '../../../lib/icons';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { api } from '../../../lib/api';
import { ENDPOINTS } from '../../../lib/constants';
import { useNotify } from '../../../components/notification-context';
import { Loader } from '../../../components/ui/loader';
import { Select } from '../../../components/ui/select';
import { PluginSettingsForm, PluginSettingsFormHandle } from '../../../components/plugins/plugin-settings-form';

export default function PluginDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useNotify();
  const { triggerRefresh, refreshVersion, collections } = usePlugins();
  const searchParams = useSearchParams();
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsFormRef = useRef<PluginSettingsFormHandle>(null);
  const [showDefinition, setShowDefinition] = useState(false);
  const [marketplaceItem, setMarketplaceItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'permissions' | 'resources'>('overview');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sandboxSettings, setSandboxSettings] = useState({
    enabled: true,
    memoryLimit: 128,
    timeout: 1000,
    allowNative: false
  });
  const { theme } = useTheme();

  const settingsCollections = collections.filter(c => 
    c.pluginSlug === slug && 
    c.admin?.group === 'settings'
  );

  const fetchPlugin = async () => {
    try {
      const data = await api.get(ENDPOINTS.PLUGINS.LIST);
      const found = data.find((p: any) => p.slug === slug);
      if (found) {
        setPlugin(found);
        
        // Initialize config values
        const defaults: Record<string, any> = {};
        found.admin?.management?.settings?.forEach((s: any) => {
          defaults[s.name] = s.defaultValue;
        });
        setConfigValues({ ...defaults, ...(found.config || {}) });

        // Initialize sandbox settings
        if (found.sandbox === false) {
          setSandboxSettings({
            enabled: false,
            memoryLimit: 128,
            timeout: 1000,
            allowNative: false
          });
        } else if (found.sandbox && typeof found.sandbox === 'object') {
          setSandboxSettings({
            enabled: true,
            memoryLimit: found.sandbox.memoryLimit || 128,
            timeout: found.sandbox.timeout || 1000,
            allowNative: found.sandbox.allowNative || false
          });
        } else {
          setSandboxSettings({
            enabled: true,
            memoryLimit: 128,
            timeout: 1000,
            allowNative: false
          });
        }
      } else {
        router.push('/plugins');
      }
    } catch (err) {
      console.error("Failed to fetch plugin detail", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugin();
  }, [slug, router, refreshVersion]);

  useEffect(() => {
    async function checkUpdates() {
      try {
        const data = await api.get(ENDPOINTS.PLUGINS.MARKETPLACE);
        const pkg = data.plugins?.find((p: any) => p.slug === slug);
        if (pkg) setMarketplaceItem(pkg);
      } catch (e) {}
    }
    checkUpdates();
  }, [slug, refreshVersion]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (['settings', 'permissions', 'overview', 'resources'].includes(tab as any)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const fetchLogs = async () => {
    if (activeTab !== 'overview' || !slug) return;
    setLoadingLogs(true);
    try {
        const data = await api.get(ENDPOINTS.PLUGINS.LOGS(slug));
        setLogs(data);
    } catch (e) {
        console.error("Failed to fetch logs", e);
    } finally {
        setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [slug, activeTab, refreshVersion]);

  const handleUpdate = async () => {
    if (!plugin) return;
    setIsUpdating(true);
    try {
      await api.post(ENDPOINTS.PLUGINS.INSTALL(plugin.slug));
      notify('success', 'Update Complete', `${plugin.name} has been updated to the latest version.`);
      // Trigger global refresh to update state across the app
      triggerRefresh();
    } catch (err: any) {
      console.error("Update error:", err);
      notify('error', 'Update Failed', err.message || "Update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggle = async () => {
    if (!plugin) return;
    try {
      const newState = plugin.state === 'active' ? false : true;
      const res = await api.post(ENDPOINTS.PLUGINS.TOGGLE(plugin.slug), { enabled: newState });

      const status = newState ? 'active' : 'inactive';
      setPlugin({ 
        ...plugin, 
        state: status,
        // If we just enabled it, we implicitly approved all current capabilities
        approvedCapabilities: status === 'active' ? [...(plugin.capabilities || [])] : plugin.approvedCapabilities
      });
      
      notify('success', 'Status Updated', `${plugin.name} is now ${status}.`);
      
      // Refresh plugins state without full reload
      triggerRefresh();
    } catch (err: any) {
      console.error("Toggle error:", err);
      notify('error', 'Toggle Failed', err.message || "Failed to update plugin state.");
    }
  };

  const handleSaveConfig = async () => {
    if (!plugin) return;
    setIsSaving(true);
    try {
      await api.post(ENDPOINTS.PLUGINS.CONFIG(plugin.slug), configValues);
      setPlugin({ ...plugin, config: configValues });
      notify('success', 'Settings Saved', `Configuration for ${plugin.name} updated.`);
    } catch (err: any) {
      console.error("Save config error:", err);
      notify('error', 'Save Failed', err.message || "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSandbox = async () => {
    if (!plugin) return;
    setIsSaving(true);
    try {
      const payload = sandboxSettings.enabled
        ? {
            memoryLimit: sandboxSettings.memoryLimit,
            timeout: sandboxSettings.timeout,
            allowNative: sandboxSettings.allowNative
          }
        : { enabled: false };
      await api.post(`${ENDPOINTS.PLUGINS.BASE}/${plugin.slug}/sandbox`, payload);
      setPlugin({ ...plugin, sandbox: sandboxSettings.enabled ? payload : false });
      notify(
        'success',
        'Resources Updated',
        sandboxSettings.enabled
          ? `Sandbox limits for ${plugin.name} updated.`
          : `Sandbox disabled for ${plugin.name}.`
      );
      triggerRefresh();
    } catch (err: any) {
      console.error("Save sandbox error:", err);
      notify('error', 'Save Failed', err.message || "Failed to update sandbox limits.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!plugin) return;
    setIsDeleting(true);
    
    try {
      await api.delete(ENDPOINTS.PLUGINS.DELETE(plugin.slug));
      notify('success', 'Uninstalled', `${plugin.name} removed from system.`);
      triggerRefresh();
      router.push('/plugins');
    } catch (err: any) {
      console.error("Delete error:", err);
      notify('error', 'Uninstall Failed', err.message || "An error occurred while deleting the plugin.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleTabChange = (tabId: 'overview' | 'settings' | 'permissions' | 'resources') => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Synchronizing Plugin Manifest..." />
      </div>
    );
  }

  if (!plugin) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-6">
        <Link 
          href="/plugins/installed"
          className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${theme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
        >
          <FrameworkIcons.Left size={20} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <h1 className={`text-3xl font-semibold tracking-tighter truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
               {plugin.name}
             </h1>
             <Badge variant={plugin.state === 'active' ? 'success' : 'gray'}>
                {plugin.state}
             </Badge>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{plugin.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${marketplaceItem?.version && marketplaceItem.version !== plugin.version ? 'text-amber-500' : 'text-slate-400'}`}>
              Version {plugin.version}
            </span>
            {marketplaceItem?.version && marketplaceItem.version !== plugin.version && (
              <button 
                onClick={handleUpdate}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>

        {activeTab === 'resources' && (
           <Button 
            onClick={handleSaveSandbox}
            isLoading={isSaving}
            className="px-8 rounded-xl shadow-lg shadow-indigo-600/10"
          >
            Update Policy
          </Button>
        )}
      </div>

      <div className={`flex gap-2 p-1.5 rounded-2xl w-fit backdrop-blur-xl border transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-900/50 border-white/5' 
          : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
      }`}>
          {[
            { id: 'overview', label: 'Overview', icon: FrameworkIcons.Plugins },
            { id: 'settings', label: 'Configuration', icon: FrameworkIcons.Settings },
            { id: 'permissions', label: 'Security', icon: FrameworkIcons.Shield },
            { id: 'resources', label: 'Resource Limits', icon: FrameworkIcons.Zap }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all rounded-xl ${activeTab === tab.id 
                ? (theme === 'dark' 
                    ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' 
                    : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50')
                : (theme === 'dark'
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        {/* Left Column: Info & Content */}
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' && (
            <Card className={`border-0 relative overflow-hidden p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
              <div className="flex items-start gap-8">
                <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                   <FrameworkIcons.Plugins size={48} strokeWidth={1} />
                </div>
                <div className="flex-1 space-y-4">
                  <Badge variant="blue" className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px] rounded-lg">
                    {plugin.category || 'Core Plugin'}
                  </Badge>
                  <p className={`text-xl leading-relaxed font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plugin.description || "No description provided for this plugin."}
                  </p>
                </div>
              </div>

              {marketplaceItem?.version && marketplaceItem.version !== plugin.version && marketplaceItem.changelog && (
                <div className={`mt-10 p-6 rounded-3xl border-2 border-dashed ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100'}`}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-4 flex items-center gap-2">
                    <FrameworkIcons.Zap size={14} /> New in v{marketplaceItem.version}
                  </h4>
                  <ul className="space-y-3">
                    {marketplaceItem.changelog.map((item: string) => (
                      <li key={item} className="flex gap-3 text-sm font-medium text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
                <div className="space-y-1">
                  <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Runtime Status</div>
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${plugin.state === 'active' ? 'bg-green-500' : 'bg-slate-500'} shadow-[0_0_12px_rgba(34,197,94,0.3)]`} />
                    <span className={`text-sm font-semibold uppercase tracking-tighter ${plugin.state === 'active' ? 'text-green-500' : 'text-slate-500'}`}>
                      {plugin.state}
                    </span>
                  </div>
                </div>
                <div className={`flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${
                  theme === 'dark' 
                    ? 'bg-slate-800/50 border-white/5' 
                    : 'bg-slate-100/80 border-slate-200/60 shadow-inner'
                }`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {plugin.state === 'active' ? 'Active' : 'Disabled'}
                  </span>
                  <Switch checked={plugin.state === 'active'} onChange={handleToggle} className="scale-110" />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <PluginSettingsForm
                 ref={settingsFormRef}
                 pluginSlug={slug}
                 formId="plugin-settings-form"
                 onStateChange={(dirty, saving) => {
                   setSettingsDirty(dirty);
                   setSettingsSaving(saving);
                 }}
               />
            </div>
          )}

          {activeTab === 'permissions' && (
            <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
               <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                 Security & Capabilities
               </h3>
               <div className="space-y-6">
                  {plugin.capabilities && plugin.capabilities.length > 0 ? (
                    plugin.capabilities.map(cap => {
                      const isUnapproved = !plugin.approvedCapabilities?.includes(cap);
                      return (
                        <div key={cap} className={`flex items-center gap-6 p-6 rounded-[2rem] transition-all duration-300 border ${
                          isUnapproved 
                            ? (theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200')
                            : (theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/20')
                        }`}>
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                             isUnapproved ? 'bg-amber-500 shadow-xl shadow-amber-500/20' : 'bg-indigo-600 shadow-xl shadow-indigo-500/25'
                           } text-white`}>
                              {cap.includes('db') || cap.includes('database') ? <FrameworkIcons.Database size={20} /> : 
                               cap.includes('api') ? <FrameworkIcons.Globe size={20} /> : 
                               cap.includes('hook') ? <FrameworkIcons.Zap size={20} /> : <FrameworkIcons.Shield size={20} />}
                           </div>
                           <div className="flex-1">
                              <div className={`text-sm font-semibold tracking-tight ${
                                isUnapproved ? 'text-amber-700 dark:text-amber-400' : 'text-slate-950 dark:text-white'
                              }`}>
                                 {cap.split(':').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1 font-medium italic">
                                 {isUnapproved 
                                   ? "Warning: This new capability requires your explicit approval."
                                   : `Granted access to the system ${cap.split(':')[0]} layer.`}
                              </p>
                           </div>
                           <Badge variant={isUnapproved ? "warning" : "success"} className={isUnapproved ? 'animate-pulse' : ''}>
                             {isUnapproved ? "UNAPPROVED" : "GRANTED"}
                           </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                      <FrameworkIcons.Shield className="text-slate-100 dark:text-slate-900 mb-6" size={64} />
                      <p className="text-slate-500 font-bold">Standard Isolation</p>
                      <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Minimal system permissions</p>
                    </div>
                  )}
               </div>
            </Card>
          )}

          {activeTab === 'resources' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card title="Sandbox Isolation Policy" className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                   <div className="space-y-10 py-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex gap-4">
                          <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <FrameworkIcons.Shield size={20} />
                          </div>
                          <div>
                            <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Sandbox Isolation</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm">Enabled by default. Disable only for fully trusted plugins.</p>
                          </div>
                        </div>
                        <Switch 
                          checked={sandboxSettings.enabled}
                          onChange={(val) => setSandboxSettings(prev => ({ ...prev, enabled: val }))}
                        />
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex gap-4">
                          <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <FrameworkIcons.Zap size={20} />
                          </div>
                          <div>
                            <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Memory Heap Limit</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm">Maximum RAM allocated to the V8 isolate. (MB)</p>
                          </div>
                        </div>
                        <input 
                          type="number"
                          value={sandboxSettings.memoryLimit}
                          disabled={!sandboxSettings.enabled}
                          onChange={(e) => setSandboxSettings(prev => ({ ...prev, memoryLimit: Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 128 }))}
                          className={`w-full md:w-32 px-4 py-2 rounded-xl text-center font-bold ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                        />
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex gap-4">
                          <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <FrameworkIcons.Clock size={20} />
                          </div>
                          <div>
                            <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Execution Timeout</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm">Kill plugin execution if it takes longer than this. (ms)</p>
                          </div>
                        </div>
                        <input 
                          type="number"
                          value={sandboxSettings.timeout}
                          disabled={!sandboxSettings.enabled}
                          onChange={(e) => setSandboxSettings(prev => ({ ...prev, timeout: Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 1000 }))}
                          className={`w-full md:w-32 px-4 py-2 rounded-xl text-center font-bold ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                        />
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex gap-4">
                          <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                            <FrameworkIcons.ShieldAlert size={20} />
                          </div>
                          <div>
                            <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Allow Native APIs</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm italic">Advanced mode. Keep disabled unless this plugin explicitly requires native host capabilities.</p>
                          </div>
                        </div>
                        <Switch 
                          disabled={!sandboxSettings.enabled}
                          checked={sandboxSettings.allowNative}
                          onChange={(val) => setSandboxSettings(prev => ({ ...prev, allowNative: val }))}
                        />
                      </div>
                   </div>
                </Card>
             </div>
          )}

          {/* Logs Section */}
          {activeTab === 'overview' && (
            <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
               <div className="flex items-center justify-between mb-8">
                  <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Active Activity Logs
                  </h3>
                  <button 
                    onClick={fetchLogs}
                    className={`h-10 px-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-2 border ${
                      theme === 'dark' 
                        ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' 
                        : 'bg-white border-slate-200 text-indigo-500 hover:text-indigo-600 shadow-sm hover:shadow-md'
                    }`}
                  >
                    Refresh {loadingLogs ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Refresh size={12} />}
                  </button>
               </div>
               
               <div className={`rounded-2xl border-2 transition-all duration-300 ${
                 theme === 'dark' 
                   ? 'border-slate-800/50 bg-slate-950/40' 
                   : 'border-slate-100 bg-white shadow-inner shadow-slate-200/20'
               } overflow-hidden`}>
                  <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar">
                    {loadingLogs ? (
                      <div className="p-10 text-center text-slate-500 font-semibold uppercase tracking-wider">Analyzing stream...</div>
                    ) : logs.length > 0 ? (
                      <table className="w-full border-collapse">
                        <tbody>
                          {logs.map((log) => (
                            <tr key={log.id || `${log.timestamp}-${log.message}`} className={`border-b last:border-0 transition-colors ${
                              theme === 'dark'
                                ? 'border-slate-800/50 hover:bg-indigo-500/5'
                                : 'border-slate-50 hover:bg-indigo-50/30'
                            }`}>
                               <td className="py-3 px-4 text-slate-400 whitespace-nowrap align-top font-bold">{new Date(log.timestamp).toLocaleTimeString()}</td>
                               <td className="py-3 px-2">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wider ${
                                    log.level === 'ERROR' ? 'bg-red-500 text-white' :
                                    log.level === 'WARN' ? 'bg-amber-500 text-white' :
                                    'bg-indigo-500 text-white'
                                  }`}>
                                    {log.level}
                                  </span>
                               </td>
                               <td className={`py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{log.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 text-center text-slate-500 italic">Idle. No recent events recorded.</div>
                    )}
                  </div>
               </div>
            </Card>
          )}
        </div>

        {/* Right Column: Metadata & Details */}
        <div className="space-y-8">
          {activeTab === 'settings' && (
            <Card className={`border-0 p-6 animate-in fade-in duration-300 ${
              theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'
            }`}>
              <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-5 ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Save Changes
              </h3>
              {settingsDirty && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-amber-500">Unsaved changes</span>
                </div>
              )}
              <button
                type="submit"
                form="plugin-settings-form"
                disabled={settingsSaving || !settingsDirty}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  settingsSaving || !settingsDirty
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
                }`}
              >
                {settingsSaving
                  ? <><FrameworkIcons.Loader size={14} className="animate-spin" /> Saving...</>
                  : <><FrameworkIcons.Check size={14} /> Save Settings</>
                }
              </button>
              <div className={`mt-4 pt-4 border-t flex gap-2 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => settingsFormRef.current?.exportSettings()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm'
                  }`}
                  title="Export settings as JSON"
                >
                  <FrameworkIcons.Download size={12} /> Export
                </button>
                <button
                  type="button"
                  onClick={() => settingsFormRef.current?.importSettings()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm'
                  }`}
                  title="Import settings from JSON"
                >
                  <FrameworkIcons.Upload size={12} /> Import
                </button>
                <button
                  type="button"
                  onClick={() => settingsFormRef.current?.resetSettings()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 text-rose-400 hover:text-rose-300 hover:border-rose-500/30'
                      : 'bg-slate-50 border-slate-200 text-rose-500 hover:text-rose-700 hover:border-rose-200 shadow-sm'
                  }`}
                  title="Reset settings to defaults"
                >
                  <FrameworkIcons.Refresh size={12} /> Reset
                </button>
              </div>
            </Card>
          )}
          <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
            <h3 className={`text-[11px] font-semibold tracking-wider mb-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Manifest Details
            </h3>
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold tracking-wider text-slate-500">Capabilities</span>
                {plugin.capabilities && plugin.capabilities.length > 0 ? (
                  <button
                    onClick={() => handleTabChange('permissions')}
                    className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
                      theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    <FrameworkIcons.Shield size={12} />
                    {plugin.capabilities.length} declared
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">None</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                 <span className="text-xs font-semibold tracking-wider text-slate-500">Author</span>
                 <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {typeof plugin.author === 'object' ? (plugin.author as any).name : (plugin.author || 'Official Core')}
                 </span>
              </div>
            </div>
            
            <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} space-y-4`}>
              <button
                onClick={() => setShowDefinition(true)}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl border font-semibold uppercase tracking-wider text-[11px] transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <FrameworkIcons.Code size={16} strokeWidth={2.5} />
                View Definition
              </button>
            </div>
          </Card>

          <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'} ring-1 ring-red-500/20`}>
            <h3 className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-4">
              System Removal
            </h3>
            <p className="text-xs font-medium text-red-500/80 leading-relaxed mb-8">
              Uninstalling will permanently remove all configuration, caches and local state associated with this plugin.
            </p>
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xl shadow-red-600/20 active:scale-95"
            >
              Uninstall Plugin
            </button>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Confirm Uninstallation"
        description={`Are you sure you want to delete ${plugin.name}? This will remove all associated files and data from the system. This action cannot be undone.`}
        confirmLabel="Uninstall Plugin"
      />

      {showDefinition && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDefinition(false)}
        >
          <div
            className={`relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-8 py-5 border-b ${
              theme === 'dark' ? 'border-white/5' : 'border-slate-100'
            }`}>
              <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Plugin Manifest — {plugin.slug}
              </h3>
              <button
                onClick={() => setShowDefinition(false)}
                className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
                  theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FrameworkIcons.X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <pre className={`p-8 text-[11px] leading-relaxed font-mono ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {JSON.stringify(plugin, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
