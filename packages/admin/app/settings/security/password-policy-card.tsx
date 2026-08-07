import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';

/**
 * The password rules the API enforces on every registration, password change and password reset
 * (`AuthControllerPolicy.validatePasswordAgainstPolicy`). They were seeded, described and enforced
 * live long before this card existed — with no control and a 400 on the settings PUT, the operator
 * could neither see nor change the policy their users were being held to.
 */
export class PasswordPolicyCard extends PureReactor {
  declare props: Pick<PasswordPolicyCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title="Password Policy">
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH}
          icon={FrameworkIcons.Lock}
          title="Minimum Password Length"
          description="Shorter passwords are rejected when an account is created, changed or reset. Existing passwords are not revoked."
          min={8}
          max={128}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE}
          icon={FrameworkIcons.Text}
          title="Require an Uppercase Letter"
          description="A new password must contain at least one A-Z character."
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE}
          icon={FrameworkIcons.Text}
          title="Require a Lowercase Letter"
          description="A new password must contain at least one a-z character."
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER}
          icon={FrameworkIcons.Activity}
          title="Require a Number"
          description="A new password must contain at least one digit."
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL}
          icon={FrameworkIcons.Key}
          title="Require a Symbol"
          description="A new password must contain at least one character that is not a letter or a digit."
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY}
          icon={FrameworkIcons.Layers}
          title="Password History (reuse blocked)"
          description="How many of a user's previous passwords are refused when they choose a new one. Set to 0 to allow reuse."
          min={0}
          max={20}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK}
          icon={FrameworkIcons.ShieldAlert}
          title="Check Against Known Breaches"
          description='Ask a breach-check provider whether a chosen password appears in a public breach corpus. This calls the "auth:password:breach-check" hook. With no plugin answering it, nothing is rejected.'
        />
      </Card>
    );
  }
}
