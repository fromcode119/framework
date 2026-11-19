import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Plugins the security monitor recorded denials for in the last day, or a plain "nothing recorded". */
export class SecuritySuspiciousActivity extends PureReactor {
  declare props: Pick<SecuritySuspiciousActivity, 'plugins'>;

  @prop declare plugins: Array<{ slug: string; count: number }>;

  render(): ReactNode {
    if (!this.plugins.length) {
      return (
        <RecordCard title={AdminI18n.t('settings.security.suspiciousActivity')}>
          <EmptyState inline icon={<FrameworkIcons.Check size={16} />} title={AdminI18n.t('settings.security.noSuspiciousPatternsDetected')} />
        </RecordCard>
      );
    }
    return (
      <ListShell title={AdminI18n.t('settings.security.suspiciousActivity')} count={this.plugins.length}>
        <div>
          {this.plugins.map((plugin) => (
            <ListRow
              key={plugin.slug}
              icon={<FrameworkIcons.ShieldAlert size={16} />}
              title={plugin.slug}
              description={AdminI18n.t('settings.security.denialsRecorded', { count: plugin.count })}
              failed
              actions={<StateBadge tone="danger">{plugin.count}</StateBadge>}
            />
          ))}
        </div>
      </ListShell>
    );
  }
}
