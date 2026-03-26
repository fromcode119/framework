"use client";

import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';

export default function SecurityRecommendationsCard({ isAdministrator, isDark, twoFactorEnabled }: { isAdministrator: boolean; isDark: boolean; twoFactorEnabled: boolean }) {
  return (
    <Card title="Security Recommendations" icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3"><div className={`h-8 w-8 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}><FrameworkIcons.ShieldCheck size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Two-Factor Authentication</h4><p className="text-xs text-slate-500 mt-1">{twoFactorEnabled ? 'Active and protecting this account' : 'Not enabled - highly recommended for admin accounts'}</p></div></div>
        <div className="flex items-start gap-3"><div className="h-8 w-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500"><FrameworkIcons.Check size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Password Protected</h4><p className="text-xs text-slate-500 mt-1">Account has a secure password</p></div></div>
        {isAdministrator ? <div className="flex items-start gap-3"><div className="h-8 w-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500"><FrameworkIcons.Shield size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Administrator Access</h4><p className="text-xs text-slate-500 mt-1">Full system access - 2FA strongly recommended</p></div></div> : null}
      </div>
    </Card>
  );
}
