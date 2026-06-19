'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { NewUserAccountFieldsProps } from './new-user-account-fields.interfaces';

export class NewUserAccountFields extends React.Component<NewUserAccountFieldsProps> {
  render(): React.ReactNode {
    const { formData, errors, onPatch } = this.props;
    return (
      <>
        <Card title="Account Details">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">E-Mail Address</label>
                 <Input
                    placeholder="user@fromcode.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    required
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Username</label>
                 <Input
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">First Name</label>
                 <Input
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Last Name</label>
                 <Input
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
           </div>
        </Card>

        <Card title="Security Setup">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Initial Password</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                    error={errors.password}
                    required
                    className="h-11 rounded-xl"
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
                    required
                    className="h-11 rounded-xl"
                 />
              </div>
           </div>
        </Card>
      </>
    );
  }
}
