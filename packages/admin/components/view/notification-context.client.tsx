import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
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

  /** As long as --fc-dur-exit: a toast is marked as leaving, and removed when its exit has run. */
  private static readonly EXIT_MS = 150;

  @state private notifications: INotification[] = [];
  /** The toasts on their way out. */
  @state private leaving: string[] = [];

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
    if (this.leaving.includes(id) || !this.notifications.some((notification) => notification.id === id)) return;
    this.leaving = [...this.leaving, id];
    setTimeout(() => {
      this.notifications = this.notifications.filter((notification) => notification.id !== id);
      this.leaving = this.leaving.filter((gone) => gone !== id);
    }, NotificationProvider.EXIT_MS);
  }

  private get value(): { notify: NotificationProvider['notify']; addNotification: NotificationProvider['addNotification']; remove: NotificationProvider['remove'] } {
    return { notify: this.notify, addNotification: this.addNotification, remove: this.remove };
  }

  private icon(type: INotificationPayload['type']): ReactNode {
    const { Check, Alert, Info } = NotificationProvider.icons;
    if (type === NotificationType.SUCCESS) return Check ? <Check size={16} /> : null;
    if (type === NotificationType.ERROR) return Alert ? <Alert size={16} /> : null;
    if (type === NotificationType.INFO) return Info ? <Info size={16} /> : null;
    return null;
  }

  render(): ReactNode {
    return (
      <NotificationContextStore.context.Provider value={this.value}>
        {this.children}
        {/* The console's toast: the component surface with a flyout shadow, the kind said by the colour
            of its mark, the title in the ink and the message under it in the quiet ink. It was a solid
            emerald or rose brick with white text, which no other surface in the console looks like. */}
        <div className="fc-toasts">
          {this.notifications.map((notification) => (
            <div key={notification.id} className="fc-toast fc-enter" data-state={this.leaving.includes(notification.id) ? 'closed' : 'open'} data-type={String((notification.type as any)?.value ?? notification.type)} role="status">
              <span className="fc-toast__mark">{this.icon(notification.type)}</span>
              <div className="fc-toast__text">
                <span className="fc-toast__title">{notification.title}</span>
                {notification.message ? <span className="fc-toast__message">{notification.message}</span> : null}
              </div>
              <button type="button" onClick={() => this.remove(notification.id)} className="fc-toast__close">
                {NotificationProvider.icons.Close ? <NotificationProvider.icons.Close size={15} /> : null}
              </button>
            </div>
          ))}
        </div>
      </NotificationContextStore.context.Provider>
    );
  }
}
