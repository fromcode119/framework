"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NotificationHooks } from '@/components/use-notification';
import { FrameworkIcons } from '@/lib/icons';
import { useRouter } from 'next/navigation';
import type { MarketplaceTheme } from '@fromcode119/core';

export default function ThemesMarketplacePage() {
  const { theme } = ThemeHooks.useTheme();
  const { notify } = NotificationHooks.useNotify();
  const { triggerRefresh } = ContextHooks.usePlugins();
  const router = useRouter();
  const [themes, setThemes] = useState<MarketplaceTheme[]>([]);
  const [installedThemes, setInstalledThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [marketData, installedRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST)
      ]);
      
      const marketplace = Array.isArray(marketData) ? marketData : (marketData.themes || []);
      const installed = Array.isArray(installedRes) ? installedRes : (installedRes.themes || []);
      
      // Group by slug to show only latest in the list
      const grouped: Record<string, MarketplaceTheme> = {};
      marketplace.forEach((t: MarketplaceTheme) => {
        if (!grouped[t.slug] || t.version > grouped[t.slug].version) {
          grouped[t.slug] = t;
        }
      });

      setThemes(Object.values(grouped));
      setInstalledThemes(installed);
    } catch (err) {
      console.error("Failed to fetch marketplace themes", err);
      notify('error', 'Marketplace Error', 'Could not load marketplace themes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleInstall = async (slug: string) => {
    try {
      notify('info', 'Installing...', `Downloading theme ${slug}...`);
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(slug));
      notify('success', 'Installed', `Theme ${slug} is now available.`);
      triggerRefresh();
      fetchData(); // Refresh list to show installed state
    } catch (err: any) {
      notify('error', 'Installation Failed', err.message);
    }
  };

  if (loading) {
    return (
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`h-80 rounded-[2.5rem] animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="w-full">
        {themes.length === 0 ? (
          <div className="py-20 text-center rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <FrameworkIcons.ShoppingBag size={32} className="text-slate-300 dark:text-slate-700" />
            </div>
            <h3 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Marketplace empty</h3>
            <p className="text-slate-500 font-medium">Check your marketplace connection or try again later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {themes.map(t => {
              const installed = installedThemes.find(it => it.slug === t.slug);
              const hasUpdate = installed && t.version !== installed.version;

              return (
                <Card 
                  key={t.slug}
                  onClick={() => router.push(`/themes/marketplace/${t.slug}`)}
                  className={`group flex flex-col border-0 relative transition-all duration-700 cursor-pointer overflow-hidden rounded-[2.5rem] ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-2xl shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
                >
                  <div className="p-10 space-y-6 flex-1">
                    <div className="flex items-start justify-between">
                      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-110 shadow-lg ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                        {t.iconUrl ? <img src={t.iconUrl} className="w-10 h-10 rounded-lg object-contain" alt="" /> : <FrameworkIcons.Palette size={32} />}
                      </div>
                      <Badge variant={installed ? "success" : "blue"} className="font-semibold tracking-wide px-3 py-1.5 text-[9px] uppercase rounded-xl">
                        {installed ? "Installed" : "Premium"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <h3 className={`text-2xl font-bold tracking-tight leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'} group-hover:text-indigo-600 transition-colors`}>
                        {t.name}
                      </h3>
                      <p className={`text-sm leading-relaxed font-medium line-clamp-3 h-[4.5rem] italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t.description || "A clean and modern theme for your Fromcode frontend."}
                      </p>
                      <div className={`flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                           <div className="flex items-center gap-1.5">
                             <FrameworkIcons.Shield size={12} className="text-indigo-500/70" />
                             v{t.version}
                           </div>
                           <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                           <div className="flex items-center gap-1.5">
                             <FrameworkIcons.User size={12} className="text-indigo-500/70" />
                             <span className="truncate">{t.author || 'Official Theme'}</span>
                           </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-auto space-y-4">
                      {installed && hasUpdate && (
                        <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100 shadow-sm'}`}>
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                            <span className={`text-[11px] font-bold uppercase tracking-wide leading-none ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>Update Available v{t.version}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {installed && !hasUpdate ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/themes/${t.slug}`); }}
                            className={`w-full py-5 rounded-[2rem] font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white border text-slate-400 hover:bg-slate-50 hover:text-indigo-600 shadow-sm'}`}
                          >
                            <FrameworkIcons.Check size={18} strokeWidth={3} />
                            Manage Theme
                          </button>
                        ) : hasUpdate ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleInstall(t.slug); }}
                            className={`w-full py-5 rounded-[2rem] font-bold uppercase tracking-widest text-[11px] bg-amber-600 text-white hover:bg-amber-700 shadow-xl shadow-amber-600/20 transition-all hover:-translate-y-1 transform active:scale-95 flex items-center justify-center gap-2`}
                          >
                            <FrameworkIcons.Clock size={18} strokeWidth={3} />
                            Upgrade Now
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleInstall(t.slug); }}
                            className={`w-full py-5 rounded-[2rem] font-bold uppercase tracking-widest text-[11px] bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-1 transform active:scale-95 flex items-center justify-center gap-2`}
                          >
                            <FrameworkIcons.Download size={18} strokeWidth={3} />
                            Install Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
