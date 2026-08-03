import { useContext } from 'react';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';

export class NotificationHooks {
  static useNotify(): INotificationContextType {
    const context = useContext(NotificationContextStore.context);
    if (!context) {
      throw new Error('useNotify must be used within NotificationProvider');
    }
    return context;
  }

  static useNotification(): INotificationContextType {
    const context = useContext(NotificationContextStore.context);
    if (!context) {
      throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
  }
}
