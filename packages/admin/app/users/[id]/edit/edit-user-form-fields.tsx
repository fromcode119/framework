'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import type { EditUserFormData } from './edit-user-page.interfaces';

export class EditUserFormFields extends React.Component<{
  formData: EditUserFormData;
  errors: Record<string, string>;
  onPatch: (patch: Partial<EditUserFormData>) => void;
}> {
  render(): React.ReactNode {
    const { formData, errors, onPatch } = this.props;
    return (
      <>
        <Card title="Profile Details">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">E-Mail Address</label>
                 <Input
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    required
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Username</label>
                 <Input
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">First Name</label>
                 <Input
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Last Name</label>
                 <Input
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                 />
              </div>
           </div>
        </Card>

        <Card title="Security Credentials" icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
           <p className="text-xs font-bold text-slate-500 mb-6 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
             Leave password fields blank if you do not wish to change the current password.
           </p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">New Password</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Confirm Password</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => onPatch({ confirmPassword: e.target.value })}
                    error={errors.confirmPassword}
                 />
              </div>
           </div>
        </Card>

        <Card title="Account Access Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
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
      </>
    );
  }
}
