import { RecordCard } from '@/components/ui/view/record-card.client';
import { Text } from '@/components/ui/view/text.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
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

  render(): ReactNode {
    const { plugin, theme } = this;
    const update = this.update;
    return (
      <DetailSplit theme={theme}
        main={<>
          {update ? <PluginOverviewUpdate item={update} canUpdate={this.platformActions} isUpdating={this.isUpdating} onUpdate={this.onUpdate} theme={theme} /> : null}
          <RecordCard><Text size="base">{plugin.manifest.description || AdminI18n.t('plugins.detail.noDescriptionProvidedForThis')}</Text></RecordCard>
          {this.platformActions ? <PluginOverviewActivity loading={this.loadingLogs} logs={this.logs} onRefresh={this.onRefreshLogs} theme={theme} /> : null}
          {this.platformActions ? (
            <RecordCard title={AdminI18n.t('plugins.detail.uninstallPlugin')} aside={<div className="fc-record-card__table-tools"><Button variant={ButtonVariant.DANGER} onClick={this.onOpenDeleteConfirm}>{AdminI18n.t('plugins.detail.uninstallPlugin')}</Button></div>}>
              <Text muted>{AdminI18n.t('plugins.detail.uninstallHint')}</Text>
            </RecordCard>
          ) : null}
        </>}
        aside={<>
          <PluginOverviewStatus onToggle={this.onToggle} plugin={plugin} siteScope={this.siteScope} theme={theme} />
          <PluginOverviewDetails plugin={plugin} marketplaceVersion={this.marketplaceItem?.version ?? null} onOpenSecurity={this.siteScope ? null : this.onOpenSecurity} theme={theme} />
        </>} />
    );
  }
}
