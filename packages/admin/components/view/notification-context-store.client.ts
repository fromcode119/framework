import { createContext } from 'react';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';

export class NotificationContextStore {
  static readonly context = createContext<INotificationContextType | undefined>(undefined);
}
