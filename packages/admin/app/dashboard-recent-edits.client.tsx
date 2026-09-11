import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';

/**
 * Where you left off: the documents THIS operator last edited, newest first, one row each.
 *
 * Read from the version history the framework already writes, so nothing new is recorded to make
 * this work. Renders nothing for someone who has not edited anything — a new colleague's dashboard
 * should not carry an empty box telling them so.
 */
export class DashboardRecentEdits extends AdminComponent {
  private mounted = false;

  @state private edits: Array<Record<string, any>> = [];

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.RECENT_EDITS);
      if (this.mounted) this.edits = Array.isArray(data?.edits) ? data.edits : [];
    } catch {
      // The rest of the dashboard stands; this panel simply does not appear.
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  @bound
  private open(edit: Record<string, any>): void {
    if (!edit.pluginSlug || !edit.collectionSlug) return;
    this.router.push(AdminPathUtils.toAdminPath(`/${edit.pluginSlug}/${edit.collectionSlug}/${edit.recordId}`));
  }

  render(): ReactNode {
    if (this.edits.length === 0) return null;

    return (
      <div className="space-y-2">
        <DashboardSectionHeading label="Where you left off" />
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.edits.map((edit) => (
            <button
              key={`${edit.collectionSlug}:${edit.recordId}`}
              type="button"
              onClick={() => this.open(edit)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200">
                {String(edit.title)}
              </span>
              <span className="shrink-0 text-[11px] text-slate-500">{String(edit.collectionLabel)}</span>
              <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                {RelativeTimeFormatter.fromNow(edit.editedAt, '')}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}
