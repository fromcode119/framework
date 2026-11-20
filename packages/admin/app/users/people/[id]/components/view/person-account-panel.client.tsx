import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Text } from '@/components/ui/view/text.client';
import { Label } from '@/components/ui/view/label.client';
import { Hint } from '@/components/ui/view/hint.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The linked login-account facet of a person: login status, effective roles, and a link out to the
 * full user record. Surfaces the `partner`/`admin` etc. roles so the person's platform-wide identity
 * is visible in one place, without coupling the framework to any specific plugin. */
export class PersonAccountPanel extends PureReactor {
  @prop declare person: IPerson;
  @prop declare theme: ThemeMode;
  @prop declare granting: boolean;
  @prop declare onGrantLogin: () => void;

  private roleVariant(role: string): any {
    if (role === 'admin') return 'purple';
    if (role === 'partner') return 'green';
    return 'blue';
  }

  render(): ReactNode {
    const { person, granting, onGrantLogin } = this;
    const account = person.account;

    if (!account) {
      return (
        <RecordCard title={AdminI18n.t('users.loginAccount')}>
          <div className="fc-stack">
            <Text muted>{AdminI18n.t('users.noLoginAccountIsLinked')}</Text>
            <Button variant={ButtonVariant.SECONDARY} isLoading={granting} disabled={!person.email} icon={<FrameworkIcons.Plus size={15} />} onClick={onGrantLogin}>
              {AdminI18n.t('users.createLoginAccount')}
            </Button>
            {!person.email ? <Hint>{AdminI18n.t('users.anEmailIsRequiredTo')}</Hint> : null}
          </div>
        </RecordCard>
      );
    }

    return (
      <RecordCard title={AdminI18n.t('users.loginAccount')} aside={<StateBadge tone="success">{AdminI18n.t('users.linkedUser', { id: account.id })}</StateBadge>}>
        <div className="fc-stack">
          <AdminFactGrid facts={[
            { key: 'email', label: AdminI18n.t('users.eMailAddress'), value: account.email },
            ...(account.username ? [{ key: 'username', label: AdminI18n.t('users.username'), value: `@${account.username}` }] : []),
          ]} />
          <div>
            <Label>{AdminI18n.t('users.roles')}</Label>
            <div className="fc-chip-row">
              {account.roles.length
                ? account.roles.map((r) => <Badge key={r} variant={this.roleVariant(r)}>{r}</Badge>)
                : <Text size="xsmall" muted as="span">{AdminI18n.t('users.noRoles')}</Text>}
            </div>
          </div>
          <Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={AdminConstants.ROUTES.USERS.DETAIL(account.id)}>{AdminI18n.t('users.openUserRecord')}</Button>
        </div>
      </RecordCard>
    );
  }
}
