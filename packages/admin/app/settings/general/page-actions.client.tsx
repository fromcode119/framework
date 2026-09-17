import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { ContextBridge } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { GeneralSettingsPageState } from '@/app/settings/general/page-state.client';

/**
 * Reading the general settings, writing them back, and proving the telemetry address works.
 *
 * The payload is BUILT from the declared key lists rather than from whatever happens to be on the
 * form, so a field removed from the screen stops being written instead of being written as blank.
 */
export abstract class GeneralSettingsPageActions extends GeneralSettingsPageState {
  protected async loadSettings(): Promise<void> {
    this.loadError = null;
    try {
      const response = await AdminSystemSettingsClient.getAll();
      this.settings = GeneralSettingsPageActions.mapResponse(response);
    } catch (err: any) {
      this.settings = null;
      this.loadError = err?.message || 'The system settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  /** Build the form state from the response ALONE — an absent key stays absent, it is not invented. */
  protected static mapResponse(response: Record<string, any>): Record<string, any> {
    const source = response || {};
    const mapped: Record<string, any> = { domain_aliases: GeneralSettingsPageActions.parseAliases(source.domain_aliases) };
    GeneralSettingsPageState.TEXT_KEYS.forEach((key) => {
      mapped[key] = source[key] ?? '';
    });
    GeneralSettingsPageState.BOOLEAN_KEYS.forEach((key) => {
      mapped[key] = source[key] === true || source[key] === 'true';
    });
    return mapped;
  }

  /** The full field set this screen owns, serialized. WHICH of these actually go is `handleSave`'s call. */
  protected static buildPayload(settings: Record<string, any>): Record<string, unknown> {
    return {
      platform_name: String(settings.platform_name ?? '').trim(),
      admin_search_indexing: Boolean(settings.admin_search_indexing),
      email_notifications: Boolean(settings.email_notifications),
      notification_email: String(settings.notification_email ?? '').trim(),
      notification_email_cc: String(settings.notification_email_cc ?? '').trim(),
      frontend_url: String(settings.frontend_url ?? '').trim(),
      admin_url: String(settings.admin_url ?? '').trim(),
      site_url: String(settings.site_url ?? '').trim(),
      marketplace_url: String(settings.marketplace_url ?? '').trim(),
      framework_repository: String(settings.framework_repository ?? '').trim(),
      sources_workspace_root: String(settings.sources_workspace_root ?? '').trim(),
      domain_aliases: JSON.stringify(Array.isArray(settings.domain_aliases) ? settings.domain_aliases : []),
      timezone: String(settings.timezone ?? '').trim(),
      frontend_auth_enabled: Boolean(settings.frontend_auth_enabled),
      frontend_registration_enabled: Boolean(settings.frontend_registration_enabled),
    };
  }

  protected static parseAliases(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    try {
      const parsed = JSON.parse(String(value ?? ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  protected get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadSettings();
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const settings = this.settings;
    // Fail closed: never PUT values that were not read back from the server.
    if (!settings) return;

    // Send only what THIS SCOPE can own. The page used to PUT all fifteen keys unconditionally, and
    // in the `PLATFORM / No site` scope eight of them are per-site: the API refuses such a PUT
    // whole, so the platform keys the operator had just edited were discarded with it and the screen
    // reported only the bare token `site_required`. The filter is the server's own answer
    // (`PlatformSettingLocks`), not a second list kept here — the same facts the inputs are disabled
    // from, so what is greyed out is exactly what is not sent.
    const payload = GeneralSettingsPageActions.buildPayload(settings);
    // BOTH, and they are not the same test. `shown` is what this scope is editing; `writable` is what
    // the API would accept. A platform admin inside a site may WRITE a platform key, but that control
    // lives in the platform scope — sending its form value from here would push a value nobody on this
    // screen could see, overwriting whatever another admin changed since the page loaded.
    const sendable = Object.fromEntries(
      Object.entries(payload).filter(([key]) => this.platformLocks.shown(key) && this.platformLocks.writable(key)),
    );

    if (Object.keys(sendable).length === 0) {
      addNotification({
        title: 'Nothing To Save',
        message: 'Nothing on this page can be changed in the current scope.',
        type: NotificationType.ERROR
      });
      return;
    }

    this.isSaving = true;
    try {
      await AdminSystemSettingsClient.update(sendable);

      // The WHOLE form state, not just what was sent. `AdminUrlUtils.resolveFrontendBaseUrl` reads
      // `frontend_url`/`site_url` from this context for every "view on site" link; registering only
      // the sent subset would leave them undefined in a site scope, where those keys are not shown.
      this.registerSettings(settings);

      addNotification({
        title: 'Settings Saved',
        message: 'Configuration updated successfully.',
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
}
