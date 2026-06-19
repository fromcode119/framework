"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import type { ThemeMarketplaceChangelogProps } from './theme-marketplace-sections.interfaces';

export class ThemeMarketplaceDependencyCard extends React.Component<ThemeMarketplaceChangelogProps> {
  render(): React.ReactNode {
    const { theme, adminTheme } = this.props;
    if (!theme.dependencies || Object.keys(theme.dependencies).length === 0) return null;

    return (
      <Card className={`border-0 p-8 ${adminTheme === 'dark' ? 'bg-indigo-500/5' : 'bg-indigo-50/50'}`}>
        <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2 ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
          <FrameworkIcons.Puzzle size={16} />
          Dependency Guard
        </h3>
        <div className="space-y-4">
          {Object.entries(theme.dependencies).map(([slug, version]) => (
            <div key={slug} className={`flex items-center justify-between p-4 rounded-2xl border ${adminTheme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-col">
                <span className={`text-xs font-bold tracking-tight ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{slug}</span>
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
    );
  }
}
