"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FrameworkIcons } from '@/lib/icons';
import { useTheme } from '@/components/ThemeContext';
import { useNotify } from '@/components/NotificationContext';
import { usePlugins } from '@fromcode/react';

interface PluginEntry {
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  downloadUrl?: string;
  changelog?: string[];
  author?: string;
  homepage?: string;
  capabilities?: string[];
  screenshots?: string[];
  iconUrl?: string;
}

export default function PluginMarketplaceDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh } = usePlugins();
  const [plugin, setPlugin] = useState<PluginEntry | null>(null);
  const [installedPlugin, setInstalledPlugin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [regData, instData] = await Promise.all([
        api.get(ENDPOINTS.PLUGINS.REGISTRY),
        api.get(ENDPOINTS.PLUGINS.LIST)
      ]);
      
      const found = (regData.plugins || []).find((p: any) => p.slug === slug);
      if (!found) {
        setError('Plugin not found in registry.');
      } else {
        setPlugin(found);
        setInstalledPlugin((instData || []).find((p: any) => p.slug === slug));
      }
    } catch (err) {
      console.error('Failed to load plugin details', err);
      setError('Failed to connect to the marketplace registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const handleInstall = async (pluginSlug: string) => {
    try {
      notify('info', 'Installation Started', `Downloading and staging ${pluginSlug}...`);
      await api.post(ENDPOINTS.PLUGINS.INSTALL(pluginSlug), {});
      notify('success', 'Installation Complete', `Plugin "${pluginSlug}" installed successfully.`);
      triggerRefresh();
      fetchData();
    } catch (err: any) {
      notify('error', 'Installation Failed', err.message || 'Failed to install plugin.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading plugin details...
        </p>
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
           <FrameworkIcons.Alert size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Error</h2>
        <p className="text-slate-500">{error || 'Plugin not found'}</p>
        <button onClick={() => router.push('/plugins/marketplace')} className="text-indigo-600 font-bold hover:underline">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const hasUpdate = installedPlugin && plugin.version !== installedPlugin.version;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <button 
        onClick={() => router.push('/plugins/marketplace')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
      >
        <FrameworkIcons.Left size={16} />
        Back to Marketplace
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-start gap-6">
               <div className={`h-24 w-24 rounded-3xl flex items-center justify-center p-4 overflow-hidden relative ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                 {plugin.iconUrl ? (
                   <>
                     <img 
                        src={plugin.iconUrl} 
                        alt={plugin.name} 
                        className="w-full h-full object-contain filter drop-shadow-md z-10" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                     />
                     <div className="hidden items-center justify-center">
                       <FrameworkIcons.Box size={48} />
                     </div>
                   </>
                 ) : (
                   <FrameworkIcons.Box size={48} />
                 )}
               </div>
               <div className="flex-1">
                  <div className="flex justify-between items-start">
                     <h2 className={`text-4xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{plugin.name}</h2>
                     <Badge variant={installedPlugin ? "success" : "blue"} className="px-4 py-1 text-xs font-bold uppercase tracking-widest">{plugin.category || 'General'}</Badge>
                  </div>
                  <p className={`mt-4 text-lg leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {plugin.description}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-6 mt-8">
                     <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                           <FrameworkIcons.User size={16} />
                        </div>
                        <div>
                           <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Developer</div>
                           <div className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{plugin.author || 'Anonymous'}</div>
                        </div>
                     </div>
                     {plugin.homepage && (
                       <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                             <FrameworkIcons.Globe size={16} />
                          </div>
                          <div>
                             <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Official Site</div>
                             <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-500 hover:underline">Visit Homepage</a>
                          </div>
                       </div>
                     )}
                     <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                           <FrameworkIcons.Code size={16} />
                        </div>
                        <div>
                           <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Version</div>
                           <div className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>v{plugin.version}</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {plugin.screenshots && plugin.screenshots.length > 0 && (
            <div className="space-y-4">
              <h3 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <FrameworkIcons.Image size={20} className="text-indigo-500" />
                App Screenshots
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plugin.screenshots.map((src, idx) => (
                  <div key={idx} className={`aspect-video rounded-3xl overflow-hidden border relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
                    <img 
                      src={src} 
                      alt={`Screenshot ${idx + 1}`} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center bg-slate-500/10">
                       <FrameworkIcons.Image size={48} className="text-slate-400 opacity-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plugin.changelog && plugin.changelog.length > 0 && (
            <div className="space-y-4">
               <h3 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  <FrameworkIcons.Clock size={20} className="text-indigo-500" />
                  Technical Changelog
               </h3>
               <div className={`rounded-3xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                     {plugin.changelog.map((log, idx) => (
                       <li key={idx} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          <div className="mt-1 h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                             <FrameworkIcons.Check size={12} />
                          </div>
                          <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{log}</span>
                       </li>
                     ))}
                  </ul>
               </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-6">
           <Card className="p-8 space-y-6 sticky top-8">
              <div className="space-y-4">
                {!installedPlugin ? (
                  <button 
                    onClick={() => handleInstall(plugin.slug)}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                  >
                    <FrameworkIcons.Download size={24} />
                    Get Plugin Now
                  </button>
                ) : hasUpdate ? (
                  <button 
                    onClick={() => handleInstall(plugin.slug)}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                  >
                    <FrameworkIcons.Refresh size={24} />
                    Update to v{plugin.version}
                  </button>
                ) : (
                  <div className={`w-full flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed ${installedPlugin.state === 'active' ? (theme === 'dark' ? 'bg-green-500/5 border-green-500/20' : 'bg-green-50 border-green-100') : (theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100')}`}>
                    {installedPlugin.state === 'active' ? (
                      <>
                        <FrameworkIcons.CheckCircle2 size={32} className="text-green-500" />
                        <span className="text-sm font-black text-green-600 uppercase tracking-widest">Active on System</span>
                      </>
                    ) : (
                      <>
                        <FrameworkIcons.Box size={32} className="text-amber-500" />
                        <span className="text-sm font-black text-amber-600 uppercase tracking-widest">Installed on System</span>
                      </>
                    )}
                  </div>
                )}
                
                <button className={`w-full py-4 rounded-2xl border font-bold transition-all ${theme === 'dark' ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                   Share Plugin
                </button>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <div className="space-y-4">
                 <h4 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Requested Permissions</h4>
                 <div className="flex flex-wrap gap-2">
                    {(plugin.capabilities || []).map(cap => (
                      <Badge key={cap} variant="gray" className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{cap.replace(':', ' ')}</Badge>
                    ))}
                 </div>
              </div>

              <div className="pt-4 space-y-3">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Category</span>
                    <span className={`font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{plugin.category || 'General'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Version</span>
                    <span className={`font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>v{plugin.version}</span>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
}
