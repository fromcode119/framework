import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What changed, release by release: one row per change, its release and date beside it. */
export class ThemeMarketplaceAbout extends PureReactor {
  @prop declare theme: IMarketplaceTheme;

  render(): ReactNode {
    const releases = this.theme.changelog || [];
    if (!releases.length) return null;
    const count = releases.reduce((sum, release) => sum + release.changes.length, 0);
    return (
      <ListShell title={AdminI18n.t('themes.technicalChangelog')} count={count}>
        <div>
          {releases.map((release) => release.changes.map((change, index) => (
            <ListRow
              key={`${release.version}-${index}`}
              icon={<FrameworkIcons.Check size={16} />}
              title={<span className="fc-ext-row__plain">{change}</span>}
              description={`v${release.version} · ${AdminI18n.t('themes.releasedOn', { date: release.date })}`}
            />
          )))}
        </div>
      </ListShell>
    );
  }
}
