import { ThemeMode } from '@fromcode119/core/client';
import React from 'react';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminConstants } from '@/lib/constants/admin.constants';

export class PluginsLayout extends AdminComponent {
  @prop declare children: ReactNode;

  private get tabs(): { label: string; href: string; icon: ReactNode }[] {
    return [
      { label: 'Installed', href: AdminConstants.ROUTES.PLUGINS.INSTALLED, icon: <FrameworkIcons.Layers size={16} /> },
      { label: 'Health', href: AdminConstants.ROUTES.PLUGINS.HEALTH, icon: <FrameworkIcons.Activity size={16} /> },
      { label: 'Marketplace', href: AdminConstants.ROUTES.PLUGINS.MARKETPLACE, icon: <FrameworkIcons.ShoppingBag size={16} /> },
    ];
  }

  private get isMarketplace(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.MARKETPLACE);
  }

  private get isHealth(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.HEALTH);
  }

  private get isInstalled(): boolean {
    return (
      this.pathname === AdminConstants.ROUTES.PLUGINS.ROOT ||
      this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.INSTALLED) ||
      (this.pathname.startsWith(`${AdminConstants.ROUTES.PLUGINS.ROOT}/`) && !this.isMarketplace && !this.isHealth)
    );
  }

  private get isPluginDetail(): boolean {
    return (
      this.pathname.startsWith(`${AdminConstants.ROUTES.PLUGINS.ROOT}/`) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.INSTALLED) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.HEALTH) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.MARKETPLACE)
    );
  }

  private get activeTab(): { label: string; href: string; icon: ReactNode } {
    return this.isMarketplace ? this.tabs[2] : this.isHealth ? this.tabs[1] : this.tabs[0];
  }

  render(): ReactNode {
    const theme = this.theme;
    const tabs = this.tabs;
    const isMarketplace = this.isMarketplace;
    const isHealth = this.isHealth;
    const isInstalled = this.isInstalled;

    return (
      <div className="w-full animate-in fade-in duration-700">
        {/* Plugins Header */}
        <div className={`sticky top-0 z-30 border-b backdrop-blur transition-all duration-300 ${
          theme === ThemeMode.DARK
            ? 'bg-slate-950/80 border-slate-800/50'
            : 'bg-white/90 border-slate-100'
        }`}>
          <div className="w-full px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h1 className={`text-xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                  {this.isPluginDetail ? 'Plugin Detail' : this.activeTab.label}
                </h1>
                <p className={`text-xs font-medium max-w-2xl ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isMarketplace
                    ? 'Discover and install power-ups to expand your platform capability.'
                    : isHealth
                      ? 'Monitor plugin health, held capability changes and boot failures.'
                      : 'Manage your existing installation, updates and configuration.'}
                </p>
              </div>

              <div className={`flex p-1 rounded-xl border transition-all duration-300 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-900/50 border-slate-800 backdrop-blur'
                  : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
              }`}>
                {tabs.map(tab => {
                  const isActive = tab.href === AdminConstants.ROUTES.PLUGINS.INSTALLED ? isInstalled : (tab.href === AdminConstants.ROUTES.PLUGINS.HEALTH ? isHealth : (tab.href === AdminConstants.ROUTES.PLUGINS.MARKETPLACE ? isMarketplace : false));

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? (theme === ThemeMode.DARK
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                              : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50')
                          : (theme === ThemeMode.DARK
                              ? 'text-slate-500 hover:text-slate-300'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')
                      }`}
                    >
                      {React.cloneElement(tab.icon as ReactElement<any>, { size: 16, strokeWidth: 2.5 })}
                      <span className="uppercase tracking-wide text-[10px] font-bold">{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full px-6 lg:px-8 pt-6 space-y-6 pb-6">
          <div className="relative">
            {this.children}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t mt-auto ${
          theme === ThemeMode.DARK ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
        }`}>
          <div className="w-full px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Plugin Ecosystem
                  </span>
                </div>
                <p className="text-[9px] font-semibold text-slate-400">Expand your system capabilities with official plugins.</p>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                 <a href={AdminConstants.FRAMEWORK_RESOURCES.DOCUMENTATION} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Documentation</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
