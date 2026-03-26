"use client";

import Link from 'next/link';
import { FrameworkIcons } from '@/lib/icons';

export default function UserSecurityHeader({ email, isDark, backHref }: { backHref: string; email: string; isDark: boolean }) {
  return (
    <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${isDark ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'}`}>
      <div className="w-full px-6 lg:px-12 py-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={backHref} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
            <FrameworkIcons.Left size={20} />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Security & Two-Factor Authentication</h1>
            <div className="flex items-center gap-4 mt-1"><span className="text-[10px] font-bold tracking-tight text-slate-500">{email}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
