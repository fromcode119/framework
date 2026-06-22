import React from 'react';
import { Slot } from '@fromcode119/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import type { DashboardActivityFeedProps } from './dashboard-sections.interfaces';

export class DashboardActivityFeed extends React.Component<DashboardActivityFeedProps> {
  render(): React.ReactNode {
    const { activity, loadingActivity, hasMainContent, onViewAll } = this.props;
    return (
      <Card noPadding className="overflow-hidden border-0 bg-white shadow-sm ring-1 ring-slate-100 dark:bg-transparent dark:shadow-none dark:ring-0">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
           <div>
            <h3 className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">System Events</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Real-time lifecycle telemetry</p>
           </div>
           <Button
             variant="ghost"
             size="sm"
             onClick={onViewAll}
             className="text-[11px] font-medium px-3 group text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors dark:text-indigo-400 dark:hover:bg-slate-800"
           >
              View All <FrameworkIcons.ArrowRight size={13} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
           </Button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          <Slot name="admin.dashboard.main" />

          {!hasMainContent && activity.length > 0 && (
            activity.slice(0, 7).map((item) => (
              <div key={item.id} className="px-5 py-2.5 flex items-center gap-3 group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-lg ${
                  item.level === 'ERROR' ? 'bg-rose-500 text-white' :
                  item.level === 'WARN' ? 'bg-amber-500 text-white' :
                  'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white dark:bg-slate-800 dark:text-indigo-400'
                }`}>
                  <FrameworkIcons.Terminal size={13} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate text-slate-700 dark:text-slate-200">
                    {item.title}
                  </p>
                  <span className="text-[11px] text-indigo-500 dark:text-indigo-400">
                    {item.plugin ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : 'System'}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          ))}

          {!hasMainContent && activity.length === 0 && !loadingActivity && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
               <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center mb-3">
                 <FrameworkIcons.Search size={20} className="text-slate-300" />
               </div>
               <p className="text-[11px] font-medium text-slate-500">No telemetry recorded yet</p>
            </div>
          )}
        </div>
      </Card>
    );
  }
}
