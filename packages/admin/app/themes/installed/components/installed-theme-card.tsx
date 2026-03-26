"use client";

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';
import type { InstalledThemeCardProps } from '../installed-themes-page.interfaces';

export default function InstalledThemeCard({ isDark, onActivate, onDelete, onUpdate, theme, updateVersion }: InstalledThemeCardProps) {
  const isActive = theme.state === 'active';

  return (
    <Card className={`group flex flex-col border-0 relative transition-all duration-500 overflow-hidden rounded-[2.5rem] ${isActive ? (isDark ? 'bg-indigo-500/5 ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/10' : 'bg-white ring-2 ring-indigo-500/10 shadow-2xl shadow-indigo-500/5') : (isDark ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/10')}`}>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform group-hover:rotate-6 ${isActive ? 'bg-indigo-600 text-white' : (isDark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600')}`}>
            {theme.iconUrl ? <img src={theme.iconUrl} className="w-8 h-8 rounded-lg" alt="" /> : <FrameworkIcons.Palette size={28} />}
          </div>
          <div className="flex items-center gap-2">
            {updateVersion ? <Badge variant="warning" className="animate-pulse">Update</Badge> : null}
            <Badge variant={isActive ? 'blue' : 'gray'} className="font-semibold uppercase tracking-wider text-[9px]">{isActive ? 'Active Core' : 'Installed'}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Link href={AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)} className={`group/title flex items-center gap-2 text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} hover:text-indigo-600 transition-colors`}>
              {theme.name}
              <FrameworkIcons.Right size={18} className="opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-indigo-500" />
            </Link>
            <span className="text-[10px] font-bold text-slate-400">v{theme.version}</span>
          </div>
          <p className={`text-sm leading-relaxed font-medium line-clamp-2 italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{theme.description || 'A clean and modern theme for your Fromcode frontend.'}</p>
          {theme.author ? <div className="flex items-center gap-2"><div className="h-1 w-4 bg-indigo-500 rounded-full" /><p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Architect: {theme.author}</p></div> : null}
        </div>

        <div className="pt-4 mt-auto">
          {updateVersion ? <button onClick={() => onUpdate(theme.slug)} className="w-full mb-3 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"><FrameworkIcons.Clock size={16} />Upgrade to v{updateVersion}</button> : null}
          {isActive ? (
            <div className="flex gap-3">
              <Link href={AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)} className="flex-1 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-indigo-600 text-white text-center shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-transform">Manage Layout</Link>
              <Link href={AdminConstants.ROUTES.THEMES.SETTINGS_TAB(theme.slug)} className={`p-4 rounded-2xl flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'} shadow-sm`}><FrameworkIcons.Settings size={18} /></Link>
              <button onClick={() => onDelete(theme.slug, true)} className={`p-4 rounded-2xl transition-all ${isDark ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white shadow-sm'}`} title="Delete theme"><FrameworkIcons.Trash size={18} /></button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => onActivate(theme.slug)} className="flex-1 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-slate-900 dark:bg-white dark:text-slate-900 text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-slate-900/20">Activate System</button>
              <button onClick={() => onDelete(theme.slug, false)} className={`p-4 rounded-2xl transition-all ${isDark ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white shadow-sm'}`}><FrameworkIcons.Trash size={18} /></button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
