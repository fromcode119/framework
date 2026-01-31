"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const pathname = usePathname();

  const navItems = [
    { label: 'General', href: '/settings/general', icon: FrameworkIcons.Settings },
    { label: 'Permalinks', href: '/settings/permalinks', icon: FrameworkIcons.Link },
    { label: 'Security', href: '/settings/security', icon: FrameworkIcons.Shield },
    { label: 'Infrastructure', href: '/settings/infrastructure', icon: FrameworkIcons.Activity },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full">
      {/* Settings Navigation Sidebar */}
      <aside className={`w-full md:w-64 border-r shrink-0 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="p-8 space-y-8">
          <div>
            <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Configuration Menu
            </h2>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : theme === 'dark'
                          ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          : 'text-slate-600 hover:bg-white hover:shadow-sm hover:text-indigo-600'
                    }`}
                  >
                    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                      <Icon size={18} />
                    </div>
                    <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={`pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
             <div className="flex items-center gap-3 px-4">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  System Online
                </span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Settings Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
