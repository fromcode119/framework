import { SystemConstants } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { InfrastructureSettingsPageState } from '@/app/settings/infrastructure/page-state.client';

/**
 * Reading and writing the platform settings this screen owns.
 *
 * Each card saves on its own — they are unrelated settings that happen to share a screen, and one
 * failing must not discard what the operator typed in another.
 */
export abstract class InfrastructureSettingsPageActions extends InfrastructureSettingsPageState {
  protected async loadMaintenance(): Promise<void> {
    this.loadError = null;
    try {
      const response = await AdminSystemSettingsClient.getAll();
      this.maintenance = response?.maintenance_mode === true || response?.maintenance_mode === 'true';
      this.logRetentionDays = String(response?.log_retention_days ?? '');
      this.auditRetentionDays = String(response?.audit_retention_days ?? '');
      this.ssrGenerationCap = String(response?.ssr_generation_cap ?? '');
      this.ssrRenderMemoryMb = String(response?.ssr_render_memory_mb ?? '');
      this.ssrRenderTimeoutMs = String(response?.ssr_render_timeout_ms ?? '');
      this.isolationDefault = String(response?.plugin_isolation_default ?? '');
      this.isolationDefaultInEffect = this.isolationDefault;
      this.isolationMemoryMb = String(response?.plugin_isolation_memory_mb ?? '');
      this.isolationTimeoutMs = String(response?.plugin_isolation_timeout_ms ?? '');
    } catch (err: any) {
      this.maintenance = null;
      this.loadError = err?.message || 'The system settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadMaintenance();
  }

  @bound
  async toggleMaintenance(val: boolean) {
    const addNotification = this.runtime.notify.addNotification;
    if (this.maintenance === null) return;
    const previous = this.maintenance;
    this.maintenance = val;
    try {
      await AdminSystemSettingsClient.update({ maintenance_mode: val });
      addNotification({ title: 'System Updated', message: `Maintenance mode is now ${val ? 'active' : 'inactive'}.`, type: NotificationType.INFO });
    } catch (err: any) {
      // The switch must not keep showing the position the write failed to reach.
      this.maintenance = previous;
      addNotification({ title: 'Error', message: err?.message || 'Failed to toggle maintenance mode.', type: NotificationType.ERROR });
    }
  }

  /**
   * The API owns the floor and refuses a short window with a sentence; this does not pre-empt it.
   * Duplicating the rule here would be a second place for it to drift from, and the refusal already
   * reads as prose.
   */
  @bound
  async saveAuditRetention(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingAuditRetention = true;
    try {
      await AdminSystemSettingsClient.update({ audit_retention_days: this.auditRetentionDays });
      const days = Number(this.auditRetentionDays);
      addNotification({
        title: 'System Updated',
        message: days > 0
          ? `Audit entries older than ${days} day(s) will be removed at the next daily sweep.`
          : 'The audit trail is kept forever.',
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save audit retention.', type: NotificationType.ERROR });
    } finally {
      this.isSavingAuditRetention = false;
    }
  }

  @bound
  async saveRetention(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingRetention = true;
    try {
      await AdminSystemSettingsClient.update({ log_retention_days: this.logRetentionDays });
      const days = Number(this.logRetentionDays);
      addNotification({
        title: 'System Updated',
        message: days > 0 ? `System logs older than ${days} day(s) will be removed.` : 'System logs are kept forever.',
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save log retention.', type: NotificationType.ERROR });
    } finally {
      this.isSavingRetention = false;
    }
  }

  @bound
  async saveSsrCap(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingSsrCap = true;
    try {
      await AdminSystemSettingsClient.update({
        ssr_generation_cap: this.ssrGenerationCap,
        ssr_render_memory_mb: this.ssrRenderMemoryMb,
        ssr_render_timeout_ms: this.ssrRenderTimeoutMs,
      });
      const cap = Number(this.ssrGenerationCap);
      addNotification({
        title: 'System Updated',
        message: cap >= 1
          ? `The storefront keeps up to ${cap} theme world(s) resident. Memory and deadline apply to render hosts started from now on.`
          : `The storefront uses its default of ${SystemConstants.SSR_GENERATION_CAP_DEFAULT} resident theme world(s). Memory and deadline apply to render hosts started from now on.`,
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save the server rendering cap.', type: NotificationType.ERROR });
    } finally {
      this.isSavingSsrCap = false;
    }
  }

  @bound
  async saveIsolation(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingIsolation = true;
    try {
      await AdminSystemSettingsClient.update({
        plugin_isolation_default: this.isolationDefault,
        plugin_isolation_memory_mb: this.isolationMemoryMb,
        plugin_isolation_timeout_ms: this.isolationTimeoutMs,
      });
      // Limits reach every running plugin on save: a new deadline at its next call, a new memory
      // ceiling by restarting that plugin's own process. Where plugins run is the exception.
      const modeChanged = this.isolationDefault !== this.isolationDefaultInEffect;
      if (modeChanged) this.isolationModeRestartPending = true;
      addNotification({
        title: 'System Updated',
        message: modeChanged
          ? 'Plugin isolation settings saved. The limits apply to every running plugin now. Where plugins run changes for plugins already loaded when the API restarts — use the button under "Where plugins run".'
          : 'Plugin isolation settings saved and applied to every running plugin.',
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save the plugin isolation settings.', type: NotificationType.ERROR });
    } finally {
      this.isSavingIsolation = false;
    }
  }
}
