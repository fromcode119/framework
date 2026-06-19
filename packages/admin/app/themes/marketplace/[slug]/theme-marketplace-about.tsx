"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { ThemeMarketplaceChangelogProps } from './theme-marketplace-sections.interfaces';

export class ThemeMarketplaceAbout extends React.Component<ThemeMarketplaceChangelogProps> {
  render(): React.ReactNode {
    const { theme, adminTheme } = this.props;
    return (
      <>
        <div className="space-y-6">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
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
              <h3 className={`text-[11px] font-bold uppercase tracking-widest ${adminTheme === 'dark' ? 'text-slate-400' : 'text-slate-900/40'}`}>Technical Changelog</h3>
              <div className={`h-px flex-1 ${adminTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
            </div>

            <div className="space-y-8">
              {theme.changelog.map((log, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="blue" className="px-2 py-0.5 text-[9px] font-semibold rounded-md uppercase tracking-wide">v{log.version}</Badge>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Released {log.date}</span>
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
                            <p className={`text-[13px] font-semibold leading-relaxed ${adminTheme === 'dark' ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
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
      </>
    );
  }
}
