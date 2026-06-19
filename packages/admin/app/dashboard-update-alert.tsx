import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import type { DashboardUpdateAlertProps } from './dashboard-sections.interfaces';

export class DashboardUpdateAlert extends React.Component<DashboardUpdateAlertProps> {
  render(): React.ReactNode {
    const { updateAvailable, onDismiss, onViewDetails } = this.props;
    return (
      <div className="p-1 rounded-[2rem] animate-in slide-in-from-top-4 duration-500 bg-gradient-to-r from-amber-500/10 via-amber-100/50 to-white dark:from-amber-500/20 dark:via-amber-600/10 dark:to-transparent border border-amber-500/20 shadow-xl shadow-amber-500/5">
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-[1.9rem] bg-white/80 dark:bg-slate-900/40">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <FrameworkIcons.Loader size={24} className="animate-spin" />
            </div>
            <div>
              <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Framework Update Available
              </h4>
              <p className="text-sm font-bold text-slate-500 tracking-tight">
                A new version of Fromcode Core <span className="font-bold text-amber-600">v{updateAvailable.latest}</span> is available.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] font-bold tracking-tight px-6 uppercase"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold tracking-tight px-8 h-11 rounded-xl shadow-lg shadow-amber-600/30 uppercase"
              onClick={onViewDetails}
            >
              View Update Details
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
