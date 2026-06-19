import React from 'react';
import { AppEnv } from '@/lib/env';
import { AdminConstants } from '@/lib/constants';
import type { DashboardFooterProps } from './dashboard-footer.interfaces';

export class DashboardFooter extends React.Component<DashboardFooterProps> {
  render(): React.ReactNode {
    const { platformName } = this.props;
    return (
      <div className="p-10 border-t mt-auto bg-slate-50/50 border-slate-100 dark:bg-slate-950/20 dark:border-slate-800">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
                  {platformName} Infrastructure // v{AppEnv.APP_VERSION} {AppEnv.APP_CHANNEL}
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic uppercase tracking-tight">Connected to distributed cluster node. All systems operational.</p>
            </div>

            <div className="flex items-center gap-4 text-[10px] font-bold tracking-tight text-slate-400 uppercase">
              <a href={AdminConstants.FRAMEWORK_RESOURCES.DOCUMENTATION} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Documentation</a>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a href={AdminConstants.FRAMEWORK_RESOURCES.FRAMEWORK_ROADMAP} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Framework Roadmap</a>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a href={AdminConstants.FRAMEWORK_RESOURCES.SUPPORT} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
