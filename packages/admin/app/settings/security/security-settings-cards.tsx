import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';

export class SecuritySettingsCards extends PureReactor {
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: (update: SetStateAction<Record<string, any>>) => void;
  @prop declare theme: ThemeMode;

  @bound
  setSessionDuration(v: number | string): void {
    this.setSettings(prev => ({ ...prev, auth_session_duration_minutes: v === '' ? '' : String(v) }));
  }

  @bound
  setTwoFactorEnabled(val: boolean): void {
    this.setSettings(prev => ({ ...prev, two_factor_enabled: val }));
  }

  @bound
  setRateLimitMax(v: number | string): void {
    this.setSettings(prev => ({ ...prev, rate_limit_max: v === '' ? '' : String(v) }));
  }

  @bound
  setRateLimitWindow(v: number | string): void {
    this.setSettings(prev => ({ ...prev, rate_limit_window: v === '' ? '' : String(v) }));
  }

  render(): ReactNode {
    const settings = this.settings;
    const theme = this.theme;
    return (
      <>
        <Card title="Account Defense">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Clock}
            title="Login Session Duration (minutes)"
            description="How long a user stays logged in before re-authentication is required."
          >
            <NumberStepper
              min={15}
              max={43200}
              value={settings.auth_session_duration_minutes}
              onChange={this.setSessionDuration}
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.ShieldCheck}
            title="Two-Factor Security"
            description="Add an extra layer of security to administrative accounts."
          >
            <Switch
              checked={settings.two_factor_enabled}
              onChange={this.setTwoFactorEnabled}
            />
          </SettingRow>
        </Card>

        <Card title="API Firewall">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.ShieldAlert}
            title="Rate Limit (Max Requests)"
            description="The maximum number of requests a single IP can make."
          >
            <NumberStepper
              min={0}
              value={settings.rate_limit_max}
              onChange={this.setRateLimitMax}
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Clock}
            title="Rate Limit Window"
            description="Per IP, the request counter resets after this window elapses. Example: 900000 = 15 minutes."
          >
            <NumberStepper
              min={0}
              value={settings.rate_limit_window}
              onChange={this.setRateLimitWindow}
            />
          </SettingRow>
        </Card>
      </>
    );
  }
}
