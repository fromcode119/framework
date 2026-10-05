import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons, PushDevice } from '@fromcode119/react';
import { NotificationRow } from '@/app/components/view/notification-row.client';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the sidebar's notifications button opens: the list, newest first, with the on-this-device
 * switch under it.
 *
 * It is a panel and not a menu of items: a notification is a message, and a menu row can show one line
 * of it with no room for the time it arrived, which is what this used to be.
 */
export class NotificationPanel extends PureReactor {
  @prop declare notifications: Array<Record<string, any>>;
  @prop declare expandedId: number | null;
  @prop declare deviceOn: boolean;
  @prop declare onToggle: (notification: Record<string, any>) => void;
  @prop declare onFollow: (link: string) => void;
  @prop declare onToggleDevice: () => void;

  /**
   * One list, newest first, and it stays put: a message read in place only loses its dot and its weight.
   * Splitting it into "new" and "earlier" moved a row out from under the cursor the moment it was opened.
   */
  private get list(): ReactNode {
    return this.notifications.map((row) => (
      <NotificationRow key={row.id} notification={row} expanded={this.expandedId === Number(row.id)} onToggle={this.onToggle} onFollow={this.onFollow} />
    ));
  }

  private get empty(): ReactNode {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <FrameworkIcons.Bell size={26} className="text-slate-300 dark:text-slate-600" />
        <p className="max-w-[16rem] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{AdminI18n.t('shell.notifications.empty')}</p>
      </div>
    );
  }

  private get device(): ReactNode {
    return (
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <Switch checked={this.deviceOn} onChange={this.onToggleDevice} disabled={!PushDevice.supported}
          label={AdminI18n.t('shell.notifications.device')}
          description={PushDevice.supported ? undefined : AdminI18n.t('shell.notifications.deviceUnsupported')} />
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className="w-[22rem] max-w-full">
        <div className="max-h-[min(30rem,62vh)] overflow-y-auto overscroll-contain">
          {this.notifications.length ? this.list : this.empty}
        </div>
        {this.device}
      </div>
    );
  }
}
