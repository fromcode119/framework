"use client";

import { createContext } from 'react';
import type { NotificationContextType } from './notification-context.interfaces';

export class NotificationContextStore {
  static readonly context = createContext<NotificationContextType | undefined>(undefined);
}
