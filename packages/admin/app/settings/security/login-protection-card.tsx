import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';

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
      <Card title="Login Protection">
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD}
          icon={FrameworkIcons.Lock}
          title="Failed Logins Before Lockout"
          description="How many failed sign-ins for the same email and IP lock that combination out."
          min={1}
          max={50}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES}
          icon={FrameworkIcons.Clock}
          title="Failed Login Window (minutes)"
          description="Failures more than this far apart do not add up; the counter restarts instead of reaching the threshold."
          min={1}
          max={1440}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES}
          icon={FrameworkIcons.Clock}
          title="Lockout Duration (minutes)"
          description="How long a locked email and IP combination is refused, even with the correct password."
          min={1}
          max={43200}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED}
          icon={FrameworkIcons.Fingerprint}
          title="Require Captcha After Repeated Failures"
          description="Once the captcha threshold below is reached, the sign-in request must carry a captcha answer before the password is even checked."
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD}
          icon={FrameworkIcons.Fingerprint}
          title="Failed Logins Before Captcha"
          description="Only used while the captcha requirement above is on. Keep it below the lockout threshold or the account locks first."
          min={1}
          max={50}
        />
      </Card>
    );
  }
}
