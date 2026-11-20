import { ListRow } from '@/components/ui/view/list-row.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ThemeMode } from '@fromcode119/core/client';
import { RoleScope } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RoleType } from '@/app/users/roles/enums/role-type.enum';

/**
 * The roles, one line each like the users and plugins lists: name with where it is defined, what it
 * is for, how many people hold it and how many permissions it grants, and its menu. A role this
 * editor may not change shows a lock instead of a menu, rather than an edit the API refuses.
 */
export class RolesListCard extends PureReactor {
  @prop declare roles: any[];
  /** Accepted for backward-compat and ignored — the look comes from `settings.css`. */
  @prop declare theme?: ThemeMode;
  @prop declare onRequestDelete: (role: any) => void;
  @prop declare onNavigate: (href: string) => void;

  private row(role: any): ReactNode {
    const isSystem = RoleType.resolve(role.type) === RoleType.SYSTEM;
    const locked = isSystem || role.editable === false;
    const scope = role.scope ? RoleScope.fromValue(String(role.scope)) : undefined;
    const users = Number(role.users) || 0;
    const meta = `${users} ${users === 1 ? AdminI18n.t('users.userWord') : AdminI18n.t('users.usersWord')} · ${AdminI18n.t('users.permsCount', { count: role.permissions?.length || 0 })}`;
    return (
      <ListRow
        key={role.slug}
        icon={<FrameworkIcons.Shield size={16} />}
        title={locked ? <span>{role.name}</span> : <AdminLink href={AdminConstants.ROUTES.USERS.ROLE_EDIT(role.slug)}>{role.name}</AdminLink>}
        badges={scope ? <Badge variant={scope === RoleScope.SITE ? BadgeVariant.SUCCESS : BadgeVariant.DEFAULT}>{scope === RoleScope.SITE ? AdminI18n.t('users.roleScopeSite') : AdminI18n.t('users.roleScopePlatform')}</Badge> : undefined}
        description={role.description || AdminI18n.t('users.noDescription')}
        descriptionTitle={role.description || undefined}
        meta={meta}
        actions={locked ? (
          <span className={AdminClass.of('ext-row__more')} title={isSystem ? AdminI18n.t('users.locked') : AdminI18n.t('users.platformRoleLockedHint')} aria-label={AdminI18n.t('users.locked')}>
            <FrameworkIcons.Lock size={14} />
          </span>
        ) : undefined}
        menu={locked ? undefined : [
          { label: AdminI18n.t('users.edit'), icon: <FrameworkIcons.Edit size={14} />, onClick: () => this.onNavigate(AdminConstants.ROUTES.USERS.ROLE_EDIT(role.slug)) },
          { label: AdminI18n.t('users.deleteRole'), icon: <FrameworkIcons.Trash size={14} />, variant: DropdownItemVariant.DANGER, onClick: () => this.onRequestDelete(role) },
        ]}
      />
    );
  }

  render(): ReactNode {
    return <ListCard>{this.roles.map((role) => this.row(role))}</ListCard>;
  }
}
