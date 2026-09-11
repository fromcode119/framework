import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { DashboardAttentionRow } from '@/app/dashboard-attention-row.client';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';

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
        <DashboardSectionHeading label="Needs you" count={this.items.length} />
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.items.map((item) => (
            <DashboardAttentionRow key={String(item.key)} item={item} />
          ))}
        </div>
      </div>
    );
  }
}
