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
    const pill = AdminClass.of('ext-pill');
    const roles = Array.isArray(this.user.roles) ? this.user.roles : [];
    const out: ReactNode[] = roles.map((role) => <span key={`r-${role}`} className={pill}>{this.roleNames[role] || role}</span>);
    if (UsersRow.isSuspended(this.user)) out.push(<span key="s" className={`${pill} ${AdminClass.of('ext-pill--danger')}`}>{AdminI18n.t('users.suspended')}</span>);
    if (this.user.forcePasswordReset) out.push(<span key="p" className={`${pill} ${AdminClass.of('ext-pill--warn')}`}>{AdminI18n.t('users.resetRequired')}</span>);
    return out;
  }

  render(): ReactNode {
    const { user } = this;
    const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '';
    return (
      <div className={AdminClass.of('ext-row')}>
        <div className={`${AdminClass.of('ext-row__icon')} ${AdminClass.of('ext-row__icon--person')}`} aria-hidden="true">{this.initials}</div>
        <div className={AdminClass.of('ext-row__text')}>
          <div className={AdminClass.of('ext-row__name')}>
            <AdminLink href={AdminConstants.ROUTES.USERS.DETAIL(user.id)}>{this.name}</AdminLink>
            {this.pills()}
          </div>
          <p className={AdminClass.of('ext-row__desc')} title={user.email}>{user.email}</p>
        </div>
        <div className={AdminClass.of('ext-row__meta')} title={joined ? `${AdminI18n.t('users.joined')} ${joined}` : undefined}>
          {joined ? `${AdminI18n.t('users.joined')} ${joined}` : ''}
        </div>
        <div className={AdminClass.of('ext-row__actions')}>{this.actions}</div>
      </div>
    );
  }
}
