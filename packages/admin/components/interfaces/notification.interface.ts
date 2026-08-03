import { NotificationType } from '@/components/enums/notification-type.enum';

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}
