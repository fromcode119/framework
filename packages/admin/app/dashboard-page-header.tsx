import React from 'react';
import { PageHeading } from '@/components/ui/page-heading';
import { FrameworkIcons } from '@fromcode119/react';
import type { DashboardPageHeaderProps } from './dashboard-page-header.interfaces';

export class DashboardPageHeader extends React.Component<DashboardPageHeaderProps> {
  render(): React.ReactNode {
    const { user } = this.props;
    return (
      <div className="sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)] dark:bg-slate-950/80 dark:border-slate-800/50 dark:shadow-2xl dark:shadow-black/20">
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <PageHeading
              icon={
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 bg-indigo-600 text-white dark:bg-indigo-500/10 dark:text-indigo-400">
                  <FrameworkIcons.Layout size={20} strokeWidth={2.5} />
                </div>
              }
              title={`Hello, ${user?.email?.split('@')[0] || 'Administrator'}`}
              subtitle={
                <>
                  System status is <span className="text-emerald-500">Optimized</span> • {user?.email}
                </>
              }
              titleClassName="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic"
              subtitleClassName="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-2"
            />

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end pr-4 border-r border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">Current Session</span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Authenticated via UI</span>
              </div>
              <div className="px-5 h-11 rounded-2xl border flex items-center gap-3 text-[11px] font-bold tracking-tight shadow-sm transition-all hover:scale-[1.02] bg-white border-slate-100 text-slate-500 hover:text-indigo-600 hover:shadow-indigo-500/5 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
                <FrameworkIcons.Clock size={16} className="text-indigo-500" />
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
