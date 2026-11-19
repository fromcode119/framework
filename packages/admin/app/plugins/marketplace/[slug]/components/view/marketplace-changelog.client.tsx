import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginEntry } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class MarketplaceChangelog extends PureReactor {
  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { plugin } = this;
    if (!plugin.changelog || plugin.changelog.length === 0) return null;

    return (
      <ListShell title={AdminI18n.t('plugins.list.technicalChangelog')} count={plugin.changelog.length}>
        <div>
          {plugin.changelog.map((log, idx) => <ListRow key={idx} icon={<FrameworkIcons.Check size={16} />} title={<span className="fc-ext-row__plain">{log}</span>} />)}
        </div>
      </ListShell>
    );
  }
}
