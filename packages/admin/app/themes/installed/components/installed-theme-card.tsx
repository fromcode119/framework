"use client";

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import type { InstalledThemeCardProps } from '../installed-themes-page.interfaces';

export default class InstalledThemeCard extends React.Component<InstalledThemeCardProps> {
  render(): React.ReactNode {
    const { isDark, onActivate, onDelete, onDisable, onUpdate, theme, updateVersion } = this.props;
    const isActive = theme.state === 'active';

    return (
      <div className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} ${isActive ? (isDark ? 'bg-indigo-500/5' : 'bg-indigo-50/40') : ''}`}>
        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isActive ? 'bg-indigo-600 text-white' : (isDark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600')}`}>
          {theme.iconUrl ? <img src={theme.iconUrl} className="w-5 h-5 rounded" alt="" /> : <FrameworkIcons.Palette size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)} className={`text-sm font-semibold tracking-tight group-hover:text-indigo-500 transition-colors no-underline ${isDark ? 'text-white' : 'text-slate-900'}`}>{theme.name}</Link>
            {updateVersion ? <Badge variant="warning" className="shrink-0">Update</Badge> : null}
          </div>
          <p className={`text-xs leading-snug truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{theme.description || 'A clean and modern theme for your Fromcode frontend.'}</p>
        </div>

        <span className={`hidden lg:inline text-[11px] tabular-nums shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>v{theme.version}</span>
        {theme.author ? <span className={`hidden xl:inline text-[11px] truncate max-w-[120px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{theme.author}</span> : null}
        <Badge variant={isActive ? 'blue' : 'gray'} className="shrink-0 w-[64px] justify-center">{isActive ? 'Active' : 'Installed'}</Badge>

        <div className="flex items-center gap-1 shrink-0">
          {updateVersion ? (
            <button onClick={() => onUpdate(theme.slug)} title={`Upgrade to v${updateVersion}`} className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"><FrameworkIcons.Clock size={14} />Upgrade</button>
          ) : null}
          {isActive ? (
            <>
              <Link href={AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)} className="h-8 px-3 rounded-lg flex items-center text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors no-underline">Manage</Link>
              <Link href={AdminConstants.ROUTES.THEMES.SETTINGS_TAB(theme.slug)} title="Settings" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><FrameworkIcons.Settings size={15} /></Link>
              <button onClick={() => onDisable(theme.slug)} title="Disable" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-amber-400 hover:bg-amber-500/20' : 'text-amber-600 hover:bg-amber-50'}`}><FrameworkIcons.Close size={15} /></button>
            </>
          ) : (
            <button onClick={() => onActivate(theme.slug)} className="h-8 px-3 rounded-lg flex items-center text-[11px] font-semibold bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 transition-colors">Activate</button>
          )}
          <button onClick={() => onDelete(theme.slug, isActive)} title="Delete" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-700' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'}`}><FrameworkIcons.Trash size={15} /></button>
        </div>
      </div>
    );
  }
}
