import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { Loader } from '@/components/ui/view/loader.client';
import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { MediaShareController } from '@/app/media/media-share-controller';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What each RECIPIENT of a share has done with it.
 *
 * The first version dumped the raw access log — one row per HTTP request, so a person refreshing the
 * page five times produced five identical "Opened" lines and the panel answered nothing. The question
 * an operator asks of one share is per person: has this recipient opened it, how many times, did they
 * actually download, when were they last there. One line per recipient is that answer.
 *
 * The full request-by-request timeline still exists — on the Activity screen, where investigating an
 * incident is the point. This panel is for reading a send at a glance.
 */
export class MediaShareActivity extends AdminComponent {
  @prop declare shareId: number;

  @state private data: any = null;
  @state private loading = true;

  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    const data = await MediaShareController.shareActivity(this.shareId);
    if (this.mounted) this.patch({ data, loading: false });
  }

  private formatWhen(value: unknown): string {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  /** One recipient's whole story on one line: opens, downloads, when they were last there. */
  private renderRecipient(row: any): ReactNode {
    const parts: string[] = [];
    if (row.views > 0) parts.push(`${AdminI18n.t('media.pageOpens')}: ${row.views}`);
    if (row.downloads > 0) parts.push(`${AdminI18n.t('media.downloads')}: ${row.downloads}`);
    if (row.refused > 0) parts.push(`${AdminI18n.t('media.refused')}: ${row.refused}`);
    const summary = parts.length ? parts.join(' · ') : AdminI18n.t('media.notOpenedYet');

    return (
      <ListRow key={row.grantId} title={<span className="fc-ext-row__plain">{row.email}</span>} description={summary}
        actions={row.lastAt ? undefined : <Badge variant={BadgeVariant.GRAY}>{AdminI18n.t('media.noActivity')}</Badge>}
        meta={row.lastAt ? AdminI18n.t('media.lastAt', { when: this.formatWhen(row.lastAt) }) : undefined} />
    );
  }

  render(): ReactNode {
    if (this.loading) return <Loader label={AdminI18n.t('media.loadingActivity')} />;

    const recipients: any[] = Array.isArray(this.data?.recipients) ? this.data.recipients : [];
    const stats: Array<[string, number]> = [
      [AdminI18n.t('media.recipients'), Number(this.data?.recipientCount || 0)],
      [AdminI18n.t('media.pageOpens'), Number(this.data?.viewCount || 0)],
      [AdminI18n.t('media.downloads'), Number(this.data?.downloadCount || 0)],
      [AdminI18n.t('media.refused'), Number(this.data?.refusedCount || 0)],
    ];

    return (
      <div className="fc-form-stack">
        <div className="fc-stat-strip fc-stat-strip--tight">{stats.map(([label, value]) => <StatCard key={label} title={label} value={String(value)} />)}</div>
        {recipients.length ? <ListCard>{recipients.map((row) => this.renderRecipient(row))}</ListCard> : null}
      </div>
    );
  }
}
