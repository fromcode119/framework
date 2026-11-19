import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginState } from '@fromcode119/core/client';
import type { IPluginEntry } from '@fromcode119/core/client';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Label } from '@/components/ui/view/label.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';

export class MarketplaceDetailSidebar extends PureReactor {
  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;
  @prop declare installedPlugin: any | null;
  @prop declare installedVersion: string | null;
  @prop declare hasUpdate: boolean;
  @prop declare installing: boolean;
  @prop declare installOperation: IPluginInstallOperation | null;
  @prop declare onInstall: () => void;

  /**
   * Whether the INSTALLED copy of this plugin is active, as a real enum comparison.
   *
   * `installedPlugin` is typed `any` and its `state` crosses the wire as a plain string
   * (`Enum.toJSON()` returns `.value`). The marketplace page hydrates the row, but `resolve()`
   * accepts either form, so a future un-hydrated caller can never make this silently `false` —
   * which is exactly how the Backups Restore/Delete actions became unreachable.
   */
  private get isInstalledActive(): boolean {
    return PluginState.resolve(this.installedPlugin?.state) === PluginState.ACTIVE;
  }

  render(): ReactNode {
    const { plugin, installedPlugin, installedVersion, hasUpdate, installing, installOperation, onInstall } = this;
    const state = !installedPlugin
      ? null
      : hasUpdate
        ? <StateBadge tone="warning">{AdminI18n.t('plugins.list.updateAvailable')}</StateBadge>
        : <StateBadge tone="success">{this.isInstalledActive ? AdminI18n.t('plugins.list.fullyActive') : AdminI18n.t('plugins.list.installed')}</StateBadge>;
    return (
      <RecordCard title={installedPlugin ? AdminI18n.t('plugins.list.installed') : AdminI18n.t('plugins.list.installExtension')} aside={state}>
        <div className="fc-stack">
          {!installedPlugin ? (
            <Button variant={ButtonVariant.PRIMARY} className="w-full" isLoading={installing} icon={<FrameworkIcons.Download size={15} />} onClick={onInstall}>
              {installing ? AdminI18n.t('plugins.list.installing2') : AdminI18n.t('plugins.list.installExtension')}
            </Button>
          ) : hasUpdate ? (
            <Button variant={ButtonVariant.PRIMARY} className="w-full" isLoading={installing} icon={<FrameworkIcons.Refresh size={15} />} onClick={onInstall}>
              {installing ? AdminI18n.t('plugins.list.updating2') : AdminI18n.t('plugins.list.applyUpdateNow')}
            </Button>
          ) : null}
          {/* The server's own words while it installs, as they arrive. */}
          {installOperation?.message ? <ProgressBar label={installOperation.message} /> : null}

          {(plugin.capabilities || []).length ? (
            <div>
              <Label>{AdminI18n.t('plugins.list.securityPermissions')}</Label>
              <div className="fc-chip-row">{(plugin.capabilities || []).map((cap) => <Badge key={String(cap)}>{String(cap)}</Badge>)}</div>
            </div>
          ) : null}

          <AdminFactGrid facts={[
            { key: 'namespace', label: AdminI18n.t('plugins.list.namespace'), value: plugin.slug },
            { key: 'current', label: AdminI18n.t('plugins.list.currentVer'), value: installedVersion ? `v${installedVersion}` : AdminI18n.t('plugins.list.notInstalled') },
            { key: 'marketplace', label: AdminI18n.t('plugins.list.marketplaceVer'), value: `v${plugin.version}` },
          ] as any} />
        </div>
      </RecordCard>
    );
  }
}
