"use client";

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FrameworkIcons } from '@/lib/icons';
import { useTheme } from '@/components/ThemeContext';
import { useNotify } from '@/components/NotificationContext';
import { usePlugins } from '@fromcode/react';
import { useRouter } from 'next/navigation';

interface PluginEntry {
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  iconUrl?: string;
  author?: string;
}

export default function MarketplacePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh } = usePlugins();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regData, instData] = await Promise.all([
        api.get(ENDPOINTS.PLUGINS.REGISTRY),
        api.get(ENDPOINTS.PLUGINS.LIST)
      ]);
      setPlugins(regData.plugins || []);
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
    try {
      notify('info', 'Installation Started', `Downloading and staging ${slug}...`);
      await api.post(ENDPOINTS.PLUGINS.INSTALL(slug), {});
      notify('success', 'Installation Complete', `Plugin "${slug}" installed successfully.`);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      notify('error', 'Network Error', err.message || 'Failed to connect to server');
    }
  };

  const filtered = plugins.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="relative flex-1 group">
        <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
        <input 
          type="text" 
          placeholder="Search global registry..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full rounded-2xl py-4 pl-12 pr-6 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/5' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-xl shadow-slate-200/50'}`} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {loading ? (
           [1,2,3,4,5,6,7,8].map(i => (
             <div key={i} className={`h-64 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />
           ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                <FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" />
             </div>
             <h3 className={`text-xl font-black mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3>
             <p className="text-slate-500 font-medium">Try a different search term or check your registry connection.</p>
          </div>
        ) : (
          filtered.map(plugin => {
            const installed = installedPlugins.find(p => p.slug === plugin.slug);
            const hasUpdate = installed && plugin.version !== installed.version;
            const hasImageError = imageErrors[plugin.slug];

            return (
              <Card 
                key={plugin.slug} 
                onClick={() => router.push(`/plugins/marketplace/${plugin.slug}`)}
                className={`group flex flex-col h-full border-0 relative transition-all duration-700 cursor-pointer overflow-hidden rounded-3xl ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
              >
                <div className="p-5 space-y-4 flex-1 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-110 shadow-lg flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                      {plugin.iconUrl && !hasImageError ? (
                        <img 
                          src={plugin.iconUrl} 
                          alt={plugin.name} 
                          className="w-8 h-8 object-contain" 
                          onError={() => setImageErrors(prev => ({ ...prev, [plugin.slug]: true }))}
                        />
                      ) : (
                        <FrameworkIcons.Box size={24} strokeWidth={1.5} />
                      )}
                    </div>
                    <Badge variant={installed ? "success" : "blue"} className="font-black tracking-widest px-2.5 py-1 text-[8px] uppercase rounded-lg shadow-sm bg-indigo-600 text-white border-0 flex-shrink-0">
                      {installed ? "Installed" : (plugin.category || "Available")}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className={`text-lg font-black tracking-tighter leading-tight transition-colors duration-300 group-hover:text-indigo-500 line-clamp-2 min-h-[2.75rem] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {plugin.name}
                    </h3>
                    <p className={`text-[12px] leading-relaxed font-medium line-clamp-3 h-[3.75rem] transition-colors duration-300 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>
                      {plugin.description}
                    </p>
                  </div>
                  
                  <div className={`flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500/80'}`}>
                     <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                       <FrameworkIcons.Shield size={10} className="text-indigo-500" />
                       v{plugin.version}
                     </div>
                     <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border min-w-0 ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                       <FrameworkIcons.User size={10} className="text-indigo-500" />
                       <span className="truncate">{plugin.author || 'Official'}</span>
                     </div>
                  </div>
                </div>

                <div className="px-5 pb-5 space-y-3">
                  {installed && hasUpdate && (
                    <div className="flex items-center gap-3 p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20 animate-pulse">
                       <FrameworkIcons.Refresh size={14} className="animate-spin-slow" />
                       <span className="text-[10px] font-black uppercase tracking-widest leading-none">Update Ready (v{plugin.version})</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {installed ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/plugins/${plugin.slug}`); }}
                        className={`w-full flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${theme === 'dark' ? 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                      >
                        <FrameworkIcons.Plugins size={14} />
                        <span>Manage</span>
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => handleInstall(e, plugin.slug)}
                        className={`w-full flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-[0.97] ${theme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'}`}
                       >
                         <FrameworkIcons.Download size={16} />
                         <span>Install</span>
                       </button>
                    )}
                    
                    <div className={`h-12 w-12 hidden sm:flex rounded-xl items-center justify-center transition-all flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400 shadow-sm'}`}>
                       <FrameworkIcons.Right size={18} />
                    </div>
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
