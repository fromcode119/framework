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
    <div className="w-full pb-24 animate-in fade-in duration-700">
      {/* Premium Plugins Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h1 className={`text-4xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
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
                    {React.cloneElement(tab.icon as React.ReactElement, { size: 18, strokeWidth: 2.5 })}
                    <span className="uppercase tracking-widest text-[11px]">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
        <div className="relative">
          {children}
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`p-10 border-t mt-auto ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Plugin Ecosystem
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400">Expand your system capabilities with official plugins.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="hover:text-indigo-500 transition-colors cursor-help">Developer Portal</span>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <span className="hover:text-indigo-500 transition-colors cursor-help">Documentation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
