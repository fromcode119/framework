import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      <Card title={AdminI18n.t('settings.security.passwordPolicy')}>
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH}
          icon={FrameworkIcons.Lock}
          title={AdminI18n.t('settings.security.minimumPasswordLength')}
          description={AdminI18n.t('settings.security.shorterPasswordsAreRejectedWhen')}
          min={8}
          max={128}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE}
          icon={FrameworkIcons.Text}
          title={AdminI18n.t('settings.security.requireAnUppercaseLetter')}
          description={AdminI18n.t('settings.security.aNewPasswordMustContain')}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE}
          icon={FrameworkIcons.Text}
          title={AdminI18n.t('settings.security.requireALowercaseLetter')}
          description={AdminI18n.t('settings.security.aNewPasswordMustContain2')}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER}
          icon={FrameworkIcons.Activity}
          title={AdminI18n.t('settings.security.requireANumber')}
          description={AdminI18n.t('settings.security.aNewPasswordMustContain3')}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL}
          icon={FrameworkIcons.Key}
          title={AdminI18n.t('settings.security.requireASymbol')}
          description={AdminI18n.t('settings.security.aNewPasswordMustContain4')}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY}
          icon={FrameworkIcons.Layers}
          title={AdminI18n.t('settings.security.passwordHistoryReuseBlocked')}
          description={AdminI18n.t('settings.security.howManyOfAUser')}
          min={0}
          max={20}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK}
          icon={FrameworkIcons.ShieldAlert}
          title={AdminI18n.t('settings.security.checkAgainstKnownBreaches')}
          description={AdminI18n.t('settings.security.askABreachCheckProvider')}
        />
      </Card>
    );
  }
}
