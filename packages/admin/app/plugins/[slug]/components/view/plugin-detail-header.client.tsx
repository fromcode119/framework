import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';

export class PluginDetailHeader extends PureReactor {
  @prop declare activeTab: PluginDetailTab;
  @prop declare isSaving: boolean;
  @prop declare isUpdating: boolean;
  @prop declare marketplaceItem: IPluginMarketplaceItem | null;
  @prop declare onSaveSandbox: () => void;
  @prop declare onUpdate: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { activeTab, isSaving, isUpdating, marketplaceItem, onSaveSandbox, onUpdate, plugin, theme } = this;
    const hasUpdate = Boolean(marketplaceItem?.version && VersionComparisonService.isGreater(marketplaceItem.version, plugin.manifest.version));
    const marketplaceVersion = marketplaceItem?.version || null;

    return (
      <div className="flex items-center gap-4">
        <Link
          href={AdminConstants.ROUTES.PLUGINS.INSTALLED}
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm ${theme === ThemeMode.DARK ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 hover:shadow-indigo-500/10'}`}
        >
          <FrameworkIcons.Left size={18} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold tracking-tight truncate ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {plugin.manifest.name}
            </h1>
            {/* `String(...)`, not the member. `plugin.state` is a reactor `Enum` after hydration, and rendering
                a member as a React child throws "Objects are not valid as a React child" (#31) — which is
                what took the whole plugin detail page down, on every tab. `Enum.toString()` returns `.value`. */}
            <Badge variant={plugin.state === PluginState.ACTIVE ? 'success' : 'gray'}>{String(plugin.state)}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg ${theme === ThemeMode.DARK ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{plugin.manifest.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${hasUpdate ? 'text-amber-500' : 'text-slate-400'}`}>
              Installed {plugin.manifest.version}
            </span>
            {marketplaceVersion ? (
              <>
                <span className="text-slate-500 opacity-30">•</span>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${hasUpdate ? 'text-emerald-500' : 'text-slate-400'}`}>
                  Marketplace {marketplaceVersion}
                </span>
              </>
            ) : null}
            {hasUpdate && (
              <button
                onClick={onUpdate}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>
        {activeTab === PluginDetailTab.RESOURCES && (
          <Button onClick={onSaveSandbox} isLoading={isSaving} className="px-4 rounded-lg shadow-sm shadow-indigo-600/10">
            Update Policy
          </Button>
        )}
      </div>
    );
  }
}
