'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { NewUserAccessControlsProps } from './new-user-access-controls.interfaces';

export class NewUserAccessControls extends React.Component<NewUserAccessControlsProps> {
  render(): React.ReactNode {
    const { formData, onPatch } = this.props;
    return (
      <Card title="Access Controls">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Account Status</label>
               <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant={formData.accountStatus === 'active' ? 'primary' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => onPatch({ accountStatus: 'active' })}
                  >
                    Active
                  </Button>
                  <Button
                    type="button"
                    variant={formData.accountStatus === 'suspended' ? 'primary' : 'outline'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => onPatch({ accountStatus: 'suspended' })}
                  >
                    Suspended
                  </Button>
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Force Password Reset</label>
               <div className="pt-2">
                 <Switch
                   checked={formData.forcePasswordReset ?? false}
                   onChange={(checked) => onPatch({ forcePasswordReset: checked })}
                 />
               </div>
            </div>
         </div>
      </Card>
    );
  }
}
