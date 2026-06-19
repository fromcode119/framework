'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';

export class EditUserHeader extends React.Component<{
  theme: string;
  userId: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}> {
  render(): React.ReactNode {
    const { theme, userId, saving, onCancel, onSubmit } = this.props;
    return (
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={AdminConstants.ROUTES.USERS.DETAIL(userId)} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div>
              <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Edit Account
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Update profile information and security credentials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <Button
                variant="ghost"
                className="px-6 h-11 rounded-xl font-bold uppercase tracking-tight text-[11px]"
                onClick={onCancel}
             >
                Cancel
             </Button>
             <Button
                className="px-8 h-11 rounded-xl font-bold uppercase tracking-tight text-[11px] text-white shadow-xl shadow-indigo-500/20"
                icon={<FrameworkIcons.Check size={16} />}
                isLoading={saving}
                onClick={(e: React.FormEvent) => onSubmit(e)}
             >
                Save Changes
             </Button>
          </div>
        </div>
      </div>
    );
  }
}
