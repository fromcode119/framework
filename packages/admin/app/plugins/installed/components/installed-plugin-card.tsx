"use client";

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import type { InstalledPluginCardProps } from '../installed-plugins-page.interfaces';

export default class InstalledPluginCard extends React.Component<InstalledPluginCardProps> {
  render(): React.ReactNode {
    const { hasImageError, hasUpdate, isDark, onDelete, onImageError, onToggle, plugin } = this.props;
    const hasRuntimeError = Boolean(plugin.error) || plugin.state === 'error';
    const statusLabel = hasRuntimeError ? 'Error' : plugin.state === 'active' ? 'Active' : 'Inactive';
    const statusVariant = hasRuntimeError ? 'danger' : plugin.state === 'active' ? 'success' : 'gray';
    const author = typeof plugin.manifest.author === 'object'
      ? (plugin.manifest.author as { name?: string }).name
      : (plugin.manifest.author || 'Official');

    return (
      <div className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'}`}>
          {(plugin as any).iconUrl && !hasImageError ? <img src={(plugin as any).iconUrl} alt={plugin.manifest.name} className="w-5 h-5 object-contain" onError={() => onImageError(plugin.manifest.slug)} /> : <FrameworkIcons.Box size={18} strokeWidth={1.5} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.manifest.slug)} className="no-underline">
              <span className={`text-sm font-semibold tracking-tight group-hover:text-indigo-500 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{plugin.manifest.name}</span>
            </Link>
            {hasUpdate && (
              <Link href={AdminConstants.ROUTES.PLUGINS.MARKETPLACE_DETAIL(plugin.manifest.slug)} className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500 text-white rounded no-underline text-[9px] font-bold uppercase tracking-wide leading-none">
                <FrameworkIcons.Loader size={8} className="animate-spin" />Update
              </Link>
            )}
            {plugin.healthStatus && plugin.healthStatus !== 'healthy' && (
              <Badge variant={plugin.healthStatus === 'error' ? 'danger' : 'amber'} className="shrink-0 flex items-center gap-1"><FrameworkIcons.Zap size={9} />{plugin.healthStatus === 'error' ? 'Security' : 'Warning'}</Badge>
            )}
          </div>
          <p className={`text-xs leading-snug truncate ${plugin.error ? 'text-rose-500 font-medium' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
            {plugin.error ? plugin.error : (plugin.manifest.description || `Manage and configure your ${plugin.manifest.name} tools.`)}
          </p>
        </div>

        <span className={`hidden lg:inline text-[11px] tabular-nums shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>v{plugin.manifest.version}</span>
        <span className={`hidden xl:inline text-[11px] truncate max-w-[120px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{author}</span>
        <Badge variant={statusVariant} className="shrink-0 w-[68px] justify-center">{statusLabel}</Badge>

        <Switch checked={plugin.state === 'active'} onChange={(_: boolean) => onToggle(plugin.manifest.slug, plugin.state === 'active')} className="scale-75 origin-right shrink-0" />

        <div className="flex items-center gap-1 shrink-0">
          <Link href={AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.manifest.slug)} title="Open" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><FrameworkIcons.Right size={15} /></Link>
          <Link href={AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(plugin.manifest.slug)} title="Settings" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><FrameworkIcons.Settings size={15} /></Link>
          <button onClick={() => onDelete(plugin.manifest.slug)} title="Remove" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}><FrameworkIcons.Trash size={15} /></button>
        </div>
      </div>
    );
  }
}
