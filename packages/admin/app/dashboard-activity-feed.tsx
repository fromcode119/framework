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
      <Card noPadding className="overflow-hidden border-0 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-transparent dark:shadow-none dark:ring-0">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800">
           <div>
            <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white uppercase">System Events</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-bold tracking-tight opacity-60 uppercase">Real-time lifecycle telemetry</p>
           </div>
           <Button
             variant="ghost"
             size="sm"
             onClick={onViewAll}
             className="text-[11px] font-bold tracking-tight px-4 group text-indigo-600 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all dark:text-indigo-400 dark:bg-transparent dark:hover:bg-slate-800 uppercase"
           >
              View All <FrameworkIcons.ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
           </Button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          <Slot name="admin.dashboard.main" />

          {!hasMainContent && activity.length > 0 && (
            activity.slice(0, 6).map((item) => (
              <div key={item.id} className="px-8 py-5 flex items-start gap-4 group transition-all duration-300 hover:bg-indigo-50/30 dark:hover:bg-slate-800/30">
                <div className={`mt-1 p-2.5 rounded-xl transition-all duration-300 ${
                  item.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                  item.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                  'bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20 dark:bg-slate-800 dark:border-transparent dark:text-indigo-400 dark:group-hover:bg-indigo-500 dark:group-hover:text-white'
                }`}>
                  <FrameworkIcons.Terminal size={14} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[13px] font-bold truncate leading-relaxed text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white tracking-tight">
                      {item.title}
                    </p>
                    <span className="text-[9px] font-bold tracking-tight whitespace-nowrap px-2 py-1 rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 uppercase">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-bold tracking-tight opacity-40 text-slate-900 dark:text-slate-400 uppercase">Source:</span>
                    <span className="text-[10px] font-bold tracking-tight transition-colors text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-white uppercase">
                      {item.plugin ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : 'System'}
                    </span>
                  </div>
                </div>
              </div>
            )
          ))}

          {!hasMainContent && activity.length === 0 && !loadingActivity && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center mb-4">
                 <FrameworkIcons.Search size={24} className="text-slate-300" />
               </div>
               <p className="text-[11px] font-semibold tracking-wide text-slate-500">No telemetry recorded yet</p>
            </div>
          )}
        </div>
      </Card>
    );
  }
}
