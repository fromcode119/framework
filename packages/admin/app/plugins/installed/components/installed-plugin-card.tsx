"use client";

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';
import type { InstalledPluginCardProps } from '../installed-plugins-page.interfaces';

export default function InstalledPluginCard({ hasImageError, hasUpdate, isDark, onDelete, onImageError, onToggle, plugin }: InstalledPluginCardProps) {
  const hasRuntimeError = Boolean(plugin.error) || plugin.state === 'error';
  const statusLabel = hasRuntimeError ? 'Error' : plugin.state === 'active' ? 'Active' : 'Inactive';
  const statusVariant = hasRuntimeError ? 'danger' : plugin.state === 'active' ? 'success' : 'gray';

  return (
    <Card className={`group flex flex-col md:flex-row border-0 relative transition-all duration-700 overflow-hidden rounded-3xl ${isDark ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/10'}`}>
      <div className="p-6 flex flex-col md:flex-row flex-1 items-center gap-8 relative">
        <div className={`h-20 w-20 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-105 shadow-lg ${isDark ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
          {(plugin as any).iconUrl && !hasImageError ? <img src={(plugin as any).iconUrl} alt={plugin.manifest.name} className="w-10 h-10 object-contain" onError={() => onImageError(plugin.manifest.slug)} /> : <FrameworkIcons.Box size={36} strokeWidth={1.5} />}
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <Badge variant={statusVariant} className="flex-shrink-0">{statusLabel}</Badge>
            {plugin.healthStatus && plugin.healthStatus !== 'healthy' && <Badge variant={plugin.healthStatus === 'error' ? 'danger' : 'amber'} className="animate-pulse flex items-center gap-1.5"><FrameworkIcons.Zap size={10} />{plugin.healthStatus === 'error' ? 'Security Alert' : 'Heuristic Warning'}</Badge>}
            {hasUpdate && <Link href={AdminConstants.ROUTES.PLUGINS.MARKETPLACE_DETAIL(plugin.manifest.slug)} className="flex items-center gap-2 px-2 py-0.5 bg-amber-500 text-white rounded-lg animate-pulse no-underline shadow-md shadow-amber-500/20"><FrameworkIcons.Loader size={8} className="animate-spin" /><span className="text-[8px] font-semibold uppercase tracking-wider leading-none">Update</span></Link>}
          </div>
          <div className="space-y-1">
            <Link href={AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.manifest.slug)}><h3 className={`text-2xl font-semibold tracking-tighter transition-colors duration-300 group-hover:text-indigo-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>{plugin.manifest.name}</h3></Link>
            <p className={`text-[13px] leading-snug font-medium line-clamp-1 transition-colors duration-300 ${isDark ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>{plugin.manifest.description || `Manage and configure your ${plugin.manifest.name} tools.`}</p>
          </div>
          {plugin.error ? (
            <div className={`rounded-2xl border px-4 py-3 text-left ${isDark ? 'border-rose-500/20 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              <div className="flex items-start gap-3">
                <FrameworkIcons.Alert size={16} className="mt-0.5 flex-shrink-0 text-rose-500" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Startup Error</div>
                  <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed">{plugin.error}</p>
                </div>
              </div>
            </div>
          ) : null}
          <div className={`flex items-center justify-center md:justify-start gap-4 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500/80'}`}>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm transition-colors ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 text-slate-600'}`}>
              <FrameworkIcons.Shield size={10} className="text-indigo-500" />
              <span>v{plugin.manifest.version}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm transition-colors ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 text-slate-600'}`}>
              <FrameworkIcons.User size={10} className="text-indigo-500" />
              <span className="truncate">{typeof plugin.manifest.author === 'object' ? (plugin.manifest.author as { name?: string }).name : (plugin.manifest.author || 'Official')}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[220px]">
          <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${isDark ? 'bg-slate-800/40 border-white/10 hover:bg-slate-800/60' : 'bg-slate-100/50 border-slate-200/60 shadow-inner'}`}>
            <span className={`text-[8px] font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>Activation</span>
            <Switch checked={plugin.state === 'active'} onChange={(_: boolean) => onToggle(plugin.manifest.slug, plugin.state === 'active')} className="scale-75 origin-right" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Link href={AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.manifest.slug)} className={`col-span-4 sm:col-span-2 flex items-center justify-center gap-2 h-9 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all shadow-md active:scale-[0.97] ${isDark ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}><FrameworkIcons.Right size={14} /><span>Open</span></Link>
            <Link href={AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(plugin.manifest.slug)} className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm hover:shadow-md'}`}><FrameworkIcons.Settings size={14} /></Link>
            {plugin.healthStatus && plugin.healthStatus !== 'healthy' && <button onClick={() => onToggle(plugin.manifest.slug, true)} className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border group/kill ${isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm'}`} title="Emergency Deactivate"><FrameworkIcons.Zap size={14} className="group-hover/kill:animate-ping" /></button>}
            <button onClick={() => onDelete(plugin.manifest.slug)} className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-red-400' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 shadow-sm hover:shadow-md'}`}><FrameworkIcons.Trash size={14} /></button>
          </div>
        </div>
      </div>
    </Card>
  );
}
