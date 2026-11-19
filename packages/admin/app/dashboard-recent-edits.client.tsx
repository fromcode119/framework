import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminPathUtils } from '@/lib/admin-path';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';
import { SectionCard } from '@/components/plugin-dashboard/view/section-card.client';
import { AdminServices } from '@/lib/admin-services';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  /**
   * The collection's name as the console shows it everywhere else — the runtime's collection list,
   * which the api has already put into the console's language. The edit row carries the name the
   * collection declares, so it is only the fallback for a collection this console does not load.
   */
  private collectionName(edit: Record<string, any>): string {
    const collections = (this.runtime?.plugins?.collections ?? []) as Array<Record<string, any>>;
    const match = collections.find((collection) => collection.pluginSlug === edit.pluginSlug
      && (collection.shortSlug === edit.collectionSlug || collection.slug === edit.collectionSlug));
    return AdminServices.getInstance().localization.resolveAnyString(match?.displayName || match?.label || edit.collectionLabel);
  }

  render(): ReactNode {
    if (this.edits.length === 0) return null;

    return (
      <ListShell title={AdminI18n.t('dashboard.leftOff')}>
        <div>
          {this.edits.map((edit) => (
            <ListRow
              key={`${edit.collectionSlug}:${edit.recordId}`}
              // A localized title is a MAP keyed by locale, not a string; `String()` printed it as raw JSON.
              title={<button type="button" className="fc-ext-row__link" onClick={() => this.open(edit)}>{AdminServices.getInstance().localization.resolveAnyString(edit.title)}</button>}
              description={[this.collectionName(edit), RelativeTimeFormatter.fromNow(edit.editedAt, '')].filter(Boolean).join(' · ')}
            />
          ))}
        </div>
      </ListShell>
    );
  }
}
