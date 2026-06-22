"use client";

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';

export class ThemeSettingsHeader extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, themeDetail, marketplaceVersion } = model;
    const { activeTab, isUpdating, isSaving } = page.state;
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/themes"
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm ${adminTheme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 hover:shadow-md'}`}
        >
          <FrameworkIcons.Left size={18} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold tracking-tight truncate ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {themeDetail.name}
            </h1>
            <Badge variant={themeDetail.state === 'active' ? 'success' : 'gray'}>
              {themeDetail.state}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${adminTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{themeDetail.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${marketplaceVersion && marketplaceVersion !== themeDetail.version ? 'text-amber-500' : 'text-slate-400'}`}>
              Version {themeDetail.version}
            </span>
            {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
              <button
                onClick={() => void page.handleUpdate()}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>

        {activeTab === 'settings' && (
          <button
            onClick={() => void page.handleSaveConfig()}
            disabled={isSaving}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 shadow-sm active:scale-95 disabled:opacity-50 ${adminTheme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isSaving ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
            Apply Architecture Update
          </button>
        )}
      </div>
    );
  }
}
