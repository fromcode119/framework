import type { NotificationType } from './notification-context.types';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationContextType {
  notify: (type: NotificationType, title: string, message: string) => void;
  addNotification: (notification: NotificationPayload) => void;
  remove: (id: string) => void;
}
