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
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { TimezoneUtils } from '@/lib/timezone';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { GeneralBrandCard } from '@/app/settings/general/general-brand-card';
import { GeneralSystemCards } from '@/app/settings/general/general-system-cards';

export class GeneralSettingsPage extends AdminComponent {
  /** The keys this screen owns. Was the key set of a seeded `@state settings` object — see `settings`. */
  private static readonly TEXT_KEYS = [
    'platform_name',
    'notification_email',
    'notification_email_cc',
    'frontend_url',
    'admin_url',
    'site_url',
    'marketplace_url',
    'timezone',
  ] as const;
  private static readonly BOOLEAN_KEYS = [
    'email_notifications',
    'frontend_auth_enabled',
    'frontend_registration_enabled',
  ] as const;

  @state isSaving = false;
  @state isSendingTelemetryTest = false;
  @state isLoading = true;
  /**
   * `null` means NEVER LOADED — it is not an empty form.
   *
   * This used to be seeded with `timezone: 'UTC'`, `frontend_auth_enabled: true` and
   * `frontend_registration_enabled: true`. All three are DECLARED server-side
   * (`packages/api/src/server/server-settings-service.ts` seeds them into `_system_meta`), so the
   * copies here were a second, invisible default — and because the load had no `catch`, a failed
   * settings GET rendered "Frontend Registration: ON" as though an operator had enabled public
   * self-registration, and Save then persisted it. No seed now: a failed load shows `loadError` and
   * the Save control is not rendered.
   */
  @state settings: Record<string, any> | null = null;
  @state loadError: string | null = null;

  async componentDidMount(): Promise<void> {
    await this.loadSettings();
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    this.loadError = null;
    try {
      const response = await AdminSystemSettingsClient.getAll();
      this.settings = GeneralSettingsPage.mapResponse(response);
    } catch (err: any) {
      this.settings = null;
      this.loadError = err?.message || 'The system settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  /** Build the form state from the response ALONE — an absent key stays absent, it is not invented. */
  private static mapResponse(response: Record<string, any>): Record<string, any> {
    const source = response || {};
    const mapped: Record<string, any> = { domain_aliases: GeneralSettingsPage.parseAliases(source.domain_aliases) };
    GeneralSettingsPage.TEXT_KEYS.forEach((key) => {
      mapped[key] = source[key] ?? '';
    });
    GeneralSettingsPage.BOOLEAN_KEYS.forEach((key) => {
      mapped[key] = source[key] === true || source[key] === 'true';
    });
    return mapped;
  }

  private static parseAliases(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    try {
      const parsed = JSON.parse(String(value ?? ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  private get timezoneOptions(): { label: string; value: string }[] {
    return TimezoneUtils.getTimezoneOptions(String(this.settings?.timezone ?? '').trim());
  }

  @bound
  setSettings(update: SetStateAction<Record<string, any>>): void {
    const current = this.settings;
    if (!current) return;
    this.settings = typeof update === 'function'
      ? (update as (prev: Record<string, any>) => Record<string, any>)(current)
      : update;
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const settings = this.settings;
    // Fail closed: never PUT values that were not read back from the server.
    if (!settings) return;
    this.isSaving = true;
    try {
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
      // Was a single opaque sentence for every failure, so a 403 was indistinguishable from a bad URL.
      addNotification({
        title: 'Save Failed',
        message: err?.message || 'Could not save settings.',
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
    if (this.isLoading) return <div className="p-12"><Loader label="Loading general settings..." /></div>;

    const theme = this.theme;
    const settings = this.settings;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Settings size={18} strokeWidth={2} />}
          title="General Configuration"
          subtitle="Brand identity & system preferences"
          actions={
            settings ? (
              <Button
                icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
                onClick={this.handleSave}
                isLoading={this.isSaving}
                className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              >
                Save Changes
              </Button>
            ) : null
          }
        />

        {this.loadError && (
          <LoadErrorPanel
            title="General settings could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        {settings && (
          <div className="p-6 w-full space-y-8">
            <GeneralBrandCard
              settings={settings}
              setSettings={this.setSettings}
              theme={theme}
              toggleTheme={this.runtime.toggleTheme}
            />

            <GeneralSystemCards
              settings={settings}
              setSettings={this.setSettings}
              theme={theme}
              timezoneOptions={this.timezoneOptions}
              isSendingTelemetryTest={this.isSendingTelemetryTest}
              onSendTelemetryTest={this.handleSendTelemetryTest}
            />

            <Slot name="admin.settings.general.bottom" />
          </div>
        )}
      </div>
    );
  }
}
