import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginHealthEntry } from '@/app/plugins/health/interfaces/plugin-health-entry.interface';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Plugins serving a different build than the one installed on disk, each with the action that fixes it.
 *
 * The health report has always counted them, and the dashboard said "restart to apply" — but this
 * screen listed none of them, and the restart was on another page. An isolated plugin does not need
 * the api restarted at all: its process is replaced on the installed code, the way a marketplace
 * update replaces it.
 */
export class PluginRestartPendingList extends PureReactor {
  declare props: Pick<PluginRestartPendingList, 'entries' | 'isBusy' | 'busySlug' | 'onLoadInstalled' | 'theme'>;

  @prop declare entries: IPluginHealthEntry[];
  @prop declare isBusy: boolean;
  @prop declare busySlug: string | null;
  @prop declare onLoadInstalled: (slug: string) => Promise<void>;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <>
        {this.entries.map((entry) => (
          <ListRow key={entry.slug} icon={<FrameworkIcons.Refresh size={16} />} title={entry.slug}
            badges={<Badge variant={BadgeVariant.INFO}>{AdminI18n.t('plugins.list.notTheInstalledVersion')}</Badge>}
            description={AdminI18n.t('plugins.list.runningVsInstalled', { running: entry.runningVersion || AdminI18n.t('common.unknown'), installed: entry.installedVersion || AdminI18n.t('common.unknown') })}
            actions={(
              <Button variant={ButtonVariant.SECONDARY} disabled={this.isBusy} isLoading={this.isBusy && this.busySlug === entry.slug} icon={<FrameworkIcons.Refresh size={15} />} onClick={() => this.onLoadInstalled(entry.slug)}>
                {AdminI18n.t('plugins.list.loadVersion', { version: entry.installedVersion || AdminI18n.t('plugins.list.installedVersion') })}
              </Button>
            )} />
        ))}
      </>
    );
  }
}
