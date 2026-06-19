'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EditRoleSummarySidebarProps } from './edit-role-summary-sidebar.interfaces';

export class EditRoleSummarySidebar extends React.Component<EditRoleSummarySidebarProps> {
  render(): React.ReactNode {
    const { type, permissionCount, loading, onCancel } = this.props;
    return (
      <div className="lg:col-span-4 space-y-8">
        <Card title="Summary">
          <div className="space-y-6">
            <div className="bg-indigo-500/5 rounded-2.5xl p-6 border border-indigo-500/10 space-y-4">
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Role Type</span>
                  <Badge variant="amber">{type}</Badge>
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Selected Scope</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {permissionCount === 0 ? 'No permissions' : `${permissionCount} actions selected`}
                  </span>
               </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-lg shadow-indigo-600/10 text-white"
              isLoading={loading}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 font-bold text-slate-400"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </Card>

        <Card title="Security Note">
           <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
             Changes to role permissions are applied immediately. Users currently logged in with this role may need to refresh their session to see changes.
           </p>
        </Card>
      </div>
    );
  }
}
