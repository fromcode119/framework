import { NotificationType } from '@/components/enums/notification-type.enum';
import type { INotificationPayload } from '@/components/interfaces/notification-payload.interface';

export interface INotificationContextType {
  notify: (type: NotificationType, title: string, message: string) => void;
  addNotification: (notification: INotificationPayload) => void;
  remove: (id: string) => void;
}
