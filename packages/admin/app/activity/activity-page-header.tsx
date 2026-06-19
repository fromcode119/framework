import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/page-heading';
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
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20'
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <PageHeading
                icon={
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 transition-transform hover:rotate-0 ${
                    theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-600 text-white'
                  }`}>
                    <FrameworkIcons.Activity size={20} strokeWidth={2.5} />
                  </div>
                }
                title={mode === 'system' ? 'System Activity' : 'Security Audit'}
                subtitle="Global ledger of administrative actions and security events."
                titleClassName="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic"
                subtitleClassName="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight opacity-80 mt-2"
              />

              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                 <button
                  onClick={() => onModeChange('system')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-semibold tracking-wide transition-all ${
                    mode === 'system'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                 >
                   System Events
                 </button>
                 <button
                  onClick={() => onModeChange('security')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-semibold tracking-wide transition-all ${
                    mode === 'security'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                 >
                   Security Audit
                 </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <form onSubmit={onSearch} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Search ${mode} logs...`}
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  className={`px-4 py-2.5 rounded-xl border text-[13px] font-medium outline-none transition-all w-64 ${
                    theme === 'dark'
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                  }`}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  className="px-6 rounded-xl font-semibold tracking-wide text-[11px]"
                  icon={<FrameworkIcons.Search size={16} />}
                >
                  Filter history
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
