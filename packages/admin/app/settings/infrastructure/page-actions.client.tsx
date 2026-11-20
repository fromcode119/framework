import { SystemConstants } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { InfrastructureSettingsPageState } from '@/app/settings/infrastructure/page-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Reading and writing the platform settings this screen owns.
 *
 * Each group is written on its own — they are unrelated settings that happen to share a screen, and
 * one failing must not discard what the operator typed in another — but all of them are saved from the
 * page's one bar (PendingSaves), which writes the groups that changed.
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
      this.pendingMaintenance?.mark();
      this.pendingSsr?.mark();
      this.pendingLogs?.mark();
      this.pendingAudit?.mark();
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
  toggleMaintenance(val: boolean): void {
    // The switch only changes what is on screen; the page's save bar writes it, like every other value
    // here. Flipped and written at once, a slip of the hand took every site offline.
    if (this.maintenance === null) return;
    this.maintenance = val;
  }

  @bound
  async saveMaintenance(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const val = this.maintenance === true;
    try {
      await AdminSystemSettingsClient.update({ maintenance_mode: val });
      addNotification({ title: AdminI18n.t('settings.infrastructure.systemUpdated'), message: (val ? AdminI18n.t('settings.infrastructure.maintenanceNowActive') : AdminI18n.t('settings.infrastructure.maintenanceNowInactive')), type: NotificationType.INFO });
    } catch (err: any) {
      this.pendingMaintenance?.failed();
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
      this.pendingAudit?.failed();
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
      this.pendingLogs?.failed();
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
      this.pendingSsr?.failed();
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveTheServer'), type: NotificationType.ERROR });
    } finally {
      this.isSavingSsrCap = false;
    }
  }
}
