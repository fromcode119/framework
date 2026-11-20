import { Hint } from '@/components/ui/view/hint.client';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The switch behind `email_platform_fallback`: may a site with no mail provider of its own send
 * through the PLATFORM's mail server?
 *
 * It existed only as a row. The refusal every such site's mail met told the operator to set it, and
 * nothing in the admin could — the key was not even writable. It is per-site, off by default, and
 * only a platform admin may turn it on, because what it spends is the platform's SPF, DKIM and
 * sending reputation. The api drops the site's cached mail driver on save, so it applies to the next
 * message without a restart. The page's one save bar writes it, like every other setting.
 */
export class EmailPlatformSenderPanel extends AdminComponent {
  private static readonly KEY = SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK;

  @state loading = true;
  @state enabled = false;
  @state locks: PlatformSettingLocks | null = null;

  private mounted = false;
  /** What the page's one save bar reads and writes for this panel; made once it is mounted. */
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(
      () => this.enabled,
      () => this.save(),
      (value) => { this.enabled = value; },
    );
    try {
      const [settings, locks] = await Promise.all([
        AdminApi.get(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS),
        PlatformSettingLocks.load(),
      ]);
      if (!this.mounted) return;
      const value = settings?.[EmailPlatformSenderPanel.KEY];
      this.enabled = value === true || String(value ?? '') === 'true';
      this.locks = locks;
      this.pending.mark();
    } catch (error: any) {
      this.notifyError(AdminI18n.t('settings.integrations.failedToLoadThePlatform'), error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  private async save(): Promise<void> {
    try {
      await AdminApi.post(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS, { [EmailPlatformSenderPanel.KEY]: this.enabled });
    } catch (error: any) {
      this.pending?.failed();
      this.notifyError(AdminI18n.t('settings.integrations.failedToSaveThePlatform'), error);
    }
  }

  @bound private onEnabled(next: boolean): void { this.enabled = next; }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({ type: NotificationType.ERROR, title, message: error?.message || AdminI18n.t('settings.integrations.unexpectedError') });
  }

  private renderBody(locks: PlatformSettingLocks): ReactNode {
    if (locks.isPlatformScope()) {
      return <div className="fc-settings-note"><Hint>{AdminI18n.t('settings.integrations.thisIsDecidedPerSite')}</Hint></div>;
    }
    const locked = locks.locks(EmailPlatformSenderPanel.KEY);
    return (
      <SettingRow
        theme={this.theme}
        title={AdminI18n.t('settings.integrations.sendThroughThePlatformS')}
        description={locked
          ? (this.enabled ? AdminI18n.t('settings.integrations.platformSenderOnLocked') : AdminI18n.t('settings.integrations.platformSenderOffLocked'))
          : this.enabled
            ? AdminI18n.t('settings.integrations.onWhileThisSiteHas')
            : AdminI18n.t('settings.integrations.offWhileThisSiteHas')}
        width={SettingRowWidth.AUTO}
      >
        <Switch checked={this.enabled} disabled={locked} onChange={this.onEnabled} />
      </SettingRow>
    );
  }

  render(): ReactNode {
    // A single-site deployment has no platform to borrow from: its own mail provider above is the only one.
    if (!this.loading && this.locks && !this.locks.isSiteScope() && !this.locks.isPlatformScope()) return null;
    return (
      <Card title={AdminI18n.t('settings.integrations.platformMailFallback')} description={AdminI18n.t('settings.integrations.usedOnlyWhileThisSite')}>
        {this.loading || !this.locks ? <div className="fc-settings-note"><Loader /></div> : this.renderBody(this.locks)}
      </Card>
    );
  }
}
