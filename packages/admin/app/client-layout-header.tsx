"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';
import { useRouter } from 'next/navigation';
import { ThemeHooks } from '@/components/use-theme';
import { AuthHooks } from '@/components/use-auth';
import { Dropdown } from '@/components/ui/dropdown';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { ClientLayoutHeaderProps } from './client-layout.types';

const {
  Menu = () => null,
  Sun = () => null,
  Moon = () => null,
  User = () => null,
  Settings = () => null,
  Logout = () => null,
  Help = () => null,
} = (FrameworkIcons || {}) as any;

export default function ClientLayoutHeader({ onMenuClick }: ClientLayoutHeaderProps) {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const { user, logout } = AuthHooks.useAuth();
  const router = useRouter();
  const [apiStatus, setApiStatus] = React.useState<'loading' | 'online' | 'offline'>('loading');
  const [isMaintenance, setIsMaintenance] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH);
        setApiStatus('online');
        setIsMaintenance(data.maintenance === true);
      } catch {
        setApiStatus('offline');
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const userMenuItems = [
    {
      label: 'Profile Settings',
      icon: <User size={16} />,
      onClick: () => user?.id && router.push(AdminConstants.ROUTES.USERS.DETAIL(user.id)),
    },
    ...(user?.roles?.includes('admin')
      ? [{ label: 'System Settings', icon: <Settings size={16} />, onClick: () => router.push(AdminConstants.ROUTES.SETTINGS.ROOT) }]
      : []),
    { label: 'Help Center', icon: <Help size={16} />, onClick: () => window.open('https://docs.fromcode.com', '_blank') },
    { label: 'Logout Session', icon: <Logout size={16} />, onClick: logout, variant: 'danger' as const },
  ];

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white/80 px-6 backdrop-blur-md transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-[#020617]/80 lg:px-12">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-3 rounded-full border border-slate-200/60 bg-slate-100/80 px-4 py-1.5 shadow-inner transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
          <div className={`h-2 w-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500 animate-pulse' : apiStatus === 'offline' ? 'bg-red-500' : 'bg-slate-400'}`} />
          <span className="text-[10px] font-semibold tracking-wide text-slate-500">
            {apiStatus === 'online' ? 'System Online' : apiStatus === 'offline' ? 'System Offline' : 'Connecting...'}
          </span>
        </div>
        {isMaintenance ? (
          <div className="hidden items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 md:flex">
            <FrameworkIcons.Zap size={12} className="animate-pulse text-amber-500" />
            <span className="text-[10px] font-semibold tracking-wide text-amber-600">Maintenance Mode Active</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <Slot name="admin.layout.header.right" />
        <button
          onClick={() => router.push(AdminConstants.ROUTES.MINIMAL)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition-colors hover:border-cyan-400/60 hover:text-cyan-500 dark:border-slate-700 dark:text-slate-200"
          aria-label="Open Forge"
          title="Open Forge"
        >
          <FrameworkIcons.Zap size={14} />
        </button>
        <button onClick={toggleTheme} className="text-slate-500 transition-colors hover:text-indigo-500">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Dropdown
          items={userMenuItems}
          header={
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">Connected Account</span>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-xs font-bold text-white shadow-lg">
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">{user?.email || 'Guest Account'}</span>
                  <span className="text-[9px] font-semibold tracking-wide text-slate-400">{user?.roles?.[0] || 'Unassigned Role'}</span>
                </div>
              </div>
            </div>
          }
          trigger={
            <div className="flex max-w-[200px] items-center gap-3 transition-opacity hover:opacity-80">
              <div className="hidden flex-col items-end overflow-hidden sm:flex">
                <span className="w-full truncate text-right text-[11px] font-bold text-slate-900 dark:text-slate-200">
                  {user?.email?.split('@')[0] || 'Unknown'}
                </span>
                <span className="text-[9px] font-medium tracking-tight text-slate-500">{user?.roles?.[0] || 'Guest'}</span>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-transform group-hover:scale-105">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
          }
        />
      </div>
    </header>
  );
}
