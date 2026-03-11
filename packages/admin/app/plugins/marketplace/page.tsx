"use client";

import React, { useEffect, useState } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@/lib/icons';
import { ThemeHooks } from '@/components/use-theme';
import { NotificationHooks } from '@/components/use-notification';
import { ContextHooks } from '@fromcode119/react';
import { useRouter } from 'next/navigation';
import type { PluginEntry } from '@fromcode119/core';

export default function MarketplacePage() {
  const router = useRouter();
  const { theme } = ThemeHooks.useTheme();
  const { notify } = NotificationHooks.useNotify();
  const { triggerRefresh } = ContextHooks.usePlugins();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST)
      ]);
      const rawPlugins = marketData.plugins || [];
      
      // Group by slug to show only latest
      const grouped: Record<string, PluginEntry> = {};
      rawPlugins.forEach((p: PluginEntry) => {
        if (!grouped[p.slug] || p.version > grouped[p.slug].version) {
          grouped[p.slug] = p;
        }
      });

      setPlugins(Object.values(grouped));
      setInstalledPlugins(Array.isArray(instData) ? instData : []);
    } catch (err) {
      console.error("Failed to fetch marketplace data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInstall = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    console.log('[Marketplace] Installing plugin:', slug);
    if (installing) return;

    try {
      setInstalling(slug);
      notify('info', 'Installation Started', `Downloading and staging ${slug}...`);
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.INSTALL(slug), {});
      console.log('[Marketplace] Install response:', response);
      notify('success', 'Installation Complete', `Plugin "${slug}" installed successfully.`);
      
      // Refresh both the local marketplace state and the global plugin context
      await fetchData();
      triggerRefresh();
    } catch (err: any) {
      console.error('[Marketplace] Installation failed:', err);
      notify('error', 'Installation Failed', err.message || 'Failed to install plugin');
    } finally {
      setInstalling(null);
    }
  };

  const filtered = plugins.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="relative flex-1 group">
        <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
        <input 
          type="text" 
          placeholder="Search global marketplace..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full rounded-2xl py-2.5 pl-11 pr-6 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/5' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-xl shadow-slate-200/50'}`} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
           [1,2,3,4,5,6].map(i => (
             <div key={i} className={`h-80 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />
           ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                <FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" />
             </div>
             <h3 className={`text-lg font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3>
             <p className="text-slate-500 font-medium">Try a different search term or check your marketplace connection.</p>
          </div>
        ) : (
          filtered.map(plugin => {
            const installed = installedPlugins.find(p => (p.manifest?.slug || p.slug) === plugin.slug);
            const hasUpdate = installed && plugin.version !== (installed.manifest?.version || installed.version);
            const hasImageError = imageErrors[plugin.slug];

            return (
              <Card 
                key={plugin.slug} 
                onClick={() => router.push(`/plugins/marketplace/${plugin.slug}`)}
                className={`group flex flex-col h-full border-0 relative transition-all duration-700 cursor-pointer overflow-hidden rounded-[2rem] ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-2xl shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
              >
                <div className="p-8 space-y-6 flex-1 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-110 shadow-lg flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                      {plugin.iconUrl && !hasImageError ? (
                        <img 
                          src={plugin.iconUrl} 
                          alt={plugin.name} 
                          className="w-10 h-10 object-contain" 
                          onError={() => setImageErrors(prev => ({ ...prev, [plugin.slug]: true }))}
                        />
                      ) : (
                        <FrameworkIcons.Box size={32} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.isFeatured && (
                        <Badge variant="blue" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                          Featured
                        </Badge>
                      )}
                      <Badge variant={installed ? "success" : "blue"} className="flex-shrink-0 font-semibold">
                        {installed ? "Installed" : (plugin.category || "Available")}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <h3 className={`text-xl font-bold tracking-tight leading-tight transition-colors duration-300 group-hover:text-indigo-500 line-clamp-2 min-h-[4rem] flex-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {plugin.name}
                      </h3>
                      {plugin.isVerified && (
                        <div className="bg-emerald-500/10 p-1.5 rounded-full text-emerald-500" title="Verified Publisher">
                          <FrameworkIcons.Shield size={18} fill="currentColor" className="opacity-80" />
                        </div>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed font-medium line-clamp-3 h-[4rem] transition-colors duration-300 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>
                      {plugin.description}
                    </p>
                  </div>
                  
                  <div className={`flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                     <div className="flex items-center gap-1.5 flex-shrink-0">
                       <FrameworkIcons.Shield size={12} className="text-indigo-500/70" />
                       v{plugin.version}
                     </div>
                     <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                     <div className="flex items-center gap-1.5 min-w-0">
                       <FrameworkIcons.User size={12} className="text-indigo-500/70" />
                       <span className="truncate flex items-center gap-1">
                        {plugin.author || 'Official Developer'}
                        {plugin.isVerified && (
                          <FrameworkIcons.Check size={10} className="text-emerald-500" strokeWidth={3} />
                        )}
                       </span>
                     </div>
                     {plugin.isTrending && (
                       <>
                         <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                         <div className="flex items-center gap-1.5 text-rose-500">
                           <FrameworkIcons.Loader size={10} className="animate-spin" />
                           Trending
                         </div>
                       </>
                     )}
                  </div>
                </div>

                <div className="px-8 pb-8 space-y-4">
                  {installed && hasUpdate && (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100 shadow-sm'}`}>
                       <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                       <span className={`text-[10px] font-bold uppercase tracking-wide leading-none ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>New Update v{plugin.version}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {installed && !hasUpdate ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/plugins/${plugin.slug}`); }}
                        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                      >
                        <FrameworkIcons.Check size={16} />
                        <span>Installed</span>
                      </button>
                    ) : hasUpdate ? (
                      <button 
                        onClick={(e) => handleInstall(e, plugin.slug)}
                        disabled={!!installing}
                        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all shadow-lg active:scale-[0.97] bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20 hover:-translate-y-1 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
                       >
                         <FrameworkIcons.Loader size={16} className="animate-spin" />
                         <span>{installing === plugin.slug ? 'Updating...' : 'Update Plugin'}</span>
                       </button>
                    ) : (
                      <button 
                        onClick={(e) => handleInstall(e, plugin.slug)}
                        disabled={!!installing}
                        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all shadow-lg active:scale-[0.97] bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 hover:-translate-y-1 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
                       >
                         {installing === plugin.slug ? (
                           <FrameworkIcons.Loader size={16} className="animate-spin" />
                         ) : (
                           <FrameworkIcons.Download size={16} />
                         )}
                         <span>{installing === plugin.slug ? 'Installing...' : 'Install Now'}</span>
                       </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
