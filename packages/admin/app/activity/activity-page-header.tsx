import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import type { ActivityPageHeaderProps } from './activity-page.interfaces';

export class ActivityPageHeader extends React.Component<ActivityPageHeaderProps> {
  render(): React.ReactNode {
    const {
      mode,
      theme,
      searchQuery,
      onModeChange,
      onSearchQueryChange,
      onSearch,
    } = this.props;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Activity size={18} strokeWidth={2.5} />}
        title={mode === 'system' ? 'System Activity' : 'Security Audit'}
        subtitle="Global ledger of administrative actions and security events."
        actions={
          <>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
              <button
                onClick={() => onModeChange('system')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-all ${
                  mode === 'system'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                System Events
              </button>
              <button
                onClick={() => onModeChange('security')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-all ${
                  mode === 'security'
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Security Audit
              </button>
            </div>
            <form onSubmit={onSearch} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Search ${mode} logs...`}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className={`px-3 h-9 rounded-lg border text-xs font-medium outline-none transition-all w-48 ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                }`}
              />
              <Button
                type="submit"
                variant="secondary"
                className="px-4 h-9 rounded-lg font-semibold text-xs"
                icon={<FrameworkIcons.Search size={15} />}
              >
                Filter history
              </Button>
            </form>
          </>
        }
      />
    );
  }
}
