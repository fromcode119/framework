import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * One line: a dot for how bad it is, what it is, where it belongs, and the one thing to do.
 *
 * Two-line rows with a grey explanation underneath were what made the old dashboard read as empty
 * space with text in it; everything here stays on one line and truncates.
 */
export class DashboardAttentionRow extends AdminComponent {
  @prop declare item: Record<string, any>;

  private static readonly DOT_BY_SEVERITY: Record<string, string> = {
    critical: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-slate-400 dark:bg-slate-600',
  };

  private get dotClass(): string {
    return DashboardAttentionRow.DOT_BY_SEVERITY[String(this.item?.severity)] ?? DashboardAttentionRow.DOT_BY_SEVERITY.info;
  }

  @bound
  private handleAction(): void {
    const path = String(this.item?.actionPath || '').trim();
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
  }

  render(): ReactNode {
    const item = this.item;
    return (
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${this.dotClass}`} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200">
          {String(item.title)}
          {item.detail ? <span className="text-slate-400"> — {String(item.detail)}</span> : null}
        </span>
        {item.siteHost ? (
          <span className="shrink-0 rounded border border-slate-200 px-1.5 text-[10px] text-slate-500 dark:border-slate-800">
            {String(item.siteHost)}
          </span>
        ) : null}
        {item.actionLabel && item.actionPath ? (
          <button
            type="button"
            onClick={this.handleAction}
            className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {String(item.actionLabel)}
          </button>
        ) : null}
      </div>
    );
  }
}
