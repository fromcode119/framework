import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The roles an account may hold, each a row with a tick: several of several, so each is a checkbox.
 * One list for creating an account and for changing the roles of an existing one — they were two
 * hand-drawn grids of tinted cards, each with its own idea of what "chosen" looks like.
 */
export class RoleChoices extends PureReactor {
  @prop declare roles: any[];
  @prop declare selected: string[];
  @prop declare onToggle: (slug: string) => void;
  @prop declare disabled?: boolean;

  render(): ReactNode {
    return (
      <div>
        {this.roles.map((role) => {
          const count = Array.isArray(role.permissions) ? role.permissions.length : 0;
          return (
            <ListRow
              key={role.slug}
              icon={<FrameworkIcons.Shield size={16} />}
              title={role.name || role.slug}
              description={role.description || AdminI18n.t('users.noDescription')}
              meta={AdminI18n.t('users.permissionsCount', { count })}
              actions={<Checkbox checked={this.selected.includes(role.slug)} disabled={this.disabled} onChange={() => this.onToggle(role.slug)} />}
            />
          );
        })}
      </div>
    );
  }
}
