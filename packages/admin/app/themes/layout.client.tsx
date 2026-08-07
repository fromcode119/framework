import { ThemeMode } from '@fromcode119/core/client';
import React from 'react';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';

export class ThemesLayout extends AdminComponent {
  @prop declare children: ReactNode;

  private get tabs(): Array<{ label: string; href: string; icon: ReactNode }> {
    return [
      { label: 'Installed', href: AdminConstants.ROUTES.THEMES.INSTALLED, icon: <FrameworkIcons.Layers size={16} /> },
      { label: 'Marketplace', href: AdminConstants.ROUTES.THEMES.MARKETPLACE, icon: <FrameworkIcons.ShoppingBag size={16} /> },
    ];
  }

  private get isMarketplace(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.THEMES.MARKETPLACE);
  }

  private get isInstalled(): boolean {
    const pathname = this.pathname;
    return (
      pathname === AdminConstants.ROUTES.THEMES.INSTALLED ||
      (pathname.startsWith(`${AdminConstants.ROUTES.THEMES.ROOT}/`) &&
        !pathname.startsWith(AdminConstants.ROUTES.THEMES.MARKETPLACE) &&
        pathname !== AdminConstants.ROUTES.THEMES.INSTALLED)
    );
  }

  private get isDetailPage(): boolean {
    const pathname = this.pathname;
    return (
      pathname.startsWith(`${AdminConstants.ROUTES.THEMES.ROOT}/`) &&
      !pathname.startsWith(AdminConstants.ROUTES.THEMES.MARKETPLACE) &&
      pathname !== AdminConstants.ROUTES.THEMES.INSTALLED &&
      pathname !== AdminConstants.ROUTES.THEMES.ROOT
    );
  }

  /** Logic to determine active tab strictly */
  private get activeTab(): { label: string; href: string; icon: ReactNode } {
    return this.isMarketplace ? this.tabs[1] : this.tabs[0];
  }

  render(): ReactNode {
    const theme = this.theme;
    const { isMarketplace, isInstalled, isDetailPage, activeTab } = this;

    return (
      <div className="w-full pb-12 animate-in fade-in duration-700">
        {/* Themes Header */}
        <div className={`sticky top-0 z-30 border-b backdrop-blur transition-all duration-300 ${
          theme === ThemeMode.DARK
            ? 'bg-slate-950/80 border-slate-800/50'
            : 'bg-white/90 border-slate-100'
        }`}>
          <div className="w-full px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h1 className={`text-xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                  {isDetailPage ? 'Theme Detail' : activeTab.label}
                </h1>
                <p className={`text-xs font-medium max-w-2xl ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isMarketplace
                    ? 'Discover and install visual styles to transform your platform.'
                    : 'Manage your existing installation, layout variables and configuration.'}
                </p>
              </div>

              <div className={`flex p-1 rounded-xl border transition-all duration-300 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-900/50 border-slate-800 backdrop-blur'
                  : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
              }`}>
                {this.tabs.map(tab => {
                  const isActive = tab.href === AdminConstants.ROUTES.THEMES.INSTALLED ? isInstalled : isMarketplace;

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? (theme === ThemeMode.DARK
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50')
                          : (theme === ThemeMode.DARK
                              ? 'text-slate-500 hover:text-slate-300'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')
                      }`}
                    >
                      {React.cloneElement(tab.icon as ReactElement<any>, { size: 16, strokeWidth: 2.5 })}
                      <span className="uppercase tracking-wide text-[11px]">{tab.label}</span>
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Visual Architecture & Themes
                  </span>
                </div>
                <p className="text-[9px] font-bold text-slate-400">Transform your platform interface with professional themes.</p>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                 {/* "Theme Documentation" pointed at docs.fromcode.com, which does not resolve. */}
                 <Link href={AdminConstants.ROUTES.THEMES.MARKETPLACE} className="hover:text-indigo-500 transition-colors">Marketplace Health</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
