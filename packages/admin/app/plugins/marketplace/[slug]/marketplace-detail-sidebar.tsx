"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceDetailSidebarProps } from './marketplace-detail-sections.interfaces';

export class MarketplaceDetailSidebar extends React.Component<MarketplaceDetailSidebarProps> {
  render(): React.ReactNode {
    const {
      plugin,
      theme,
      installedPlugin,
      installedVersion,
      hasUpdate,
      installing,
      installOperation,
      onInstall,
    } = this.props;
    return (
      <div className="w-full lg:w-96 space-y-6">
         <Card noPadding className={`sticky top-8 overflow-hidden rounded-xl ${theme === 'dark' ? 'bg-[#0f172a] ring-1 ring-white/5 border-0' : 'bg-white shadow-sm border-slate-100'}`}>
            <div className="p-4 space-y-6">
              <div className="space-y-4">
                {!installedPlugin ? (
                  <button
                    onClick={onInstall}
                    disabled={installing}
                    className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 group disabled:opacity-60 disabled:cursor-not-allowed ${
                      theme === 'dark'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                    }`}
                  >
                    <FrameworkIcons.Download size={20} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
                    <span className="uppercase tracking-widest text-xs">{installing ? 'Installing…' : 'Install Extension'}</span>
                  </button>
                ) : hasUpdate ? (
                  <div className={`p-1 rounded-xl ${theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <div className={`p-4 rounded-lg border border-dashed flex flex-col items-center text-center ${theme === 'dark' ? 'border-amber-500/30' : 'border-amber-200'}`}>
                      <div className="h-9 w-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/30 mb-3">
                         <FrameworkIcons.Refresh size={20} strokeWidth={3} />
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1">Update Available</div>
                      <div className={`text-base font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>v{plugin.version} is ready</div>

                      <button
                        onClick={onInstall}
                        disabled={installing}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-amber-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {installing ? 'Updating…' : 'Apply Update Now'}
                      </button>
                      {installOperation?.message && (
                        <p className={`mt-3 text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                          {installOperation.message}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed transition-all duration-500 ${
                    installedPlugin.state === 'active'
                      ? (theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-500/5')
                      : (theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600')
                  }`}>
                    <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-current/10' : 'bg-white shadow-sm ring-1 ring-slate-100'}`}>
                      {installedPlugin.state === 'active' ? (
                        <FrameworkIcons.CheckCircle2 size={24} strokeWidth={3.5} />
                      ) : (
                        <FrameworkIcons.Box size={24} strokeWidth={3.5} />
                      )}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest">{installedPlugin.state === 'active' ? 'Fully Active' : 'Installed'}</span>
                  </div>
                )}

                  <button className={`w-full py-3 rounded-xl font-semibold uppercase tracking-widest text-[10px] border transition-all ${
                  theme === 'dark'
                    ? 'border-white/5 text-slate-500 hover:bg-white/5 hover:text-white'
                    : 'border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
                }`}>
                   Share Extension
                  </button>
                  {installOperation?.message && (
                    <p className={`text-center text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {installOperation.message}
                    </p>
                  )}
               </div>

              <div className={`h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100/60'}`} />

              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h4 className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Security Permissions</h4>
                   <FrameworkIcons.Shield size={14} className="text-slate-400" />
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {(plugin.capabilities || []).map(cap => (
                      <Badge key={cap} variant="gray" className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-lg border-0 ${
                        theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {cap.split(':').pop()}
                      </Badge>
                    ))}
                 </div>
              </div>

              <div className={`p-4 rounded-xl space-y-3 ${theme === 'dark' ? 'bg-slate-950/40 border border-white/5' : 'bg-slate-50/50 border border-slate-100/50'}`}>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Namespace</span>
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      {plugin.slug}
                    </span>
                 </div>
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current Ver</span>
                     <span className={`text-[11px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                       {installedVersion ? `v${installedVersion}` : 'Not installed'}
                     </span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marketplace Ver</span>
                     <span className={`text-[11px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                       v{plugin.version}
                     </span>
                  </div>
               </div>
            </div>
         </Card>
      </div>
    );
  }
}
