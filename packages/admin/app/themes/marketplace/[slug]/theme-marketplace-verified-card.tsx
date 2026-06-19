"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { ThemeMarketplaceVerifiedCardProps } from './theme-marketplace-sections.interfaces';

export class ThemeMarketplaceVerifiedCard extends React.Component<ThemeMarketplaceVerifiedCardProps> {
  render(): React.ReactNode {
    const { adminTheme } = this.props;
    return (
      <div className={`p-8 rounded-[2.5rem] border-2 border-dashed ${adminTheme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <FrameworkIcons.Shield size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Verified</div>
            <div className={`text-xs font-bold ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Official UI Audit</div>
          </div>
        </div>
        <p className={`text-[11px] leading-relaxed font-semibold ${adminTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          This theme has been manually audited for WCAG accessibility, performance benchmarks, and Fromcode core compatibility.
        </p>
      </div>
    );
  }
}
