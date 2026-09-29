import { SystemConstants } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { InfrastructureSettingsPageState } from '@/app/settings/infrastructure/page-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      this.loadError = err?.message || AdminI18n.t('settings.infrastructure.theSystemSettingsRequestFailed');
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
      addNotification({ title: AdminI18n.t('settings.infrastructure.systemUpdated'), message: (val ? AdminI18n.t('settings.infrastructure.maintenanceNowActive') : AdminI18n.t('settings.infrastructure.maintenanceNowInactive')), type: NotificationType.INFO });
    } catch (err: any) {
      // The switch must not keep showing the position the write failed to reach.
      this.maintenance = previous;
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToToggleMaintenanceMode'), type: NotificationType.ERROR });
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
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: days > 0
          ? AdminI18n.t('settings.infrastructure.auditEntriesOlderThanDay', { days: days })
          : AdminI18n.t('settings.infrastructure.theAuditTrailIsKept'),
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveAuditRetention'), type: NotificationType.ERROR });
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
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: days > 0 ? AdminI18n.t('settings.infrastructure.systemLogsOlderThanDay', { days: days }) : AdminI18n.t('settings.infrastructure.systemLogsAreKeptForever'),
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveLogRetention'), type: NotificationType.ERROR });
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
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: cap >= 1
          ? AdminI18n.t('settings.infrastructure.theStorefrontKeepsUpTo', { cap: cap })
          : AdminI18n.t('settings.infrastructure.theStorefrontUsesItsDefault', { SSR_GENERATION_CAP_DEFAULT: SystemConstants.SSR_GENERATION_CAP_DEFAULT }),
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveTheServer'), type: NotificationType.ERROR });
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
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: modeChanged
          ? AdminI18n.t('settings.infrastructure.pluginIsolationSettingsSavedThe')
          : AdminI18n.t('settings.infrastructure.pluginIsolationSettingsSavedAnd'),
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveThePlugin'), type: NotificationType.ERROR });
    } finally {
      this.isSavingIsolation = false;
    }
  }
}
