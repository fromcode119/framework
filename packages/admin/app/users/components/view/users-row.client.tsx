import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ListRow } from '@/components/ui/view/list-row.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IUser } from '@/app/users/interfaces/user.interface';
import { AccountStatus } from '@/app/users/enums/account-status.enum';

/**
 * One person on the users list, on one line like a plugin or a theme: initials, name with the roles
 * and anything that needs attention, the email under it, the date they joined, and the row's menu.
 * Its look is the `fc-ext-row` rules of `settings.css`.
 */
export class UsersRow extends PureReactor {
  @prop declare user: IUser;
  /** role slug → the name the operator gave it under Roles. */
  @prop declare roleNames: Record<string, string>;
  /** The row's "⋯" menu. */
  @prop declare actions: ReactNode;

  static isSuspended(user: IUser): boolean {
    return AccountStatus.resolve(user.accountStatus) === AccountStatus.SUSPENDED;
  }

  private get name(): string {
    const { firstName, lastName, email } = this.user;
    const full = [firstName, lastName].filter(Boolean).join(' ').trim();
    return full || String(email || '').split('@')[0];
  }

  private get initials(): string {
    const { firstName, lastName, email } = this.user;
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    return String(email || '?')[0].toUpperCase();
  }

  private pills(): ReactNode[] {
    const roles = Array.isArray(this.user.roles) ? this.user.roles : [];
    const out: ReactNode[] = roles.map((role) => <Badge key={`r-${role}`} variant={BadgeVariant.DEFAULT}>{this.roleNames[role] || role}</Badge>);
    if (UsersRow.isSuspended(this.user)) out.push(<Badge key="s" variant={BadgeVariant.DANGER}>{AdminI18n.t('users.suspended')}</Badge>);
    if (this.user.forcePasswordReset) out.push(<Badge key="p" variant={BadgeVariant.WARNING}>{AdminI18n.t('users.resetRequired')}</Badge>);
    return out;
  }

  render(): ReactNode {
    const { user } = this;
    const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '';
    return (
      <ListRow
        initials={this.initials}
        title={<AdminLink href={AdminConstants.ROUTES.USERS.DETAIL(user.id)}>{this.name}</AdminLink>}
        badges={this.pills()}
        description={user.email}
        descriptionTitle={user.email}
        meta={joined ? `${AdminI18n.t('users.joined')} ${joined}` : undefined}
        actions={this.actions}
      />
    );
  }
}
