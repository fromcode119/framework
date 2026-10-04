import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { VersionComparisonService } from '@fromcode119/core/client';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import { PluginOverviewUpdate } from '@/app/plugins/[slug]/components/view/overview/plugin-overview-update.client';
import { PluginOverviewStatus } from '@/app/plugins/[slug]/components/view/overview/plugin-overview-status.client';
import { PluginOverviewDetails } from '@/app/plugins/[slug]/components/view/overview/plugin-overview-details.client';
import { PluginOverviewActivity } from '@/app/plugins/[slug]/components/view/overview/plugin-overview-activity.client';
import { DetailSplit } from '@/components/view/detail-split.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The Overview tab — everything about the plugin that is not a setting: a newer release, whether it
 * runs, what it is, what it did lately, and removing it. Platform-only parts appear only in Platform scope.
 */
export class PluginDetailOverview extends PureReactor {
  @prop declare isUpdating: boolean;
  @prop declare loadingLogs: boolean;
  @prop declare logs: IPluginLogEntry[];
  @prop declare marketplaceItem: IPluginMarketplaceItem | null;
  @prop declare onOpenDeleteConfirm: () => void;
  @prop declare onOpenSecurity: () => void;
  @prop declare onRefreshLogs: () => void;
  @prop declare onToggle: () => void;
  @prop declare onUpdate: () => void;
  /** May this account act on the platform here (switch, update, uninstall)? */
  @prop declare platformActions: boolean;
  @prop declare siteScope: boolean;
  @prop declare plugin: ILoadedPlugin;
  @prop declare theme: ThemeMode;

  private get update(): IPluginMarketplaceItem | null {
    const item = this.marketplaceItem;
    return item?.version && VersionComparisonService.isGreater(item.version, this.plugin.manifest.version) ? item : null;
  }

  private uninstall(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('plugins.detail.uninstallPlugin')}</div>
          <div className={`mt-0.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{AdminI18n.t('plugins.detail.uninstallHint')}</div>
        </div>
        <button type="button" onClick={this.onOpenDeleteConfirm}
          className={`inline-flex h-8 items-center rounded-lg border px-3.5 text-[13px] font-medium ${dark ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10' : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`}>
          {AdminI18n.t('plugins.detail.uninstallPlugin')}
        </button>
      </div>
    );
  }

  render(): ReactNode {
    const { plugin, theme } = this;
    const dark = theme === ThemeMode.DARK;
    const update = this.update;
    return (
      <DetailSplit theme={theme}
        main={<>
          {update ? <PluginOverviewUpdate item={update} canUpdate={this.platformActions} isUpdating={this.isUpdating} onUpdate={this.onUpdate} theme={theme} /> : null}
          <p className={`text-[15px] leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            {plugin.manifest.description || AdminI18n.t('plugins.detail.noDescriptionProvidedForThis')}
          </p>
          {this.platformActions ? <PluginOverviewActivity loading={this.loadingLogs} logs={this.logs} onRefresh={this.onRefreshLogs} theme={theme} /> : null}
          {this.platformActions ? <div className={`border-t pt-6 ${dark ? 'border-slate-800' : 'border-slate-100'}`}>{this.uninstall()}</div> : null}
        </>}
        aside={<>
          <PluginOverviewStatus onToggle={this.onToggle} plugin={plugin} siteScope={this.siteScope} theme={theme} />
          <PluginOverviewDetails plugin={plugin} marketplaceVersion={this.marketplaceItem?.version ?? null} onOpenSecurity={this.siteScope ? null : this.onOpenSecurity} theme={theme} />
        </>} />
    );
  }
}
