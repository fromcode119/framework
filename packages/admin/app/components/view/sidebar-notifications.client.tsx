import type { ReactElement } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons, PushDevice } from '@fromcode119/react';
import { CoercionUtils } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminPathUtils } from '@/lib/admin-path';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownPlacement } from '@/components/ui/enums/dropdown-placement.enum';
import { AdminNotificationEndpoints } from '@/lib/constants/admin-notification-endpoints';
import { AdminServiceWorkerConstants } from '@/lib/pwa/constants/admin-service-worker.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';

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

  private async open(notification: Record<string, any>): Promise<void> {
    if (!notification.read) await AdminApi.post(AdminNotificationEndpoints.read(Number(notification.id)), {}).catch(() => undefined);
    const link = CoercionUtils.toString(notification.link);
    if (link.startsWith('/')) this.router.push(link);
    void this.load();
  }

  private async readAll(): Promise<void> {
    await AdminApi.post(AdminNotificationEndpoints.READ_ALL, {}).catch(() => undefined);
    void this.load();
  }

  private async toggleDevice(): Promise<void> {
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

  private static when(value: unknown): string {
    const date = new Date(CoercionUtils.toString(value));
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  private get deviceItem(): IDropdownItem {
    if (!PushDevice.supported) return { label: AdminI18n.t('shell.notifications.deviceUnsupported'), onClick: () => undefined, icon: <FrameworkIcons.Bell size={16} /> };
    return {
      label: AdminI18n.t(this.deviceOn ? 'shell.notifications.deviceTurnOff' : 'shell.notifications.deviceOff'),
      detail: this.deviceOn ? AdminI18n.t('shell.notifications.deviceOn') : undefined,
      icon: <FrameworkIcons.Bell size={16} />,
      onClick: () => { void this.toggleDevice(); },
    };
  }

  /** One alert: its title, and what it says with when, on the line under it. */
  private item(notification: Record<string, any>, section?: string): IDropdownItem {
    return {
      label: CoercionUtils.toString(notification.title),
      detail: [CoercionUtils.toString(notification.body).slice(0, 140), SidebarNotifications.when(notification.createdAt)].filter(Boolean).join(' · '),
      section,
      scrolls: section ? true : undefined,
      onClick: () => { void this.open(notification); },
    };
  }

  /** The actions first, so they never sit below a long list; then what is new, then the rest. */
  private get items(): IDropdownItem[] {
    const fresh = this.notifications.filter((notification) => !notification.read);
    const seen = this.notifications.filter((notification) => notification.read);
    const actions: IDropdownItem[] = [
      this.deviceItem,
      ...(this.unread ? [{ label: AdminI18n.t('shell.notifications.markAllRead'), icon: <FrameworkIcons.Check size={16} />, onClick: () => { void this.readAll(); } }] : []),
    ];
    if (!this.notifications.length) return [...actions, { label: AdminI18n.t('shell.notifications.empty'), section: AdminI18n.t('shell.notifications.title'), onClick: () => undefined }];
    return [
      ...actions,
      ...fresh.map((notification, index) => this.item(notification, index === 0 ? AdminI18n.t('shell.notifications.new', { count: fresh.length }) : undefined)),
      ...seen.map((notification, index) => this.item(notification, index === 0 ? AdminI18n.t('shell.notifications.earlier') : undefined)),
    ];
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
        <Dropdown block placement={DropdownPlacement.BESIDE} align={HorizontalAlign.LEFT} items={this.items} trigger={this.trigger} />
      </div>
    );
  }
}
