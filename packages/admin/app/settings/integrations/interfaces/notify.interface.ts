import type { NotificationType } from '@/components/enums/notification-type.enum';

/** Raises a notification toast. A call signature has no class form, so it stays an interface. */
export interface INotify {
  (notification: { type: NotificationType; title: string; message: string }): void;
}
