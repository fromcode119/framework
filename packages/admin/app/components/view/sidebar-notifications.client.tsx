import type { ReactElement } from 'react';
import { prop, state, ref, bound } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons, PushDevice } from '@fromcode119/react';
import { CoercionUtils } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminPathUtils } from '@/lib/admin-path';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { NotificationPanel } from '@/app/components/view/notification-panel.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownPlacement } from '@/components/ui/enums/dropdown-placement.enum';
import { AdminNotificationEndpoints } from '@/lib/constants/admin-notification-endpoints';
import { AdminServiceWorkerConstants } from '@/lib/pwa/constants/admin-service-worker.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';

/**
 * The console's notifications — what plugins and the framework tell the signed-in person
 * (`context.notifications.notifyUser` / `notifyAdmins`), with a way to have them on this device too.
 *
 * Every alert was already being stored and served (`/system/admin/notifications`), but nothing in the
 * console read it, so a new support conversation or order alert reached nobody who was not also
 * reading email. It sits beside the account menu at the foot of the sidebar, and checks again every
 * minute while the console is open.
 */
export class SidebarNotifications extends AdminComponent {
  @prop declare isMini?: boolean;
  @state private notifications: Array<Record<string, any>> = [];
  @state private unread = 0;
  @state private deviceOn = false;
  @state private expandedId: number | null = null;
  @ref declare private dropdown: Ref<Dropdown>;
  private static readonly REFRESH_MS = 60_000;

  private get device(): PushDevice {
    return new PushDevice({
      workerUrl: AdminPathUtils.toAdminPath(AdminServiceWorkerConstants.SCRIPT_PATH),
      scope: AdminPathUtils.toAdminPath('/'),
      surface: 'console',
      requests: {
        publicKey: async () => CoercionUtils.toString((await AdminApi.get(AdminNotificationEndpoints.PUSH_KEY, { noDedupe: true }))?.publicKey),
        save: async (body) => { await AdminApi.post(AdminNotificationEndpoints.PUSH_SUBSCRIPTIONS, body); },
        remove: async (endpoint) => { await AdminApi.post(AdminNotificationEndpoints.PUSH_SUBSCRIPTIONS_REMOVE, { endpoint }); },
      },
    });
  }

  componentDidMount(): void {
    void this.load();
    void this.device.isOn().then((on) => { this.deviceOn = on; }).catch(() => undefined);
    const timer = window.setInterval(() => void this.load(), SidebarNotifications.REFRESH_MS);
    this.onUnmount(() => window.clearInterval(timer));
  }

  private async load(): Promise<void> {
    const response = await AdminApi.get(AdminNotificationEndpoints.LIST, { noDedupe: true }).catch(() => null);
    if (!response) return;
    this.setState({ notifications: CoercionUtils.toArray(response.notifications), unread: CoercionUtils.toNumber(response.unread, 0) });
  }

  /**
   * Opening a row shows the whole message in place and marks it read, at once on screen and then on the
   * server, so the count drops as you click rather than a minute later. A second click folds it again.
   */
  @bound private toggle(notification: Record<string, any>): void {
    const id = Number(notification.id);
    this.expandedId = this.expandedId === id ? null : id;
    if (notification.read) return;
    this.notifications = this.notifications.map((row) => (Number(row.id) === id ? { ...row, read: true } : row));
    this.unread = Math.max(0, this.unread - 1);
    void AdminApi.post(AdminNotificationEndpoints.read(id), {}).catch(() => undefined);
  }

  @bound private follow(link: string): void {
    this.close();
    this.router.push(link);
  }

  private close(): void {
    if (this.dropdown.current) this.dropdown.current.isOpen = false;
  }

  @bound private async readAll(): Promise<void> {
    this.notifications = this.notifications.map((row) => ({ ...row, read: true }));
    this.unread = 0;
    await AdminApi.post(AdminNotificationEndpoints.READ_ALL, {}).catch(() => undefined);
    void this.load();
  }

  @bound private async toggleDevice(): Promise<void> {
    try {
      if (this.deviceOn) await this.device.turnOff();
      else if (!(await this.device.turnOn())) {
        this.runtime?.notify.notify(NotificationType.INFO, AdminI18n.t('shell.notifications.title'), AdminI18n.t(PushDevice.blocked ? 'shell.notifications.deviceBlocked' : 'shell.notifications.deviceDeclined'));
      }
    } catch (error) {
      this.runtime?.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.notifications.title'), AdminI18n.t('shell.notifications.deviceFailed'));
      console.warn('[notifications] device change failed:', String((error as Error)?.message || error));
    }
    this.deviceOn = await this.device.isOn().catch(() => false);
  }

  /** The panel's title bar: the count, and the one action that clears it. */
  private get header(): ReactElement {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">{AdminI18n.t('shell.notifications.title')}</h3>
          {this.unread ? <span className="text-[11px] text-slate-400 dark:text-slate-500">{AdminI18n.t('shell.notifications.unread', { count: this.unread })}</span> : null}
        </div>
        {this.unread ? (
          <button type="button" onClick={this.readAll} className="text-[12px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            {AdminI18n.t('shell.notifications.markAllRead')}
          </button>
        ) : null}
      </div>
    );
  }

  private get panel(): ReactElement {
    return (
      <NotificationPanel notifications={this.notifications} expandedId={this.expandedId} deviceOn={this.deviceOn}
        onToggle={this.toggle} onFollow={this.follow} onToggleDevice={this.toggleDevice} />
    );
  }

  private get trigger(): ReactElement {
    const badge = this.unread ? <span className="min-w-[18px] rounded-full bg-indigo-600 px-1.5 text-center text-[10.5px] font-semibold leading-[18px] text-white">{this.unread > 99 ? '99+' : this.unread}</span> : null;
    if (this.isMini) {
      return (
        <span className="relative flex justify-center py-1" title={AdminI18n.t('shell.notifications.title')}>
          <FrameworkIcons.Bell size={18} className="text-slate-500 dark:text-slate-400" />
          {this.unread ? <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full bg-indigo-600" /> : null}
        </span>
      );
    }
    return (
      <span className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70">
        <FrameworkIcons.Bell size={16} className="shrink-0 text-slate-400" />
        <span className="flex-1 truncate">{AdminI18n.t('shell.notifications.title')}</span>
        {badge}
      </span>
    );
  }

  render(): ReactElement {
    return (
      <div className="border-t border-slate-200/80 p-2 dark:border-slate-800/80">
        <Dropdown ref={this.dropdown} block placement={DropdownPlacement.BESIDE} align={HorizontalAlign.LEFT} items={[]} header={this.header} panel={this.panel} trigger={this.trigger} />
      </div>
    );
  }
}
