import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { INotification } from '@/components/interfaces/notification.interface';
import type { INotificationPayload } from '@/components/interfaces/notification-payload.interface';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';

/** Toast surface for the admin: a list of live notifications plus the API to add and dismiss them. */
export class NotificationProvider extends Reactor {
  /** Auto-dismiss delay. */
  private static readonly TTL_MS = 5000;

  /** The icon set arrives through the runtime bridge, so a missing glyph renders as nothing. */
  private static readonly icons = (FrameworkIcons || {}) as Partial<Record<'Check' | 'Alert' | 'Info' | 'Close', (props: { size?: number }) => ReactNode>>;

  @prop declare children: ReactNode;

  @state private notifications: INotification[] = [];

  @bound
  notify(type: INotificationPayload['type'], title: string, message: string): void {
    const id = Math.random().toString(36).slice(2, 11);
    this.notifications = [...this.notifications, { id, type, title, message }];
    setTimeout(() => this.remove(id), NotificationProvider.TTL_MS);
  }

  @bound
  addNotification(notification: INotificationPayload): void {
    this.notify(notification.type, notification.title, notification.message);
  }

  @bound
  remove(id: string): void {
    this.notifications = this.notifications.filter((notification) => notification.id !== id);
  }

  private get value(): { notify: NotificationProvider['notify']; addNotification: NotificationProvider['addNotification']; remove: NotificationProvider['remove'] } {
    return { notify: this.notify, addNotification: this.addNotification, remove: this.remove };
  }

  private icon(type: INotificationPayload['type']): ReactNode {
    const { Check, Alert, Info } = NotificationProvider.icons;
    if (type === NotificationType.SUCCESS) return Check ? <Check size={20} /> : null;
    if (type === NotificationType.ERROR) return Alert ? <Alert size={20} /> : null;
    if (type === NotificationType.INFO) return Info ? <Info size={20} /> : null;
    return null;
  }

  render(): ReactNode {
    return (
      <NotificationContextStore.context.Provider value={this.value}>
        {this.children}
        <div className="fixed bottom-6 right-6 z-[9999] flex min-w-[320px] max-w-[420px] flex-col gap-3">
          {this.notifications.map((notification) => (
            <div
              key={notification.id}
              className={`animate-in slide-in-from-right-10 flex items-start gap-4 rounded-xl border p-4 shadow-2xl duration-300 ${
                notification.type === NotificationType.SUCCESS
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : notification.type === NotificationType.ERROR
                    ? 'border-rose-400 bg-rose-500 text-white'
                    : 'border-slate-700 bg-slate-900 text-white'
              }`}
            >
              <div className="mt-0.5">{this.icon(notification.type)}</div>
              <div className="flex-1">
                <h4 className="text-sm font-bold tracking-tight">{notification.title}</h4>
                <p className="mt-1 text-xs font-medium leading-relaxed text-white/80">{notification.message}</p>
              </div>
              <button
                type="button"
                onClick={() => this.remove(notification.id)}
                className="rounded-lg p-1 transition-colors hover:bg-white/10"
              >
                {NotificationProvider.icons.Close ? <NotificationProvider.icons.Close size={16} /> : null}
              </button>
            </div>
          ))}
        </div>
      </NotificationContextStore.context.Provider>
    );
  }
}
