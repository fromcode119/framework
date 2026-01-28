"use client";

import React, { use, useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { useNotify } from '@/components/NotificationContext';
import { usePlugins } from '@fromcode/react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Lightbox } from '@/components/ui/Lightbox';

interface MarketplaceTheme {
  slug: string;
  name: string;
  version: string;
  description: string;
  iconUrl?: string;
  screenshots?: string[];
  author: string;
  authorUrl?: string;
  downloadUrl?: string;
  dependencies?: Record<string, string>;
  labels?: string[];
  changelog?: { version: string; date: string; changes: string[] }[];
}

export default function ThemeMarketplaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { theme: adminTheme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh } = usePlugins();
  
  const [theme, setTheme] = useState<MarketplaceTheme | null>(null);
  const [allVersions, setAllVersions] = useState<MarketplaceTheme[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [installedTheme, setInstalledTheme] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => {
    const fetchMarketplaceTheme = async () => {
      try {
        const [regResponse, instResponse] = await Promise.all([
          api.get(ENDPOINTS.THEMES.MARKETPLACE),
          api.get(ENDPOINTS.THEMES.LIST)
        ]);
        
        const themes = Array.isArray(regResponse) ? regResponse : (regResponse.themes || []);
        const versions = themes.filter((t: any) => t.slug === slug);
        
        if (versions.length > 0) {
          // Sort versions descending
          versions.sort((a: any, b: any) => b.version.localeCompare(a.version));
          setAllVersions(versions);
          
          // Default to latest or selected
          const current = selectedVersion ? (versions.find((v: any) => v.version === selectedVersion) || versions[0]) : versions[0];
          setTheme(current);
          if (!selectedVersion) setSelectedVersion(current.version);
          
          setActiveImageIndex(0);
          
          // Find if installed
          const installed = (instResponse || []).find((t: any) => t.slug === slug);
          setInstalledTheme(installed);
        } else {
          router.push('/themes/marketplace');
        }
      } catch (err) {
        console.error("Failed to fetch marketplace theme", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMarketplaceTheme();
  }, [slug, router, selectedVersion]);

  const handleInstall = async () => {
    if (!theme) return;
    setInstalling(true);
    try {
      notify('info', 'Installation Started', `Downloading and setting up ${theme.name} v${theme.version}...`);
      await api.post(`${ENDPOINTS.THEMES.INSTALL(theme.slug)}?version=${theme.version}`);
      notify('success', 'Installation Success', `${theme.name} v${theme.version} has been installed.`);
      triggerRefresh();
      
      // Refresh local state
      const instResponse = await api.get(ENDPOINTS.THEMES.LIST);
      const installed = (instResponse || []).find((t: any) => t.slug === slug);
      setInstalledTheme(installed);
      
    } catch (err: any) {
      notify('error', 'Installation Failed', err.message);
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!theme) return null;

  const hasUpdate = installedTheme && theme.version !== installedTheme.version;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-6">
        <Link 
          href="/themes"
          className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${adminTheme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
        >
          <FrameworkIcons.Left size={24} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <Badge variant="blue" className="px-3 py-1 font-black uppercase tracking-widest text-[10px] rounded-lg mb-2">
            Marketplace Premium
          </Badge>
          <div className="flex items-center gap-3">
             <h1 className={`text-4xl font-black tracking-tighter truncate ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
               {theme.name}
             </h1>
             {allVersions.length > 1 && (
                <div className="ml-4">
                  <Dropdown 
                    align="left"
                    trigger={
                      <div className={`flex items-center gap-3 pl-4 pr-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all cursor-pointer group ${adminTheme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-500/30 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/10'}`}>
                        <span>v{selectedVersion} {selectedVersion === allVersions[0].version ? '(Latest)' : ''}</span>
                        <div className={`transition-colors ${adminTheme === 'dark' ? 'text-slate-600 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>
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
        </div>
        <div className="flex items-center gap-4">
             <button 
                onClick={handleInstall}
                disabled={installing || (installedTheme && !hasUpdate)}
                className={`px-10 py-5 text-xs font-black uppercase tracking-[0.2em] rounded-[2rem] transition-all shadow-2xl active:scale-95 flex items-center gap-3 ${
                  installedTheme && !hasUpdate
                    ? 'bg-emerald-50 text-emerald-600 shadow-none cursor-default opacity-80'
                    : hasUpdate
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
             >
                {installing ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : installedTheme && !hasUpdate ? (
                    <FrameworkIcons.Check size={18} strokeWidth={2.5} />
                ) : hasUpdate ? (
                    <FrameworkIcons.Clock size={18} strokeWidth={2.5} />
                ) : (
                    <FrameworkIcons.Download size={18} strokeWidth={2.5} />
                )}
                {installing ? 'Installing...' : installedTheme && !hasUpdate ? 'Installed' : hasUpdate ? 'Update Theme' : 'Get This Theme'}
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
        <div className="lg:col-span-2 space-y-12">
            {theme.screenshots && theme.screenshots.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            <FrameworkIcons.Image size={14} className="text-indigo-500" />
                            Theme Preview
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div 
                          onClick={() => setShowLightbox(true)}
                          className={`aspect-video rounded-[2.5rem] overflow-hidden border-2 relative group cursor-zoom-in transition-all duration-500 ${
                            adminTheme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.1)]'
                          }`}
                        >
                            <img 
                                src={theme.screenshots[activeImageIndex]} 
                                alt={theme.name} 
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center">
                                <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-white">
                                    <FrameworkIcons.Search size={24} strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>
                        
                        {theme.screenshots.length > 1 && (
                            <div className="px-4 -mx-4 pt-8 pb-8 overflow-x-auto scrollbar-hide">
                                <div className="flex gap-6 w-fit min-w-full">
                                    {theme.screenshots.map((s, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`relative h-24 min-w-[170px] rounded-2xl overflow-hidden border-2 transition-all duration-300 active:scale-95 ${
                                                activeImageIndex === idx 
                                                    ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-10 scale-105 shadow-2xl shadow-indigo-500/20' 
                                                    : (adminTheme === 'dark' ? 'border-white/5 opacity-50 hover:opacity-100' : 'border-white shadow-lg shadow-slate-200/50 opacity-60 hover:opacity-100')
                                            }`}
                                        >
                                            <img src={s} className="w-full h-full object-cover" alt="" />
                                            {activeImageIndex === idx && (
                                                <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                                                   <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                                                      <FrameworkIcons.Check size={12} strokeWidth={4} />
                                                   </div>
                                                </div>
                                             )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`aspect-video rounded-[2.5rem] flex items-center justify-center border-2 border-dashed ${adminTheme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <FrameworkIcons.Image size={64} className="opacity-20" />
                </div>
            )}

            <div className="space-y-6">
                <h3 className={`text-[11px] font-black uppercase tracking-widest ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  About {theme.name}
                </h3>
                <p className={`text-2xl font-medium leading-relaxed ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {theme.description}
                </p>
            </div>

            {theme.changelog && theme.changelog.length > 0 && (
                <div className="space-y-8">
                   <div className="flex items-center gap-4">
                      <div className={`h-8 w-1.5 rounded-full ${adminTheme === 'dark' ? 'bg-indigo-500/40' : 'bg-indigo-600'}`}></div>
                      <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${adminTheme === 'dark' ? 'text-slate-400' : 'text-slate-900/40'}`}>Technical Changelog</h3>
                      <div className={`h-px flex-1 ${adminTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
                   </div>
                   
                   <div className="space-y-8">
                      {theme.changelog.map((log, idx) => (
                        <div key={idx} className="space-y-4">
                           <div className="flex items-center gap-3">
                              <Badge variant="blue" className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider">v{log.version}</Badge>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Released {log.date}</span>
                           </div>
                           <div className={`rounded-[2rem] border-0 overflow-hidden ${adminTheme === 'dark' ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] ring-1 ring-slate-100'}`}>
                              <ul className={`divide-y ${adminTheme === 'dark' ? 'divide-slate-800/50' : 'divide-slate-50'}`}>
                                {log.changes.map((change, cIdx) => (
                                    <li key={cIdx} className={`p-6 flex items-start gap-5 transition-all duration-300 group ${adminTheme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30'}`}>
                                       <div className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                                         adminTheme === 'dark' 
                                           ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white' 
                                           : 'bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20'
                                       }`}>
                                          <FrameworkIcons.Check size={14} strokeWidth={3} />
                                       </div>
                                       <div className="flex-1 space-y-1">
                                          <p className={`text-[13px] font-bold leading-relaxed ${adminTheme === 'dark' ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                             {change}
                                          </p>
                                       </div>
                                    </li>
                                ))}
                              </ul>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
            )}
        </div>

        <div className="space-y-8">
            {theme.dependencies && Object.keys(theme.dependencies).length > 0 && (
              <Card className={`border-0 p-8 ${adminTheme === 'dark' ? 'bg-indigo-500/5' : 'bg-indigo-50/50'}`}>
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  <FrameworkIcons.Puzzle size={16} />
                  Dependency Guard
                </h3>
                <div className="space-y-4">
                  {Object.entries(theme.dependencies).map(([slug, version]) => (
                    <div key={slug} className={`flex items-center justify-between p-4 rounded-2xl border ${adminTheme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100'}`}>
                      <div className="flex flex-col">
                        <span className={`text-xs font-black tracking-tight ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{slug}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Requires {version}</span>
                      </div>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${adminTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <FrameworkIcons.Check size={14} className="text-emerald-500" />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] font-medium text-slate-400 italic leading-relaxed pt-2">
                    Dependencies are automatically resolved and installed alongside the theme.
                  </p>
                </div>
              </Card>
            )}

            <Card className={`border-0 p-8 ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                {hasUpdate && (
                  <div className={`mb-8 p-6 rounded-[2rem] border flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 ${
                    adminTheme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'
                  }`}>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 animate-bounce">
                      <FrameworkIcons.Clock className="text-amber-600" size={24} />
                    </div>
                    <div>
                      <h4 className={`text-sm font-black uppercase tracking-wider leading-tight ${adminTheme === 'dark' ? 'text-amber-400' : 'text-amber-900'}`}>Upgrade Available</h4>
                      <p className={`text-[11px] font-bold mt-1 leading-relaxed ${adminTheme === 'dark' ? 'text-amber-500/70' : 'text-amber-700'}`}>
                        v{theme.version} brings new design improvements and features.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                    <div className={`h-24 w-24 rounded-[2rem] mb-6 shadow-2xl overflow-hidden ring-4 ring-offset-4 ${adminTheme === 'dark' ? 'ring-indigo-500/20 ring-offset-slate-900' : 'ring-indigo-100 ring-offset-white'}`}>
                        {theme.iconUrl ? (
                            <img src={theme.iconUrl} alt={theme.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white">
                                <FrameworkIcons.Palette size={32} />
                            </div>
                        )}
                    </div>

                    <div className="w-full pb-6 mb-6 border-b border-slate-100 dark:border-white/5">
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Current Release</div>
                        <div className={`text-2xl font-black ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>v{theme.version}</div>
                    </div>

                    <div className="w-full space-y-6">
                        <div className="flex justify-between items-center group cursor-default">
                            <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${adminTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                                    <FrameworkIcons.User size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Creator</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>{theme.author}</span>
                        </div>

                        <div className="flex justify-between items-center group cursor-default">
                            <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${adminTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                                    <FrameworkIcons.Layout size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</span>
                            </div>
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest rounded-lg">UI Framework</span>
                        </div>

                        {theme.authorUrl && (
                             <a href={theme.authorUrl} target="_blank" className="flex justify-between items-center group pt-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">Developer Portal</span>
                                <FrameworkIcons.External size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                             </a>
                        )}
                    </div>

                    <button
                      disabled={installing || (installedTheme && !hasUpdate)}
                      onClick={handleInstall}
                      className={`w-full mt-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all duration-300 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0 active:scale-95 ${
                        installedTheme && !hasUpdate
                          ? 'bg-emerald-50 text-emerald-600 cursor-default opacity-80 shadow-none'
                          : hasUpdate
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 hover:shadow-amber-300/40'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300/40'
                      }`}
                    >
                      {installing ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : installedTheme && !hasUpdate ? (
                        <>
                          <FrameworkIcons.Check size={18} strokeWidth={2.5} />
                          Installed
                        </>
                      ) : hasUpdate ? (
                        <>
                          <FrameworkIcons.Clock size={18} strokeWidth={2.5} />
                          Update Now
                        </>
                      ) : (
                        <>
                          <FrameworkIcons.Download size={18} strokeWidth={2.5} />
                          Install Theme
                        </>
                      )}
                    </button>
                </div>
            </Card>

            <div className={`p-8 rounded-[2.5rem] border-2 border-dashed ${adminTheme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                        <FrameworkIcons.Shield size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Verified</div>
                        <div className={`text-xs font-black ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Official UI Audit</div>
                    </div>
                </div>
                <p className={`text-[11px] leading-relaxed font-bold ${adminTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    This theme has been manually audited for WCAG accessibility, performance benchmarks, and Fromcode core compatibility.
                </p>
            </div>
        </div>
      </div>

      <Lightbox 
        images={theme.screenshots || []}
        currentIndex={activeImageIndex}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        onNavigate={setActiveImageIndex}
        title={theme.name}
      />
    </div>
  );
}
