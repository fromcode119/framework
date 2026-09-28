import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The switch behind `email_platform_fallback`: may a site with no mail provider of its own send
 * through the PLATFORM's mail server?
 *
 * It existed only as a row. The refusal every such site's mail met told the operator to set it, and
 * nothing in the admin could — the key was not even writable. It is per-site, off by default, and
 * only a platform admin may turn it on, because what it spends is the platform's SPF, DKIM and
 * sending reputation. The api drops the site's cached mail driver on save, so it applies to the next
 * message without a restart.
 */
export class EmailPlatformSenderPanel extends AdminComponent {
  private static readonly KEY = SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK;

  @state loading = true;
  @state saving = false;
  @state enabled = false;
  @state locks: PlatformSettingLocks | null = null;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const [settings, locks] = await Promise.all([
        AdminApi.get(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS),
        PlatformSettingLocks.load(),
      ]);
      if (!this.mounted) return;
      const value = settings?.[EmailPlatformSenderPanel.KEY];
      this.enabled = value === true || String(value ?? '') === 'true';
      this.locks = locks;
    } catch (error: any) {
      this.notifyError(AdminI18n.t('settings.integrations.failedToLoadThePlatform'), error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async setEnabled(next: boolean): Promise<void> {
    this.saving = true;
    const previous = this.enabled;
    this.enabled = next;
    try {
      await AdminApi.post(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS, { [EmailPlatformSenderPanel.KEY]: next });
    } catch (error: any) {
      this.enabled = previous;
      this.notifyError(AdminI18n.t('settings.integrations.failedToSaveThePlatform'), error);
    } finally {
      if (this.mounted) this.saving = false;
    }
  }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({ type: NotificationType.ERROR, title, message: error?.message || AdminI18n.t('settings.integrations.unexpectedError') });
  }

  private renderBody(locks: PlatformSettingLocks): ReactNode {
    if (locks.isPlatformScope()) {
      return (
        <p className="text-xs text-slate-500">
          {AdminI18n.t('settings.integrations.thisIsDecidedPerSite')}
        </p>
      );
    }
    const locked = locks.locks(EmailPlatformSenderPanel.KEY);
    return (
      <Switch
        checked={this.enabled}
        disabled={this.saving || locked}
        label={AdminI18n.t('settings.integrations.sendThroughThePlatformS')}
        description={locked
          ? (this.enabled ? AdminI18n.t('settings.integrations.platformSenderOnLocked') : AdminI18n.t('settings.integrations.platformSenderOffLocked'))
          : this.enabled
            ? AdminI18n.t('settings.integrations.onWhileThisSiteHas')
            : AdminI18n.t('settings.integrations.offWhileThisSiteHas')}
        onChange={(next: boolean) => { void this.setEnabled(next); }}
      />
    );
  }

  render(): ReactNode {
    // A single-site deployment has no platform to borrow from: its own mail provider above is the only one.
    if (!this.loading && this.locks && !this.locks.isSiteScope() && !this.locks.isPlatformScope()) return null;
    return (
      <Card title={AdminI18n.t('settings.integrations.platformMailFallback')}>
        <p className="mb-3 text-xs text-slate-500">
          {AdminI18n.t('settings.integrations.usedOnlyWhileThisSite')}
        </p>
        {this.loading || !this.locks ? <Loader /> : this.renderBody(this.locks)}
      </Card>
    );
  }
}
