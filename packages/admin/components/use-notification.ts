"use client";

import { useContext } from 'react';
import type { NotificationContextType } from './notification-context.interfaces';
import { NotificationContextStore } from './notification-context-store';

export class NotificationHooks {
  static useNotify(): NotificationContextType {
    const context = useContext(NotificationContextStore.context);
    if (!context) {
      throw new Error('useNotify must be used within NotificationProvider');
    }
    return context;
  }

  static useNotification(): NotificationContextType {
    const context = useContext(NotificationContextStore.context);
    if (!context) {
      throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
  }
}
