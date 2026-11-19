import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What the theme needs installed beside it, one row each. Not drawn when it needs nothing. */
export class ThemeMarketplaceDependencyCard extends PureReactor {
  @prop declare theme: IMarketplaceTheme;

  render(): ReactNode {
    const entries = Object.entries(this.theme.dependencies || {});
    if (!entries.length) return null;
    return (
      <ListShell title={AdminI18n.t('themes.dependencyGuard')} count={entries.length} subtitle={AdminI18n.t('themes.dependenciesAreAutomaticallyResolvedAnd')}>
        <div>
          {entries.map(([slug, version]) => (
            <ListRow key={slug} icon={<FrameworkIcons.Puzzle size={16} />} title={<span className="fc-ext-row__plain">{slug}</span>} description={AdminI18n.t('themes.requiresVersion', { version })} />
          ))}
        </div>
      </ListShell>
    );
  }
}
