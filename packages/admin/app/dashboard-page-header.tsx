import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import type { IPluginHealthCounts } from '@/app/plugins/health/interfaces/plugin-health-counts.interface';

export class DashboardPageHeader extends PureReactor {
  @prop declare user: any;
  @prop declare theme: ThemeMode;
  /** Live counts from the plugin registry health endpoint; null until loaded (or when it failed). */
  @prop declare health: IPluginHealthCounts | null;

  /**
   * A factual sentence about the plugin registry, never a verdict. This replaces a hardcoded
   * "System status is Optimized", which asserted health unconditionally — it stayed green with
   * plugins in error. While `health` is null nothing is claimed at all.
   */
  private get status(): ReactNode {
    const health = this.health;
    if (!health) return null;

    if (health.error > 0) {
      return <span className="text-rose-500">{health.error} plugin{health.error === 1 ? '' : 's'} in error</span>;
    }
    if (health.held > 0) {
      return <span className="text-amber-500">{health.held} plugin{health.held === 1 ? '' : 's'} held for re-approval</span>;
    }
    return <span className="text-emerald-500">{health.active} of {health.total} plugins active</span>;
  }

  render(): ReactNode {
    const user = this.user;
    const theme = this.theme;
    const status = this.status;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Layout size={18} strokeWidth={2.5} />}
        title={`Hello, ${user?.email?.split('@')[0] || 'Administrator'}`}
        subtitle={
          <>
            {status ? <>{status} • </> : null}{user?.email}
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
