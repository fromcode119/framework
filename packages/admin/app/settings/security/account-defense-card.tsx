import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';

export class AccountDefenseCard extends PureReactor {
  declare props: Pick<AccountDefenseCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title="Account Defense">
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_SESSION_DURATION}
          icon={FrameworkIcons.Clock}
          title="Login Session Duration (minutes)"
          description="How long a user stays logged in before re-authentication is required. Applies to the next sign-in; sessions already issued keep the lifetime they were given."
          min={15}
          max={43200}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.TWO_FACTOR_ENABLED}
          icon={FrameworkIcons.ShieldCheck}
          title="Two-Factor Security"
          description="Add an extra layer of security to administrative accounts. Turning this off blocks new enrolment; users who already enrolled keep their second factor."
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS}
          icon={FrameworkIcons.Mail}
          title="Security Notification Emails"
          description="Email the account owner when a password changes, a two-factor method is added or removed, or a sign-in looks unusual. Off means those emails are not sent at all."
        />
      </Card>
    );
  }
}
