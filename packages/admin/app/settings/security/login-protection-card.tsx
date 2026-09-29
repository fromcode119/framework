import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The failed-login throttle the API applies per email + IP
 * (`AuthControllerPolicy.getLoginThrottleSettings` / `recordLoginFailure`). Accounts were already
 * locking after a threshold nobody could read or move.
 */
export class LoginProtectionCard extends PureReactor {
  declare props: Pick<LoginProtectionCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.loginProtection')}>
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD}
          icon={FrameworkIcons.Lock}
          title={AdminI18n.t('settings.security.failedLoginsBeforeLockout')}
          description={AdminI18n.t('settings.security.howManyFailedSignIns')}
          min={1}
          max={50}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.security.failedLoginWindowMinutes')}
          description={AdminI18n.t('settings.security.failuresMoreThanThisFar')}
          min={1}
          max={1440}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.security.lockoutDurationMinutes')}
          description={AdminI18n.t('settings.security.howLongALockedEmail')}
          min={1}
          max={43200}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED}
          icon={FrameworkIcons.Fingerprint}
          title={AdminI18n.t('settings.security.requireCaptchaAfterRepeatedFailures')}
          description={AdminI18n.t('settings.security.onceTheCaptchaThresholdBelow')}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD}
          icon={FrameworkIcons.Fingerprint}
          title={AdminI18n.t('settings.security.failedLoginsBeforeCaptcha')}
          description={AdminI18n.t('settings.security.onlyUsedWhileTheCaptcha')}
          min={1}
          max={50}
        />
      </Card>
    );
  }
}
