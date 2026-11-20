import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';

/**
 * One line: a dot for how bad it is, what it is, where it belongs, and the one thing to do.
 *
 * Two-line rows with a grey explanation underneath were what made the old dashboard read as empty
 * space with text in it; everything here stays on one line and truncates.
 */
export class DashboardAttentionRow extends AdminComponent {
  @prop declare item: Record<string, any>;

  private static readonly DOT_BY_SEVERITY: Record<string, string> = {
    critical: 'fc-tone-danger-solid',
    warning: 'fc-tone-warning-solid',
    info: 'fc-tone-faint-solid',
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
      <div className="flex items-center gap-2.5 px-4 py-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${this.dotClass}`} />
        <span className="min-w-0 flex-1 truncate fc-size-xs fc-tone-text">
          {String(item.title)}
          {item.detail ? <span className="fc-tone-muted"> — {String(item.detail)}</span> : null}
        </span>
        {item.siteHost ? (
          <span className="shrink-0 rounded border fc-tone-line px-1.5 fc-size-xs fc-tone-muted">
            {String(item.siteHost)}
          </span>
        ) : null}
        {item.actionLabel && item.actionPath ? (
          <Button type="button" variant={ButtonVariant.GHOST} className="shrink-0" onClick={this.handleAction}>
            {String(item.actionLabel)}
          </Button>
        ) : null}
      </div>
    );
  }
}
