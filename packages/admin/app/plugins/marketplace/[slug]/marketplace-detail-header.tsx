"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/dropdown';
import type { MarketplaceDetailHeaderProps } from './marketplace-detail-sections.interfaces';

export class MarketplaceDetailHeader extends React.Component<MarketplaceDetailHeaderProps> {
  render(): React.ReactNode {
    const {
      plugin,
      theme,
      allVersions,
      selectedVersion,
      installedPlugin,
      onSelectVersion,
    } = this.props;
    return (
      <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-start gap-4">
           <div className={`h-16 w-16 rounded-xl flex items-center justify-center p-3 overflow-hidden relative shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
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
                   <FrameworkIcons.Box size={32} />
                 </div>
               </>
             ) : (
               <FrameworkIcons.Box size={32} />
             )}
           </div>
           <div className="flex-1">
              <div className="flex justify-between items-start">
                 <div className="flex items-center gap-3">
                    <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{plugin.name}</h2>
                    {allVersions.length > 1 && (
                      <div className="ml-4">
                        <Dropdown
                          align="left"
                          trigger={
                            <div className={`flex items-center gap-3 pl-4 pr-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all cursor-pointer group ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-500/30 hover:bg-white hover:shadow-sm'}`}>
                              <span>v{selectedVersion} {selectedVersion === allVersions[0].version ? '(Latest)' : ''}</span>
                              <div className={`transition-colors ${theme === 'dark' ? 'text-slate-600 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                                <FrameworkIcons.Down size={14} strokeWidth={3} />
                              </div>
                            </div>
                          }
                          items={allVersions.map(v => ({
                            label: `v${v.version} ${v.version === allVersions[0].version ? '(Latest)' : ''}`,
                            onClick: () => onSelectVersion(v.version),
                            icon: <FrameworkIcons.Clock size={14} />
                          }))}
                        />
                      </div>
                    )}
                 </div>
                 <Badge variant={installedPlugin ? "success" : "blue"} className="px-4 py-1 text-xs font-semibold uppercase tracking-wide">{plugin.category || 'General'}</Badge>
              </div>
              <p className={`mt-2 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {plugin.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 mt-4">
                 <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                       <FrameworkIcons.User size={16} />
                    </div>
                    <div>
                       <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Developer</div>
                       <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{plugin.author || 'Anonymous'}</div>
                    </div>
                 </div>
                 {plugin.homepage && (
                   <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                         <FrameworkIcons.Globe size={16} />
                      </div>
                      <div>
                         <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Official Site</div>
                         <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-500 hover:underline">Visit Homepage</a>
                      </div>
                   </div>
                 )}
                 <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                       <FrameworkIcons.Code size={16} />
                    </div>
                    <div>
                       <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Version</div>
                       <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>v{plugin.version}</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }
}
