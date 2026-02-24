"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../components/theme-context';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { FrameworkIcons } from '../../../lib/icons';
import { api } from '../../../lib/api';
import { useNotification } from '../../../components/notification-context';
import { ENDPOINTS } from '../../../lib/constants';
import { Loader } from '../../../components/ui/loader';
import { Badge } from '../../../components/ui/badge';

const bytesToMB = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return (value / (1024 * 1024)).toFixed(2);
};

const SettingRow = ({ icon: Icon, title, description, children, theme }: any) => (
  <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
    <div className="flex gap-4">
      <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
        {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
      </div>
      <div>
        <h3 className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

export default function SecuritySettingsPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({
    two_factor_enabled: false,
    rate_limit_max: '100',
    rate_limit_window: '900000',
    auth_session_duration_minutes: '10080',
  });

  const fetchStats = async () => {
    try {
      const data = await api.get(ENDPOINTS.SYSTEM.STATS.SECURITY);
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch security stats", e);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`);
        const docs = response.docs || [];
        const newSettings = { ...settings };
        docs.forEach((s: any) => {
          if (['two_factor_enabled', 'rate_limit_max', 'rate_limit_window', 'auth_session_duration_minutes'].includes(s.key)) {
            newSettings[s.key] = s.key === 'two_factor_enabled' ? s.value === 'true' : s.value;
          }
        });
        setSettings(newSettings);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
    if (activeTab === 'dashboard') fetchStats();
  }, [activeTab]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(Object.entries(settings).map(([key, value]) => {
        return api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/${key}`, {
          value: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
        });
      }));
      addNotification({ title: 'Security Updated', message: 'API protection and account defense synced.', type: 'success' });
    } catch (err) {
      addNotification({ title: 'Update Failed', message: 'Failed to save security configuration.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-12"><Loader label="Hardening Protocols..." /></div>;

  const sandboxHeap = stats?.sandbox?.heap;
  const sandboxUsedMB = bytesToMB(sandboxHeap?.used_heap_size);
  const sandboxTotalMB = bytesToMB(sandboxHeap?.total_heap_size);
  const sandboxLimitMB = bytesToMB(sandboxHeap?.heap_size_limit);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Sub-Page Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div className="flex items-center gap-6">
          <div>
            <h1 className={`text-xl font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Security & Defense
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 tracking-wide opacity-60">
              Runtime isolation and protection
            </p>
          </div>
          
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                Settings
              </button>
          </div>
        </div>
        
        {activeTab === 'settings' && (
          <Button 
            icon={<FrameworkIcons.Shield size={14} strokeWidth={3} />}
            onClick={handleSave}
            isLoading={isSaving}
            className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
          >
            Update Security
          </Button>
        )}
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8 pb-24">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
             {!stats.sandbox && (
               <Card className="!bg-amber-500/5 !border-amber-500/20">
                 <div className="flex items-start gap-4">
                   <FrameworkIcons.Warning size={20} className="text-amber-500 mt-0.5" />
                   <div>
                     <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Sandbox Isolation Unavailable</h3>
                     <p className="text-sm text-amber-800/70 dark:text-amber-400/70 leading-relaxed">
                       V8 isolated-vm sandbox is not active. Plugins are running in the main Node.js process without memory isolation. 
                       Install <code className="px-1.5 py-0.5 bg-amber-900/10 dark:bg-amber-100/10 rounded text-xs font-mono">isolated-vm</code> to enable secure sandboxing.
                     </p>
                   </div>
                 </div>
               </Card>
             )}
             {stats.sandbox && stats.sandbox.activeContexts === 0 && (
               <Card className="!bg-sky-500/5 !border-sky-500/20">
                 <div className="flex items-start gap-4">
                   <FrameworkIcons.Warning size={20} className="text-sky-500 mt-0.5" />
                   <div>
                     <h3 className="font-semibold text-sky-900 dark:text-sky-300 mb-1">
                       {(stats.pluginIsolation?.sandboxActivePlugins ?? 0) > 0
                         ? 'Sandbox Runtime Not Attached Yet'
                         : 'No Active Sandboxed Plugins'}
                     </h3>
                     {(stats.pluginIsolation?.sandboxActivePlugins ?? 0) > 0 ? (
                       <p className="text-sm text-sky-800/70 dark:text-sky-400/70 leading-relaxed">
                         Sandbox policy is enabled for active plugins, but no isolate context is currently attached.
                         Runtime-sandbox active plugins: <strong>{stats.pluginIsolation?.sandboxRuntimeActivePlugins ?? 0}</strong>, policy-enabled active plugins: <strong>{stats.pluginIsolation?.sandboxActivePlugins ?? 0}</strong>.
                         {(stats.pluginIsolation?.sandboxPolicyRuntimeMismatchPlugins ?? 0) > 0 && (
                           <>
                             {' '}Mismatch: <strong>{(stats.pluginIsolation?.sandboxPolicyRuntimeMismatchSlugs || []).join(', ')}</strong>.
                           </>
                         )}
                       </p>
                     ) : (
                       <p className="text-sm text-sky-800/70 dark:text-sky-400/70 leading-relaxed">
                         Sandbox runtime is available, but no active plugin currently has sandbox policy enabled.
                         {' '}Active plugins: <strong>{stats.pluginIsolation?.activePlugins ?? 0}</strong>, sandbox-policy active plugins: <strong>{stats.pluginIsolation?.sandboxActivePlugins ?? 0}</strong>.
                       </p>
                     )}
                   </div>
                 </div>
               </Card>
             )}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className={`p-6 relative overflow-hidden ${!stats.sandbox ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold tracking-wide text-slate-500">Sandbox Contexts</span>
                        <FrameworkIcons.Box size={16} className={stats.sandbox ? 'text-indigo-500' : 'text-slate-400'} />
                    </div>
                    <div className="text-3xl font-bold">
                      {stats.sandbox?.activeContexts ?? '-'}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">
                      {stats.sandbox ? 'V8 Isolated Instances' : 'Sandbox Disabled'}
                    </div>
                </Card>
                <Card className={`p-6 relative overflow-hidden ${!stats.sandbox ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold tracking-wide text-slate-500">Memory Usage</span>
                        <FrameworkIcons.Zap size={16} className={stats.sandbox ? 'text-amber-500' : 'text-slate-400'} />
                    </div>
                    <div className="text-3xl font-bold">
                        {stats.sandbox?.heap ? `${sandboxUsedMB} MB` : '-'}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">
                      {stats.sandbox ? 'Aggregate Sandbox Heap' : 'No Isolation Active'}
                    </div>
                    {stats.sandbox?.heap && (
                      <div className="mt-3 space-y-1">
                        <div className="text-[11px] text-slate-500">Used / Total heap: <strong>{sandboxUsedMB} / {sandboxTotalMB} MB</strong></div>
                        <div className="text-[11px] text-slate-500">Isolate heap limit: <strong>{sandboxLimitMB} MB</strong></div>
                      </div>
                    )}
                </Card>
                <Card className="p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold tracking-wide text-slate-500">Threat Alerts</span>
                        <FrameworkIcons.ShieldAlert size={16} className={stats.monitor?.violations24h > 0 ? 'text-red-500' : 'text-green-500'} />
                    </div>
                    <div className={`text-3xl font-bold ${stats.monitor?.violations24h > 0 ? 'text-red-500' : ''}`}>
                        {stats.monitor?.violations24h || 0}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">Policy Violations (24h)</div>
                </Card>
             </div>

             <Card title="Sandbox Memory Scope">
               <div className="space-y-4 pt-2">
                 <p className="text-sm text-slate-600 dark:text-slate-300">
                   This value reports <strong>only isolated-vm sandbox heap memory</strong>.
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20">
                     <p className="text-[10px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-300 uppercase">Included</p>
                     <p className="text-sm mt-2 text-emerald-900 dark:text-emerald-200">V8 isolate heap allocations for sandboxed plugin contexts.</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20">
                     <p className="text-[10px] font-semibold tracking-wide text-amber-700 dark:text-amber-300 uppercase">Not Included</p>
                     <ul className="mt-2 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                       <li>full Node process RSS</li>
                       <li>DB/network buffers</li>
                       <li>other non-isolate allocations</li>
                     </ul>
                   </div>
                 </div>
               </div>
             </Card>

             {stats.pluginIsolation && (
               <Card title="Plugin Isolation Coverage">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                     <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Total Plugins</p>
                     <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.totalPlugins}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                     <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Active Plugins</p>
                     <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.activePlugins}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                     <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Sandbox Active</p>
                     <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxActivePlugins}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                     <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Sandbox Runtime</p>
                     <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxRuntimeActivePlugins ?? 0}</p>
                   </div>
                 </div>
               </Card>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Defense Modules" className="h-full">
                    <div className="space-y-6 pt-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <FrameworkIcons.Fingerprint size={18} className="text-indigo-500" />
                                <span className="text-xs font-semibold tracking-wide">Integrity Checking</span>
                            </div>
                            <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <FrameworkIcons.Key size={18} className="text-indigo-500" />
                                <span className="text-xs font-semibold tracking-wide">Signature Enforcement</span>
                            </div>
                            <Badge variant={stats.signatureEnforced ? 'success' : 'gray'}>
                                {stats.signatureEnforced ? 'Enforced' : 'Optional'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <FrameworkIcons.Eye size={18} className="text-indigo-500" />
                                <span className="text-xs font-semibold tracking-wide">Anomaly Detection</span>
                            </div>
                            <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <FrameworkIcons.Shield size={18} className="text-green-500" />
                                <span className="text-xs font-semibold tracking-wide">Hardening Level</span>
                            </div>
                            <Badge variant="success">Production</Badge>
                        </div>
                    </div>
                </Card>

                <Card title="Suspicious Activity" className="h-full">
                    <div className="space-y-4 pt-4">
                        {stats.monitor?.suspiciousPlugins?.length > 0 ? (
                           stats.monitor.suspiciousPlugins.map((p: any) => (
                               <div key={p.slug} className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                                   <div className="flex flex-col">
                                       <span className="text-[11px] font-semibold tracking-wide">{p.slug}</span>
                                       <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-1">{p.count} denials recorded</span>
                                   </div>
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                               </div>
                           ))
                        ) : (
                            <div className="p-10 flex flex-col items-center justify-center opacity-40">
                                <FrameworkIcons.Check size={32} className="text-green-500 mb-3" />
                                <p className="text-[10px] font-semibold tracking-wide">No suspicious patterns detected</p>
                            </div>
                        )}
                    </div>
                </Card>
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <>
            <Card title="Account Defense">
              <SettingRow 
                theme={theme}
                icon={FrameworkIcons.Clock}
                title="Login Session Duration (minutes)" 
                description="How long a user stays logged in before re-authentication is required."
              >
                <Input 
                  type="number"
                  min={15}
                  max={43200}
                  value={settings.auth_session_duration_minutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, auth_session_duration_minutes: e.target.value }))}
                  className="w-full md:w-40"
                />
              </SettingRow>

              <SettingRow 
                theme={theme}
                icon={FrameworkIcons.ShieldCheck} 
                title="Two-Factor Security" 
                description="Add an extra layer of security to administrative accounts."
              >
                <Switch 
                  checked={settings.two_factor_enabled} 
                  onChange={(val) => setSettings(prev => ({ ...prev, two_factor_enabled: val }))} 
                />
              </SettingRow>
            </Card>

            <Card title="API Firewall">
              <SettingRow 
                theme={theme}
                icon={FrameworkIcons.ShieldAlert} 
                title="Rate Limit (Max Requests)" 
                description="The maximum number of requests a single IP can make."
              >
                <Input 
                  type="number"
                  value={settings.rate_limit_max}
                  onChange={(e) => setSettings(prev => ({ ...prev, rate_limit_max: e.target.value }))}
                  className="w-full md:w-32"
                />
              </SettingRow>

              <SettingRow 
                theme={theme}
                icon={FrameworkIcons.Clock} 
                title="Rate Limit Window" 
                description="The time window in milliseconds (900000 = 15m)."
              >
                <Input 
                  type="number"
                  value={settings.rate_limit_window}
                  onChange={(e) => setSettings(prev => ({ ...prev, rate_limit_window: e.target.value }))}
                  className="w-full md:w-32"
                />
              </SettingRow>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
