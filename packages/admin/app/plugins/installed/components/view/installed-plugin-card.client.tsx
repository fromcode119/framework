import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Badge } from '@/components/ui/view/badge.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginHeldReason, PluginRegistryHealth, PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminConstants } from '@/lib/constants/admin.constants';

export class InstalledPluginCard extends PureReactor {
  @prop declare hasImageError: boolean;
  @prop declare hasUpdate: boolean;
  @prop declare isDark: boolean;
  @prop declare onDelete: (slug: string) => void;
  @prop declare onImageError: (slug: string) => void;
  @prop declare onToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  @prop declare plugin: ILoadedPlugin;

  render(): ReactNode {
    const { hasImageError, hasUpdate, isDark, onDelete, onImageError, onToggle, plugin } = this;
    const hasRuntimeError = Boolean(plugin.error) || plugin.state === PluginState.ERROR;
    const isHeld = plugin.healthStatus === PluginRegistryHealth.WARNING || Boolean(plugin.heldReason);
    const heldLabel = plugin.heldReason === PluginHeldReason.CAPABILITY_DRIFT ? 'Needs re-approval' : 'Held';
    const added = (plugin.manifest.capabilities || []).filter((c) => !(plugin.approvedCapabilities || []).includes(c));
    const removed = (plugin.approvedCapabilities || []).filter((c) => !(plugin.manifest.capabilities || []).includes(c));
    const driftSummary = [...added.map((c) => `+${c}`), ...removed.map((c) => `-${c}`)].join(' ');
    const statusLabel = hasRuntimeError ? 'Error' : isHeld ? heldLabel : plugin.state === PluginState.ACTIVE ? 'Active' : 'Inactive';
    const statusVariant = hasRuntimeError ? 'danger' : isHeld ? 'amber' : plugin.state === PluginState.ACTIVE ? 'success' : 'gray';
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
            {plugin.healthStatus === PluginRegistryHealth.ERROR && (
              <Badge variant={BadgeVariant.DANGER} className="shrink-0 flex items-center gap-1"><FrameworkIcons.Zap size={9} />Security</Badge>
            )}
            {isHeld && plugin.healthStatus !== PluginRegistryHealth.ERROR && (
              <Badge variant={BadgeVariant.AMBER} className="shrink-0 flex items-center gap-1"><FrameworkIcons.Zap size={9} />{heldLabel}</Badge>
            )}
            {isHeld && driftSummary && (
              <span title={`Capability change since approval: ${driftSummary}`} className="shrink-0 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">{driftSummary}</span>
            )}
          </div>
          <p className={`text-xs leading-snug truncate ${plugin.error ? 'text-rose-500 font-medium' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
            {plugin.error ? plugin.error : (plugin.manifest.description || `Manage and configure your ${plugin.manifest.name} tools.`)}
          </p>
        </div>

        {/* Three groups, not one flat run: metadata · state · actions. The gap BETWEEN groups is what
            separates them; inside a group the spacing is tight so each reads as a single unit. */}
        <div className="flex items-center gap-5 shrink-0">
          <div className={`hidden lg:flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="tabular-nums">v{plugin.manifest.version}</span>
            <span className="hidden xl:inline truncate max-w-[120px]">{author}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge variant={statusVariant} className={`shrink-0 justify-center ${isHeld ? 'min-w-[68px] px-2' : 'w-[68px]'}`}>{statusLabel}</Badge>
            <Switch checked={plugin.state === PluginState.ACTIVE} onChange={(_: boolean) => onToggle(plugin.manifest.slug, plugin.state === PluginState.ACTIVE)} className="scale-75 origin-right shrink-0" />
          </div>

          <div className={`flex items-center gap-0.5 pl-3 border-l ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <Link href={AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.manifest.slug)} title="Open" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><FrameworkIcons.Right size={15} /></Link>
          <Link href={AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(plugin.manifest.slug)} title="Settings" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><FrameworkIcons.Settings size={15} /></Link>
          <button onClick={() => onDelete(plugin.manifest.slug)} title="Remove" className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}><FrameworkIcons.Trash size={15} /></button>
          </div>
        </div>
      </div>
    );
  }
}
