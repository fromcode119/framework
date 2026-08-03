import { NotificationType } from '@/components/enums/notification-type.enum';

export interface INotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
}
