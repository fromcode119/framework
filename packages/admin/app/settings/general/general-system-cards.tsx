import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';

export class GeneralSystemCards extends PureReactor {
  /** Which of these belong to the PLATFORM — asked of the server, never listed here. */
  @prop declare platformLocks: PlatformSettingLocks;
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
  /**
   * The field's own description, plus its SCOPE when that is not obvious.
   *
   * Same two sentences as the brand card, for the same reason: "locked" answers why the control
   * refuses, "platform-wide" answers what saving it will reach. Neither shows on a single-tenant
   * deployment, where there is no second scope to contrast with.
   */
  private describe(key: string, description: string): ReactNode {
    const note = this.platformLocks.locks(key)
      ? 'Platform setting — the same for every site, and only a platform admin can change it.'
      : this.platformLocks.isPlatform(key)
        ? 'Platform-wide — applies to every site, not just this one.'
        : '';
    if (!note) return description;
    return (
      <>
        {description}
        <span className="mt-1 block text-[12px] font-semibold text-slate-400">{note}</span>
      </>
    );
  }

  protected changeAdminSearchIndexing(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, admin_search_indexing: val }));
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

        <Card title="Search Engines">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Lock}
            title="Index Platform Hosts"
            description={this.describe(
              'admin_search_indexing',
              "Let search engines crawl and index the platform's own hosts — the admin and the API host. Off by default: the login page names the platform and the customer, and the URLs describe the installation. Sites you host are not affected; each one follows its own visibility. Turn it on only if these hosts deliberately serve something public.",
            )}
          >
            <Switch
              checked={settings.admin_search_indexing}
              onChange={this.changeAdminSearchIndexing}
            />
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
