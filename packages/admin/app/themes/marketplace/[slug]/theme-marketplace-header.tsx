"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import Link from 'next/link';
import { Dropdown } from '@/components/ui/dropdown';
import type { ThemeMarketplaceHeaderProps } from './theme-marketplace-sections.interfaces';

export class ThemeMarketplaceHeader extends React.Component<ThemeMarketplaceHeaderProps> {
  render(): React.ReactNode {
    const { theme, adminTheme, allVersions, selectedVersion, installedTheme, hasUpdate, installing, onSelectVersion, onInstall } = this.props;
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/themes"
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm ${adminTheme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 hover:shadow-md'}`}
        >
          <FrameworkIcons.Left size={18} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <Badge variant="blue" className="px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] rounded-lg mb-1">
            Marketplace Premium
          </Badge>
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold tracking-tight truncate ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {theme.name}
            </h1>
            {allVersions.length > 1 && (
              <div className="ml-2">
                <Dropdown
                  align="left"
                  trigger={
                    <div className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all cursor-pointer group ${adminTheme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-500/30 hover:bg-white hover:shadow-sm'}`}>
                      <span>v{selectedVersion} {selectedVersion === allVersions[0].version ? '(Latest)' : ''}</span>
                      <div className={`transition-colors ${adminTheme === 'dark' ? 'text-slate-600 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>
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
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onInstall}
            disabled={installing || (installedTheme && !hasUpdate)}
            className={`h-9 px-4 text-xs font-bold uppercase tracking-widest rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-2 ${
              installedTheme && !hasUpdate
                ? 'bg-emerald-50 text-emerald-600 shadow-none cursor-default opacity-80'
                : hasUpdate
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
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
    );
  }
}
