import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ListRow } from '@/components/ui/view/list-row.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { PeopleListFilter } from '@/app/users/people/enums/people-list-filter.enum';

/**
 * One person on the people list, on one line like a user or a plugin: name and whether they can sign
 * in, email and phone under it, where they came from and when, then the actions.
 */
export class PeopleRow extends PureReactor {
  @prop declare person: IPerson;
  @prop declare name: string;
  /** Where the person came from (an order, a form, a contact) — the record's own `source`. */
  @prop declare source: string;
  @prop declare onEdit: () => void;
  @prop declare onGrantLogin: () => void;

  /** The account's roles as the console names them, or nothing when it carries none. */
  private get accountRoles(): string {
    const roles = (this.person as { accountRoles?: unknown })?.accountRoles;
    if (!Array.isArray(roles) || !roles.length) return '';
    // The console's word for a role it knows; a role a site invented keeps the name it was given.
    return roles.map((role) => AdminI18n.optional(`users.roleNames.${String(role)}`) || String(role)).join(', ');
  }

  render(): ReactNode {
    const { person } = this;
    const hasLogin = PeopleListFilter.hasLogin(person);
    const contact = [person.email, person.phone].filter(Boolean).join(' · ');
    const added = person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '';
    const meta = [this.source, added].filter(Boolean).join(' · ');
    return (
      <ListRow
        initials={(this.name[0] || '?').toUpperCase()}
        title={<button type="button" className={AdminClass.of('ext-row__link')} onClick={this.onEdit}>{this.name}</button>}
        // What this person may do, not merely that a row exists in another table: this list is the only
        // one a site has, so the account's roles have to read here.
        badges={hasLogin
          ? <Badge variant={BadgeVariant.SUCCESS}>{this.accountRoles || AdminI18n.t('users.hasAccount')}</Badge>
          : <Badge variant={BadgeVariant.DEFAULT}>{AdminI18n.t('users.noAccount')}</Badge>}
        description={contact || '—'}
        descriptionTitle={contact}
        meta={meta}
        actions={hasLogin ? undefined : (
          <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={14} />} onClick={this.onGrantLogin} disabled={!person.email}>
            {AdminI18n.t('users.createLoginAccount')}
          </Button>
        )}
      />
    );
  }
}
