import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { DashboardAttentionRow } from '@/app/dashboard-attention-row.client';

/**
 * What needs the operator, before anything that merely counts.
 *
 * Renders NOTHING when the list is empty — an empty "Needs you" panel saying "all clear" is a
 * congratulation nobody asked for, and it costs the same screen space as a real problem. The list
 * mixes the framework's platform checks with whatever the installed plugins report; core does not
 * know what an order is (see PluginAttentionRegistryService).
 */
export class DashboardNeedsYou extends AdminComponent {
  private mounted = false;

  @state private items: Array<Record<string, any>> = [];

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.ATTENTION);
      if (this.mounted) this.items = Array.isArray(data?.items) ? data.items : [];
    } catch {
      // A dashboard that cannot read this list shows the rest of itself rather than an error banner.
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactNode {
    if (this.items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500/40" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Needs you</span>
          <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{this.items.length}</span>
        </div>
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.items.map((item) => (
            <DashboardAttentionRow key={String(item.key)} item={item} />
          ))}
        </div>
      </div>
    );
  }
}
