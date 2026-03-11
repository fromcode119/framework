'use client';

import React, { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { FrameworkIcons } from '@/lib/icons';
import type { Notification, NotificationPayload } from './notification-context.interfaces';
import { NotificationContextStore } from './notification-context-store';

const {
  Check = () => null,
  Alert = () => null,
  Info = () => null,
  Close = () => null,
} = (FrameworkIcons || {}) as any;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: NotificationPayload['type'], title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, 5000);
  }, []);

  const addNotification = useCallback((notification: NotificationPayload) => {
    notify(notification.type, notification.title, notification.message);
  }, [notify]);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  return (
    <NotificationContextStore.context.Provider value={{ notify, addNotification, remove }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex min-w-[320px] max-w-[420px] flex-col gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`animate-in slide-in-from-right-10 flex items-start gap-4 rounded-2xl border p-4 shadow-2xl duration-300 ${
              notification.type === 'success'
                ? 'border-emerald-400 bg-emerald-500 text-white'
                : notification.type === 'error'
                  ? 'border-rose-400 bg-rose-500 text-white'
                  : 'border-slate-700 bg-slate-900 text-white'
            }`}
          >
            <div className="mt-0.5">
              {notification.type === 'success' ? <Check size={20} /> : null}
              {notification.type === 'error' ? <Alert size={20} /> : null}
              {notification.type === 'info' ? <Info size={20} /> : null}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold tracking-tight">{notification.title}</h4>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/80">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(notification.id)}
              className="rounded-lg p-1 transition-colors hover:bg-white/10"
            >
              <Close size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContextStore.context.Provider>
  );
}
