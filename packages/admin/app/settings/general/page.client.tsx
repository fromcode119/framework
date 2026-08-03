import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode, SetStateAction } from 'react';
import { state, bound } from '@fromcode119/reactor';
import { Slot, ContextBridge } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { TimezoneUtils } from '@/lib/timezone';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { GeneralBrandCard } from '@/app/settings/general/general-brand-card';
import { GeneralSystemCards } from '@/app/settings/general/general-system-cards';

export class GeneralSettingsPage extends AdminComponent {
  @state isSaving = false;
  @state isSendingTelemetryTest = false;
  @state isLoading = true;
  @state settings: Record<string, any> = {
    platform_name: '',
    email_notifications: true,
    notification_email: '',
    notification_email_cc: '',
    frontend_url: '',
    admin_url: '',
    site_url: '',
    marketplace_url: '',
    domain_aliases: [] as string[],
    timezone: 'UTC',
    frontend_auth_enabled: true,
    frontend_registration_enabled: true
  };

  async componentDidMount(): Promise<void> {
    try {
      const newSettings = { ...this.settings };
      const response = await AdminSystemSettingsClient.getAll();
      Object.entries(response || {}).forEach(([key, value]) => {
        if (key === 'domain_aliases') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            newSettings['domain_aliases'] = Array.isArray(parsed) ? parsed : [];
          } catch {
            newSettings['domain_aliases'] = [];
          }
        } else if (this.settings.hasOwnProperty(key)) {
          newSettings[key] = ['email_notifications', 'frontend_auth_enabled', 'frontend_registration_enabled'].includes(key)
            ? value === true || value === 'true'
            : value;
        }
      });
      this.settings = newSettings;
    } finally {
      this.isLoading = false;
    }
  }

  private get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  private get timezoneOptions(): { label: string; value: string }[] {
    return TimezoneUtils.getTimezoneOptions(String(this.settings.timezone ?? '').trim());
  }

  @bound
  setSettings(update: SetStateAction<Record<string, any>>): void {
    this.settings = typeof update === 'function'
      ? (update as (prev: Record<string, any>) => Record<string, any>)(this.settings)
      : update;
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSaving = true;
    try {
      const settings = this.settings;
      await AdminSystemSettingsClient.update({
        platform_name: String(settings.platform_name ?? '').trim(),
        email_notifications: Boolean(settings.email_notifications),
        notification_email: String(settings.notification_email ?? '').trim(),
        notification_email_cc: String(settings.notification_email_cc ?? '').trim(),
        frontend_url: String(settings.frontend_url ?? '').trim(),
        admin_url: String(settings.admin_url ?? '').trim(),
        site_url: String(settings.site_url ?? '').trim(),
        marketplace_url: String(settings.marketplace_url ?? '').trim(),
        domain_aliases: JSON.stringify(Array.isArray(settings.domain_aliases) ? settings.domain_aliases : []),
        timezone: String(settings.timezone ?? '').trim(),
        frontend_auth_enabled: Boolean(settings.frontend_auth_enabled),
        frontend_registration_enabled: Boolean(settings.frontend_registration_enabled),
      });

      // Update global context
      this.registerSettings(settings);

      addNotification({
        title: 'Settings Saved',
        message: 'Global configuration updated successfully.',
        type: NotificationType.SUCCESS
      });
    } catch (err: any) {
      addNotification({
        title: 'Save Failed',
        message: 'Could not sync settings with infrastructure.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }

  @bound
  async handleSendTelemetryTest(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSendingTelemetryTest = true;
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EMAIL_TELEMETRY_TEST, {});
      const recipientsCount = Number(result?.recipientsCount || 0);
      addNotification({
        title: 'Telemetry Test Sent',
        message: recipientsCount > 0
          ? `Test email dispatched to ${recipientsCount} recipient${recipientsCount === 1 ? '' : 's'}.`
          : 'Test email dispatched.',
        type: NotificationType.SUCCESS
      });
    } catch (err: any) {
      addNotification({
        title: 'Test Failed',
        message: err?.message || 'Failed to send telemetry test email.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSendingTelemetryTest = false;
    }
  }

  render(): ReactNode {
    if (this.isLoading) return <div className="p-12"><Loader label="Collecting Global Metadata..." /></div>;

    const theme = this.theme;
    const toggleTheme = this.runtime.toggleTheme;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Settings size={18} strokeWidth={2} />}
          title="General Configuration"
          subtitle="Brand identity & system preferences"
          actions={
            <Button
              icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
              onClick={this.handleSave}
              isLoading={this.isSaving}
              className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
            >
              Save Changes
            </Button>
          }
        />

        <div className="p-6 w-full space-y-8">
          <GeneralBrandCard
            settings={this.settings}
            setSettings={this.setSettings}
            theme={theme}
            toggleTheme={toggleTheme}
          />

          <GeneralSystemCards
            settings={this.settings}
            setSettings={this.setSettings}
            theme={theme}
            timezoneOptions={this.timezoneOptions}
            isSendingTelemetryTest={this.isSendingTelemetryTest}
            onSendTelemetryTest={this.handleSendTelemetryTest}
          />

          <Slot name="admin.settings.general.bottom" />
        </div>
      </div>
    );
  }
}
