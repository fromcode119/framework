import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';

export class GeneralSystemCards extends PureReactor {
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;
  @prop declare timezoneOptions: { label: string; value: string }[];
  @prop declare isSendingTelemetryTest: boolean;
  @prop declare onSendTelemetryTest: () => void;

  @bound
  protected changeTimezone(value: string): void {
    this.setSettings((prev) => ({ ...prev, timezone: value }));
  }

  @bound
  protected changeNotificationEmail(e: ChangeEvent<HTMLInputElement>): void {
    const notification_email = e.target.value;
    this.setSettings((prev) => ({ ...prev, notification_email }));
  }

  @bound
  protected changeNotificationEmailCc(e: ChangeEvent<HTMLInputElement>): void {
    const notification_email_cc = e.target.value;
    this.setSettings((prev) => ({ ...prev, notification_email_cc }));
  }

  @bound
  protected changeEmailNotifications(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, email_notifications: val }));
  }

  @bound
  protected changeFrontendAuthEnabled(val: boolean): void {
    this.setSettings((prev) => ({
      ...prev,
      frontend_auth_enabled: val,
      frontend_registration_enabled: val ? prev.frontend_registration_enabled : false
    }));
  }

  @bound
  protected changeFrontendRegistrationEnabled(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, frontend_registration_enabled: val }));
  }

  render(): ReactNode {
    const settings = this.settings;
    const theme = this.theme;
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
              onChange={this.changeTimezone}
              options={this.timezoneOptions}
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
              onChange={this.changeNotificationEmail}
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
              onChange={this.changeNotificationEmailCc}
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
                onChange={this.changeEmailNotifications}
              />
              <Button
                onClick={this.onSendTelemetryTest}
                isLoading={this.isSendingTelemetryTest}
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
              onChange={this.changeFrontendAuthEnabled}
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
              onChange={this.changeFrontendRegistrationEnabled}
              disabled={!settings.frontend_auth_enabled}
            />
          </SettingRow>
        </Card>
      </>
    );
  }
}
