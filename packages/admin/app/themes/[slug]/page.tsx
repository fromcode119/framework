"use client";

import React, { use, useState, useEffect } from 'react';
import { usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { useNotify } from '@/components/NotificationContext';

interface Theme {
  slug: string;
  name: string;
  version: string;
  description?: string;
  state: 'active' | 'inactive';
  author?: string;
  variables?: Record<string, string>;
  layouts?: { name: string; label: string; description?: string }[];
}

export default function ThemeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useNotify();
  const { triggerRefresh, refreshVersion } = usePlugins();
  const searchParams = useSearchParams();
  const [themeDetail, setThemeDetail] = useState<Theme | null>(null);
  const [registryVersion, setRegistryVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  const { theme: adminTheme } = useTheme();

  const fetchTheme = async () => {
    try {
      const [installedData, registryData] = await Promise.all([
        api.get(ENDPOINTS.THEMES.LIST),
        api.get(ENDPOINTS.THEMES.REGISTRY)
      ]);
      
      const found = installedData.find((t: any) => t.slug === slug);
      if (found) {
        setThemeDetail(found);
        
        // Check for updates in registry
        const registry = Array.isArray(registryData) ? registryData : (registryData.themes || []);
        const registryMatch = registry.find((r: any) => r.slug === slug);
        if (registryMatch) {
          setRegistryVersion(registryMatch.version);
        }
      } else {
        router.push('/themes');
      }
    } catch (err) {
      console.error("Failed to fetch theme detail", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheme();
  }, [slug, router, refreshVersion]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'overview') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleActivate = async () => {
    if (!themeDetail) return;
    try {
      await api.post(ENDPOINTS.THEMES.ACTIVATE(themeDetail.slug));
      notify('success', 'Theme Activated', `${themeDetail.name} is now active.`);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Activation Failed', err.message);
    }
  };

  const handleUpdate = async () => {
    if (!themeDetail) return;
    setIsUpdating(true);
    try {
      notify('info', 'Updating...', `Downloading latest version of ${themeDetail.slug}...`);
      await api.post(ENDPOINTS.THEMES.INSTALL(themeDetail.slug));
      notify('success', 'Updated', `Theme ${themeDetail.name} has been updated.`);
      await fetchTheme();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!themeDetail) return;
    if (!confirm(`Are you sure you want to delete theme "${themeDetail.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(ENDPOINTS.THEMES.DELETE(themeDetail.slug));
      notify('success', 'Theme Deleted', `${themeDetail.name} has been removed.`);
      router.push('/themes');
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    }
  };

  const handleTabChange = (tabId: 'overview' | 'settings') => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-6">
        <Link 
          href="/themes"
          className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${adminTheme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
        >
          <FrameworkIcons.Left size={20} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <h1 className={`text-3xl font-black tracking-tighter truncate ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
               {themeDetail.name}
             </h1>
             <Badge variant={themeDetail.state === 'active' ? 'success' : 'gray'}>
                {themeDetail.state}
             </Badge>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${adminTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{themeDetail.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-black uppercase tracking-widest ${registryVersion && registryVersion !== themeDetail.version ? 'text-amber-500' : 'text-slate-400'}`}>
              Version {themeDetail.version}
            </span>
            {registryVersion && registryVersion !== themeDetail.version && (
              <button 
                onClick={handleUpdate}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className={`flex gap-2 p-1.5 rounded-2xl w-fit backdrop-blur-xl border transition-all duration-300 ${
        adminTheme === 'dark' 
          ? 'bg-slate-900/50 border-white/5' 
          : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
      }`}>
          {[
            { id: 'overview', label: 'Overview', icon: FrameworkIcons.Palette },
            { id: 'settings', label: 'Configuration', icon: FrameworkIcons.Settings }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === tab.id 
                ? (adminTheme === 'dark' 
                    ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' 
                    : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50')
                : (adminTheme === 'dark'
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
      </div>

      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'overview' && (
              <Card className={`border-0 relative overflow-hidden p-8 transition-all duration-500 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                <div className="flex items-start gap-8">
                  <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${adminTheme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                     <FrameworkIcons.Palette size={48} strokeWidth={1} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <Badge variant="blue" className="px-3 py-1 font-black uppercase tracking-widest text-[10px] rounded-lg">
                      Visual Package
                    </Badge>
                    <p className={`text-xl leading-relaxed font-medium italic ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {themeDetail.description || "No description provided for this theme."}
                    </p>
                  </div>
                </div>

                <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'}`}>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Layout Architectures</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {themeDetail.layouts?.map(layout => (
                          <div key={layout.name} className={`p-6 rounded-3xl border transition-all ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                             <div className={`text-sm font-black mb-1 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{layout.label}</div>
                             <p className="text-[11px] text-slate-500 font-medium italic">{layout.description || 'Standard platform optimized layout.'}</p>
                          </div>
                      ))}
                   </div>
                </div>

                <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
                  <div className="space-y-1">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Deployment Status</div>
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${themeDetail.state === 'active' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'bg-slate-500'}`} />
                      <span className={`text-sm font-black uppercase tracking-tighter ${themeDetail.state === 'active' ? 'text-green-500' : 'text-slate-500'}`}>
                        System {themeDetail.state}
                      </span>
                    </div>
                  </div>
                  {themeDetail.state !== 'active' && (
                      <button 
                          onClick={handleActivate}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
                      >
                          Activate Environment
                      </button>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card className={`border-0 p-10 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                 <div className="flex items-center gap-4 mb-10">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <FrameworkIcons.Settings size={20} />
                    </div>
                    <div>
                      <h3 className={`text-[11px] font-black uppercase tracking-widest ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Layout Configuration Variables
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">Fine-tune the visual density and color protocols.</p>
                    </div>
                 </div>
                 
                 {themeDetail.variables ? (
                   <div className="grid grid-cols-1 gap-6">
                       {Object.entries(themeDetail.variables).map(([key, value]) => (
                           <div key={key} className={`flex items-center justify-between p-7 rounded-[2.5rem] transition-all duration-500 border group ${
                               adminTheme === 'dark' 
                                 ? 'bg-slate-800/30 border-white/5 hover:border-indigo-500/30' 
                                 : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/20'
                           }`}>
                               <div>
                                   <div className={`text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1`}>{key}</div>
                                   <div className={`text-sm font-black ${adminTheme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{value}</div>
                               </div>
                               {value.startsWith('#') && (
                                   <div className={`w-12 h-12 rounded-2xl shadow-2xl border-4 transform rotate-3 transition-transform group-hover:rotate-0 ${
                                       adminTheme === 'dark' ? 'border-slate-800' : 'border-white ring-1 ring-slate-200/50'
                                   }`} style={{ backgroundColor: value }} />
                               )}
                           </div>
                       ))}
                   </div>
                 ) : (
                   <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] border-slate-100 dark:border-slate-800 bg-slate-50/30">
                      <FrameworkIcons.Info size={32} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No configurable protocols found</p>
                   </div>
                 )}
              </Card>
            )}
          </div>

          <div className="space-y-8">
            <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
              <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-8 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Metadata Artifacts
              </h3>
              <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Architect</span>
                      <span className={`text-[11px] font-black uppercase tracking-wider ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {themeDetail.author || 'Fromcode Official'}
                      </span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry Version</span>
                      <span className={`text-[11px] font-black ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                         v{themeDetail.version}
                      </span>
                   </div>
              </div>
              
              {registryVersion && registryVersion !== themeDetail.version && (
                <div className={`mt-8 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button 
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <FrameworkIcons.Clock size={14} />
                    {isUpdating ? 'Synchronizing...' : `Upgrade to v${registryVersion}`}
                  </button>
                </div>
              )}
            </Card>

            {themeDetail.state !== 'active' && (
              <Card className={`border-0 p-10 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-red-500/10 border border-red-500/20 shadow-2xl shadow-red-500/5' : 'bg-red-50 border border-red-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <FrameworkIcons.Warning size={18} className="text-red-500" />
                    <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${adminTheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        System Purge
                    </h3>
                  </div>
                  <p className={`text-[11px] font-bold leading-relaxed mb-8 ${adminTheme === 'dark' ? 'text-red-300/70' : 'text-red-700/70'}`}>
                      Removing this theme artifact is permanent. All local layout variations will be destroyed.
                  </p>
                  <button 
                      onClick={handleDelete}
                      className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-black/10 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
                  >
                      Destroy Theme
                  </button>
              </Card>
            ) || (
              <div className={`p-8 rounded-[2rem] border-2 border-dashed ${adminTheme === 'dark' ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="flex flex-col items-center gap-3">
                     <FrameworkIcons.Lock size={20} className="text-indigo-500" />
                     <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 text-center opacity-70">
                        Protected: Active core theme
                     </p>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
