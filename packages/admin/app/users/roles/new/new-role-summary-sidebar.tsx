'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { NewRoleSummarySidebarProps } from './new-role-summary-sidebar.interfaces';

export class NewRoleSummarySidebar extends React.Component<NewRoleSummarySidebarProps> {
  render(): React.ReactNode {
    const { permissionCount, loading, onCancel } = this.props;
    return (
      <div className="lg:col-span-4 space-y-8">
        <Card title="Summary">
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Role Type</span>
                  <Badge variant="amber" className="tracking-tight font-bold">Custom</Badge>
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Selected Scope</span>
                  <span className="text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">
                    {permissionCount === 0 ? 'No permissions' : `${permissionCount} actions selected`}
                  </span>
               </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 text-xs font-bold uppercase tracking-tight rounded-xl shadow-xl shadow-indigo-600/20 text-white"
                isLoading={loading}
                icon={<FrameworkIcons.Check size={18} />}
              >
                Save Role
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12 text-xs font-bold tracking-tight text-slate-400 uppercase"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Help">
           <p className="text-xs text-slate-500 leading-relaxed font-bold tracking-tight opacity-70">
             Creating this role will allow you to assign these specific permissions to any user in the system.
           </p>
        </Card>
      </div>
    );
  }
}
