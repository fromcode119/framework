'use client';

import React, { useEffect, useState } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { FrameworkIcons } from '@/lib/icons';
import { ThemeHooks } from '../use-theme';
import { NotificationHooks } from '../use-notification';
import { ContextHooks } from '@fromcode119/react';

import { useRouter } from 'next/navigation';
import type { PluginEntry } from '@fromcode119/core';

const Marketplace: React.FC = () => {
  const router = useRouter();
  const { theme } = ThemeHooks.useTheme();
  const { notify } = NotificationHooks.useNotify();
  const { triggerRefresh } = ContextHooks.usePlugins();
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginEntry[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST)
      ]);
      
      setMarketplacePlugins(marketData.plugins || []);
      setInstalledPlugins(Array.isArray(instData) ? instData : []);
    } catch (err) {
      console.error('Failed to load marketplace data', err);
      setError('Failed to connect to the marketplace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInstall = async (slug: string) => {
    try {
      notify('info', 'Installation Started', `Downloading and staging ${slug}...`);
      await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.INSTALL(slug), {});
      notify('success', 'Installation Complete', `Plugin "${slug}" installed successfully.`);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      notify('error', 'Network Error', err.message || 'Failed to connect to server');
    }
  };

  const handleInstallClick = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    handleInstall(slug);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <FrameworkIcons.Loader className="h-10 w-10 animate-spin text-indigo-600" />
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Connecting to Global Marketplace...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-96 p-8 rounded-3xl border-2 border-dashed ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
           <FrameworkIcons.Alert size={40} className="text-red-500" />
        </div>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Connection Error</h3>
        <p className={`text-sm text-center max-w-sm mt-2 mb-6 ${theme === 'dark' ? 'text-red-200/60' : 'text-red-700/70'}`}>
          {error} Please check your internet connection or API server status.
        </p>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
        >
          <FrameworkIcons.Refresh size={18} />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {marketplacePlugins.map(plugin => {
          const installed = installedPlugins.find(p => (p.manifest?.slug || p.slug) === plugin.slug);
          const hasUpdate = installed && plugin.version !== installed.version;
          const hasImageError = imageErrors[plugin.slug];

          return (
            <Card 
              key={plugin.slug} 
              onClick={() => router.push(`/plugins/marketplace/${plugin.slug}`)}
              className={`group flex flex-col h-full border-0 relative transition-all duration-700 cursor-pointer overflow-hidden rounded-[3rem] ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-2xl shadow-slate-200/50 hover:shadow-indigo-500/20'}`}
            >
              {/* Massive subtle background icon */}
              <div className="absolute -right-12 -top-12 opacity-[0.03] transition-transform duration-1000 group-hover:scale-150 group-hover:rotate-12">
                 <FrameworkIcons.Plugins size={320} />
              </div>

              <div className="p-10 space-y-8 flex-1 relative">
                <div className="flex items-center gap-8">
                  <div className={`h-24 w-24 rounded-[2.5rem] flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-110 shadow-2xl ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                    {plugin.iconUrl && !hasImageError ? (
                      <img 
                        src={plugin.iconUrl} 
                        alt={plugin.name} 
                        className="w-14 h-14 object-contain" 
                        onError={() => setImageErrors(prev => ({ ...prev, [plugin.slug]: true }))}
                      />
                    ) : (
                      <FrameworkIcons.Box size={48} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant={installed ? "success" : "blue"} className="font-semibold tracking-wide px-4 py-1.5 text-[10px] rounded-xl mb-3 inline-flex shadow-sm bg-indigo-600 text-white border-0">
                      {installed ? "Installed" : (plugin.category || "Available Plugin")}
                    </Badge>
                    <h3 className={`text-3xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-indigo-500 truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {plugin.name}
                    </h3>
                    
                    {plugin.rating && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FrameworkIcons.Star 
                              key={star} 
                              size={12} 
                              className={star <= Math.round(plugin.rating!.average) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} 
                            />
                          ))}
                        </div>
                        <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {plugin.rating.average} ({plugin.rating.count})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <p className={`text-[15px] leading-relaxed font-medium line-clamp-2 h-[3rem] transition-colors duration-300 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>
                    {plugin.description}
                  </p>
                  
                  <div className={`flex items-center gap-6 text-[10px] font-semibold tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                     <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-white/5">
                       <FrameworkIcons.Shield size={12} className="text-indigo-500" />
                       v{plugin.version}
                     </div>
                     <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-white/5 truncate max-w-[150px]">
                       <FrameworkIcons.User size={12} className="text-indigo-500" />
                       {plugin.author || 'Official'}
                     </div>
                  </div>
                </div>
              </div>

              <div className="px-10 pb-10 space-y-6">
                {installed && hasUpdate && (
                  <div className="flex items-center gap-4 p-5 bg-amber-500 text-white rounded-[2rem] shadow-xl shadow-amber-500/20 animate-pulse">
                     <FrameworkIcons.Loader size={20} className="animate-spin" />
                     <div className="flex flex-col">
                        <span className="text-[11px] font-semibold tracking-wide leading-none">New Version Available</span>
                        <span className="text-[10px] font-semibold tracking-wide opacity-80">v{plugin.version} is ready</span>
                     </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {installed ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); router.push(`/plugins/${plugin.slug}`); }}
                      className={`w-full flex-1 flex items-center justify-center gap-3 h-16 rounded-[1.5rem] text-[12px] font-semibold tracking-wide transition-all shadow-xl ${theme === 'dark' ? 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                      <FrameworkIcons.Plugins size={18} />
                      <span>Manage Plugin</span>
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => handleInstallClick(e, plugin.slug)}
                      className={`w-full flex-1 flex items-center justify-center gap-3 h-16 rounded-[1.5rem] text-[12px] font-semibold tracking-wide transition-all shadow-2xl active:scale-[0.97] ${theme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'}`}
                     >
                       <FrameworkIcons.Download size={20} />
                       <span>Install Plugin</span>
                     </button>
                  )}
                  
                  <div className={`h-16 w-16 hidden sm:flex rounded-[1.5rem] items-center justify-center transition-all flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 shadow-sm'}`}>
                     <FrameworkIcons.Right size={24} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Marketplace;
