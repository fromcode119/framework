import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';

export class ThemeMarketplaceVerifiedCard extends PureReactor {
  @prop declare adminTheme: ThemeMode;

  render(): ReactNode {
    const adminTheme = this.adminTheme;
    return (
      <div className={`p-4 rounded-xl border-2 border-dashed ${adminTheme === ThemeMode.DARK ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <FrameworkIcons.Shield size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Verified</div>
            <div className={`text-xs font-bold ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>Official UI Audit</div>
          </div>
        </div>
        <p className={`text-[11px] leading-relaxed font-semibold ${adminTheme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
          This theme has been manually audited for WCAG accessibility, performance benchmarks, and Fromcode core compatibility.
        </p>
      </div>
    );
  }
}
