"use client";

import React from 'react';
import Link from 'next/link';
import { FrameworkIcons } from '@fromcode119/react';
import type { CompactPageHeaderProps } from './compact-page-header.interfaces';

/**
 * The single compact admin page header — sticky bar with an optional back button, an icon badge,
 * a title + subtitle, and right-aligned actions. EVERY admin page (incl. plugin pages via
 * PluginPageHeader) should render this so headers stay consistent and dense; change it here once and
 * it changes everywhere. Theming is via Tailwind `dark:` classes, so it needs no `theme` prop (the
 * optional one is accepted for backward-compat and ignored).
 */
export class CompactPageHeader extends React.Component<CompactPageHeaderProps> {
  private backButton(): React.ReactNode {
    const { backHref, onBack } = this.props;
    if (!backHref && !onBack) return null;
    const cls = 'h-9 w-9 flex items-center justify-center rounded-lg border shrink-0 transition-colors border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800';
    const inner = <FrameworkIcons.Left size={16} strokeWidth={2} />;
    if (backHref) return <Link href={backHref} className={cls}>{inner}</Link>;
    return <button type="button" onClick={onBack} className={cls}>{inner}</button>;
  }

  render(): React.ReactNode {
    const { icon, title, subtitle, actions } = this.props;
    return (
      <div className="sticky top-0 z-40 border-b backdrop-blur bg-white/90 border-slate-100 dark:bg-slate-950/80 dark:border-slate-800/60">
        <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {this.backButton()}
            {icon && (
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-600 text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:border dark:border-indigo-500/20 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-tight text-slate-900 dark:text-white">{title}</h1>
              {subtitle && <p className="text-xs font-medium text-slate-500 dark:text-slate-500 tracking-tight truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    );
  }
}
