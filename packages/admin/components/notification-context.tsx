'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { Notification, NotificationPayload } from './notification-context.interfaces';
import { NotificationContextStore } from './notification-context-store';

const {
  Check = () => null,
  Alert = () => null,
  Info = () => null,
  Close = () => null,
} = (FrameworkIcons || {}) as any;

export class NotificationProvider extends React.Component<{ children: ReactNode }, { notifications: Notification[] }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { notifications: [] };
    this.notify = this.notify.bind(this);
    this.addNotification = this.addNotification.bind(this);
    this.remove = this.remove.bind(this);
  }

  notify(type: NotificationPayload['type'], title: string, message: string): void {
    const id = Math.random().toString(36).substr(2, 9);
    this.setState((prev) => ({ notifications: [...prev.notifications, { id, type, title, message }] }));
    setTimeout(() => {
      this.setState((prev) => ({ notifications: prev.notifications.filter((notification) => notification.id !== id) }));
    }, 5000);
  }

  addNotification(notification: NotificationPayload): void {
    this.notify(notification.type, notification.title, notification.message);
  }

  remove(id: string): void {
    this.setState((prev) => ({ notifications: prev.notifications.filter((notification) => notification.id !== id) }));
  }

  render(): React.ReactNode {
    return (
      <NotificationContextStore.context.Provider value={{ notify: this.notify, addNotification: this.addNotification, remove: this.remove }}>
        {this.props.children}
        <div className="fixed bottom-6 right-6 z-[9999] flex min-w-[320px] max-w-[420px] flex-col gap-3">
          {this.state.notifications.map((notification) => (
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
                onClick={() => this.remove(notification.id)}
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
}
