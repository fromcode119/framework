'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeContext';
import { FrameworkIcons } from '@/lib/icons';

export default function PluginsLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const pathname = usePathname() || '';

  const tabs = [
    { label: 'Installed', href: '/plugins/installed', icon: <FrameworkIcons.Layers size={16} /> },
    { label: 'Marketplace', href: '/plugins/marketplace', icon: <FrameworkIcons.ShoppingBag size={16} /> },
  ];

  const isMarketplace = pathname.startsWith('/plugins/marketplace');
  const isInstalled = pathname.startsWith('/plugins/installed') || (pathname.startsWith('/plugins/') && !isMarketplace);
  const activeTab = isMarketplace ? tabs[1] : tabs[0];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="relative">
        {/* Decorative background glow for dark mode */}
        {theme === 'dark' && (
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -z-10" />
        )}
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className={`text-4xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900 uppercase'}`}>
              {pathname.includes('/plugins/') && !isMarketplace && !pathname.includes('/installed') ? 'Plugin Detail' : activeTab.label}
            </h1>
            <p className={`text-base font-medium max-w-2xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {isMarketplace
                ? 'Discover and install power-ups to expand your platform capability.' 
                : 'Manage your existing installation, updates and configuration.'}
            </p>
          </div>

          <div className={`flex p-1 rounded-2xl border transition-all duration-300 ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-slate-800 backdrop-blur-md' 
              : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
          }`}>
            {tabs.map(tab => {
              const isActive = tab.href === '/plugins/installed' ? isInstalled : (tab.href === '/plugins/marketplace' ? isMarketplace : false);
              
              return (
                <Link 
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
                    isActive 
                      ? (theme === 'dark' 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                          : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50') 
                      : (theme === 'dark' 
                          ? 'text-slate-500 hover:text-slate-300' 
                          : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')
                  }`}
                >
                  {React.cloneElement(tab.icon as React.ReactElement, { size: 18, strokeWidth: 3 })}
                  <span className="uppercase tracking-widest text-[11px]">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative">
        {children}
      </div>
    </div>
  );
}
