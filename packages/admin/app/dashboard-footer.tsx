import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { AppEnv } from '@/lib/env';
import { AdminConstants } from '@/lib/constants/admin.constants';

export class DashboardFooter extends PureReactor {
  @prop declare platformName: string;

  render(): ReactNode {
    return (
      <div className="p-6 border-t mt-auto bg-slate-50/50 border-slate-100 dark:bg-slate-950/20 dark:border-slate-800">
        <div className="w-full px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
                  {this.platformName} Infrastructure // v{AppEnv.APP_VERSION} {AppEnv.APP_CHANNEL}
                </span>
              </div>
              {/* No health/topology claim here: this footer fetches nothing, so any "all systems
                  operational" line would assert a status it never measured. Live status belongs to the
                  plugin-health surface, which reads the health endpoint. */}
            </div>

            <div className="flex items-center gap-4 text-[10px] font-bold tracking-tight text-slate-400 uppercase">
              <a href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Github</a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
