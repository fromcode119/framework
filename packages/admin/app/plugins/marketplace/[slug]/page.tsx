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
import { PluginEntry } from '@fromcode/core';
import { Dropdown } from '@/components/ui/Dropdown';
import { Lightbox } from '@/components/ui/Lightbox';

export default function MarketplaceDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh } = usePlugins();
  const [plugin, setPlugin] = useState<PluginEntry | null>(null);
  const [allVersions, setAllVersions] = useState<PluginEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [installedPlugin, setInstalledPlugin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [marketData, instData] = await Promise.all([
        api.get(ENDPOINTS.PLUGINS.MARKETPLACE),
        api.get(ENDPOINTS.PLUGINS.LIST)
      ]);
      
      const versions = (marketData.plugins || []).filter((p: any) => p.slug === slug);
      if (versions.length === 0) {
        setError('Plugin not found in marketplace.');
      } else {
        // Sort descending
        versions.sort((a: any, b: any) => b.version.localeCompare(a.version));
        setAllVersions(versions);
        
        const current = selectedVersion ? (versions.find((v: any) => v.version === selectedVersion) || versions[0]) : versions[0];
        setPlugin(current);
        if (!selectedVersion) setSelectedVersion(current.version);
        
        // Reset active image when plugin changes
        setActiveImageIndex(0);

        setInstalledPlugin((instData || []).find((p: any) => p.slug === slug));
      }
    } catch (err) {
      console.error('Failed to load plugin details', err);
      setError('Failed to connect to the marketplace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug, selectedVersion]);

  const handleInstall = async (pluginSlug: string) => {
    if (!plugin) return;
    try {
      notify('info', 'Installation Started', `Downloading and staging ${pluginSlug} v${plugin.version}...`);
      await api.post(`${ENDPOINTS.PLUGINS.INSTALL(pluginSlug)}?version=${plugin.version}`, {});
      notify('success', 'Installation Complete', `Plugin "${pluginSlug}" v${plugin.version} installed successfully.`);
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
                     <div className="flex items-center gap-3">
                        <h2 className={`text-4xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{plugin.name}</h2>
                        {allVersions.length > 1 && (
                          <div className="ml-4">
                            <Dropdown 
                              align="left"
                              trigger={
                                <div className={`flex items-center gap-3 pl-4 pr-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all cursor-pointer group ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-500/30 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/10'}`}>
                                  <span>v{selectedVersion} {selectedVersion === allVersions[0].version ? '(Latest)' : ''}</span>
                                  <div className={`transition-colors ${theme === 'dark' ? 'text-slate-600 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                                    <FrameworkIcons.Down size={14} strokeWidth={3} />
                                  </div>
                                </div>
                              }
                              items={allVersions.map(v => ({
                                label: `v${v.version} ${v.version === allVersions[0].version ? '(Latest)' : ''}`,
                                onClick: () => setSelectedVersion(v.version),
                                icon: <FrameworkIcons.Clock size={14} />
                              }))}
                            />
                          </div>
                        )}
                     </div>
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <FrameworkIcons.Image size={14} className="text-indigo-500" />
                  Product Screenshots
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                  {plugin.screenshots.length} Images
                </span>
              </div>
              
              <div className="space-y-4">
                <div 
                  onClick={() => setShowLightbox(true)}
                  className={`aspect-video rounded-[2.5rem] overflow-hidden border-2 relative group cursor-zoom-in transition-all duration-500 ${
                    theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.1)]'
                  }`}
                >
                    <img 
                      src={typeof plugin.screenshots[activeImageIndex] === 'string' ? (plugin.screenshots[activeImageIndex] as string) : (plugin.screenshots[activeImageIndex] as any).url} 
                      alt="Main Screenshot" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-white">
                           <FrameworkIcons.Search size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                </div>

                {plugin.screenshots.length > 1 && (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {plugin.screenshots.map((item, idx) => {
                      const src = typeof item === 'string' ? item : item.url;
                      return (
                        <button 
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative h-24 min-w-[160px] rounded-2xl overflow-hidden border-2 transition-all duration-300 active:scale-95 ${
                            activeImageIndex === idx 
                              ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-10 scale-105' 
                              : (theme === 'dark' ? 'border-white/5 opacity-50 hover:opacity-100' : 'border-white shadow-lg shadow-slate-200/50 opacity-60 hover:opacity-100')
                          }`}
                        >
                          <img 
                            src={src} 
                            alt={`Thumbnail ${idx + 1}`} 
                            className="w-full h-full object-cover" 
                          />
                           {activeImageIndex === idx && (
                              <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                                 <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                                    <FrameworkIcons.Check size={12} strokeWidth={4} />
                                 </div>
                              </div>
                           )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {plugin.changelog && plugin.changelog.length > 0 && (
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className={`h-8 w-1.5 rounded-full ${theme === 'dark' ? 'bg-indigo-500/40' : 'bg-indigo-600'}`}></div>
                  <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900/40'}`}>Technical Changelog</h3>
                  <div className={`h-px flex-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
               </div>
               
               <div className={`rounded-[2rem] border-0 overflow-hidden ${theme === 'dark' ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] ring-1 ring-slate-100'}`}>
                  <ul className={`divide-y ${theme === 'dark' ? 'divide-slate-800/50' : 'divide-slate-50'}`}>
                     {plugin.changelog.map((log, idx) => (
                       <li key={idx} className={`p-6 flex items-start gap-5 transition-all duration-300 group ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30'}`}>
                          <div className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            theme === 'dark' 
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white' 
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20'
                          }`}>
                             <FrameworkIcons.Check size={14} strokeWidth={3} />
                          </div>
                          <div className="flex-1 space-y-1">
                             <p className={`text-[13px] font-bold leading-relaxed ${theme === 'dark' ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                {log}
                             </p>
                          </div>
                       </li>
                     ))}
                  </ul>
               </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-6">
           <Card noPadding className={`sticky top-8 overflow-hidden ${theme === 'dark' ? 'bg-[#0f172a] ring-1 ring-white/5 border-0' : 'bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border-slate-100'}`}>
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  {!installedPlugin ? (
                    <button 
                      onClick={() => handleInstall(plugin.slug)}
                      className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95 group ${
                        theme === 'dark' 
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                      }`}
                    >
                      <FrameworkIcons.Download size={20} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
                      <span className="uppercase tracking-[0.15em] text-xs">Install Extension</span>
                    </button>
                  ) : hasUpdate ? (
                    <div className={`p-1 rounded-[2rem] ${theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                      <div className={`p-6 rounded-[1.75rem] border border-dashed flex flex-col items-center text-center ${theme === 'dark' ? 'border-amber-500/30' : 'border-amber-200'}`}>
                        <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 animate-bounce duration-[2000ms]">
                           <FrameworkIcons.Refresh size={24} strokeWidth={3} />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">Update Available</div>
                        <div className={`text-base font-black mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>v{plugin.version} is ready</div>
                        
                        <button 
                          onClick={() => handleInstall(plugin.slug)}
                          className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                        >
                          Apply Update Now
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${
                      installedPlugin.state === 'active' 
                        ? (theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-500/5') 
                        : (theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600')
                    }`}>
                      <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-current/10' : 'bg-white shadow-sm ring-1 ring-slate-100'}`}>
                        {installedPlugin.state === 'active' ? (
                          <FrameworkIcons.CheckCircle2 size={24} strokeWidth={3.5} />
                        ) : (
                          <FrameworkIcons.Box size={24} strokeWidth={3.5} />
                        )}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.3em]">{installedPlugin.state === 'active' ? 'Fully Active' : 'Installed'}</span>
                    </div>
                  )}
                  
                  <button className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] border-2 transition-all ${
                    theme === 'dark' 
                      ? 'border-white/5 text-slate-500 hover:bg-white/5 hover:text-white' 
                      : 'border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
                  }`}>
                     Share Extension
                  </button>
                </div>

                <div className={`h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100/60'}`} />

                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Security Permissions</h4>
                     <FrameworkIcons.Shield size={14} className="text-slate-400" />
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {(plugin.capabilities || []).map(cap => (
                        <Badge key={cap} variant="gray" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border-0 ${
                          theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cap.split(':').pop()}
                        </Badge>
                      ))}
                   </div>
                </div>

                <div className={`p-6 rounded-[2rem] space-y-4 ${theme === 'dark' ? 'bg-slate-950/40 border border-white/5' : 'bg-slate-50/50 border border-slate-100/50'}`}>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Namespace</span>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {plugin.slug}
                      </span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Ver</span>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                        v{plugin.version}
                      </span>
                   </div>
                </div>
              </div>
           </Card>
        </div>
      </div>

      <Lightbox 
        images={(plugin.screenshots || []).map(s => typeof s === 'string' ? s : s.url)}
        currentIndex={activeImageIndex}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        onNavigate={setActiveImageIndex}
        title={plugin.name}
      />
    </div>
  );
}
