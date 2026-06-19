import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from './setting-row';
import type { GeneralSystemCardsProps } from './general-system-cards.interfaces';

export class GeneralSystemCards extends React.Component<GeneralSystemCardsProps> {
  render(): React.ReactNode {
    const {
      settings,
      setSettings,
      theme,
      timezoneOptions,
      isSendingTelemetryTest,
      onSendTelemetryTest,
    } = this.props;
    return (
      <>
        <Card title="Regional Defaults">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Clock}
            title="System Timezone"
            description="The default timezone for content scheduling and logging."
          >
            <Select
              value={settings.timezone}
              onChange={(value) => setSettings((prev) => ({ ...prev, timezone: value }))}
              options={timezoneOptions}
              placeholder="Select system timezone"
              searchable
              theme={theme}
              className="w-full md:w-80"
              triggerClassName="font-bold rounded-xl"
            />
          </SettingRow>
        </Card>

        <Card title="Notifications">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Mail}
            title="Notification Email"
            description="Single system-wide destination for internal form and platform notifications."
          >
            <Input
              value={settings.notification_email}
              onChange={(e) => setSettings((prev) => ({ ...prev, notification_email: e.target.value }))}
              className="w-full md:w-80 font-bold"
              placeholder="hello@example.com"
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Users}
            title="Notification CC Emails"
            description="Optional global CC recipients. Separate multiple emails with commas."
          >
            <Input
              value={settings.notification_email_cc}
              onChange={(e) => setSettings((prev) => ({ ...prev, notification_email_cc: e.target.value }))}
              className="w-full md:w-80 font-bold"
              placeholder="ops@example.com, sales@example.com"
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Mail}
            title="Email Telemetry"
            description="Receive critical system alerts and weekly summaries via email. Telemetry uses the Notification Email and Notification CC Emails above."
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.email_notifications}
                onChange={(val) => setSettings(prev => ({ ...prev, email_notifications: val }))}
              />
              <Button
                onClick={onSendTelemetryTest}
                isLoading={isSendingTelemetryTest}
                icon={<FrameworkIcons.Mail size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                Send Test
              </Button>
            </div>
          </SettingRow>
        </Card>

        <Card title="Frontend Auth">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Lock}
            title="Frontend Authentication"
            description="Enable public customer authentication routes such as register, verify email, forgot password and reset password."
          >
            <Switch
              checked={settings.frontend_auth_enabled}
              onChange={(val) =>
                setSettings((prev) => ({
                  ...prev,
                  frontend_auth_enabled: val,
                  frontend_registration_enabled: val ? prev.frontend_registration_enabled : false
                }))
              }
            />
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Users}
            title="Frontend Registration"
            description="Allow new customer self-registration at /register."
          >
            <Switch
              checked={settings.frontend_registration_enabled}
              onChange={(val) => setSettings((prev) => ({ ...prev, frontend_registration_enabled: val }))}
              disabled={!settings.frontend_auth_enabled}
            />
          </SettingRow>
        </Card>
      </>
    );
  }
}
