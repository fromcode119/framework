import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

export class DashboardPageHeader extends PureReactor {
  @prop declare user: any;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const user = this.user;
    const theme = this.theme;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Layout size={18} strokeWidth={2.5} />}
        title={`Hello, ${user?.email?.split('@')[0] || 'Administrator'}`}
        subtitle={
          <>
            System status is <span className="text-emerald-500">Optimized</span> • {user?.email}
          </>
        }
        actions={
          <div className="px-4 h-9 rounded-lg border flex items-center gap-2 text-xs font-semibold tracking-tight bg-white border-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
            <FrameworkIcons.Clock size={15} className="text-indigo-500" />
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        }
      />
    );
  }
}
