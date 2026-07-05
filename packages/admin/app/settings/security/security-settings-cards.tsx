import React from 'react';
import { Card } from '@/components/ui/card';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from './setting-row';
import type { SecuritySettingsCardsProps } from './security-settings-cards.interfaces';

export class SecuritySettingsCards extends React.Component<SecuritySettingsCardsProps> {
  render(): React.ReactNode {
    const { settings, setSettings, theme } = this.props;
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
              onChange={(v) => setSettings(prev => ({ ...prev, auth_session_duration_minutes: v === '' ? '' : String(v) }))}
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
              onChange={(val) => setSettings(prev => ({ ...prev, two_factor_enabled: val }))}
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
              onChange={(v) => setSettings(prev => ({ ...prev, rate_limit_max: v === '' ? '' : String(v) }))}
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
              onChange={(v) => setSettings(prev => ({ ...prev, rate_limit_window: v === '' ? '' : String(v) }))}
            />
          </SettingRow>
        </Card>
      </>
    );
  }
}
