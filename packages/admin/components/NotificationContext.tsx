'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FrameworkIcons } from '@/lib/icons';

const { Check, Alert, Info, Close } = FrameworkIcons;

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

interface NotificationContextType {
  notify: (type: NotificationType, title: string, message: string) => void;
  remove: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: NotificationType, title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, title, message }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, remove }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 min-w-[320px] max-w-[420px]">
        {notifications.map(n => (
          <div 
            key={n.id}
            className={`flex items-start gap-4 p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-10 duration-300 ${
              n.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
              n.type === 'error' ? 'bg-rose-500 text-white border-rose-400' :
              'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="mt-0.5">
              {n.type === 'success' && <Check size={20} />}
              {n.type === 'error' && <Alert size={20} />}
              {n.type === 'info' && <Info size={20} />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold tracking-tight">{n.title}</h4>
              <p className="text-xs mt-1 text-white/80 leading-relaxed font-medium">{n.message}</p>
            </div>
            <button 
              onClick={() => remove(n.id)}
              className="hover:bg-white/10 p-1 rounded-lg transition-colors"
            >
              <Close size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotify = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotify must be used within NotificationProvider');
  return context;
};
