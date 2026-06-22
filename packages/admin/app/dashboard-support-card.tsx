import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import type { DashboardSupportCardProps } from './dashboard-sections.interfaces';

export class DashboardSupportCard extends React.Component<DashboardSupportCardProps> {
  render(): React.ReactNode {
    return (
      <Card title="Support & Docs">
         <div className="space-y-3">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100 dark:border-indigo-500/10">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                "Need help scaling your framework? Check the documentation for architecture best practices."
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full justify-between group"
              as="a"
              href={AdminConstants.ROUTES.SETTINGS.FRAMEWORK}
            >
               Developer Guide
               <FrameworkIcons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] font-semibold tracking-wide text-slate-400">
               <a href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Github</a>
               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
               <a href={AdminConstants.FRAMEWORK_RESOURCES.DISCORD} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Discord</a>
               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
               <a href={AdminConstants.FRAMEWORK_RESOURCES.TWITTER} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Twitter</a>
            </div>
         </div>
      </Card>
    );
  }
}
