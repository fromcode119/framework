import type { ReactNode } from 'react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Select } from '@/components/ui/view/select.client';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { MediaActivityLabels } from '@/app/media/media-activity-labels';
import { PluginTrendChart } from '@/components/plugin-dashboard/view/plugin-trend-chart.client';
import { MediaActivityPanelActions } from '@/app/media/components/view/media-activity-panel-actions.client';
import { MediaActivityRangeMode } from '@/app/media/enums/media-activity-range-mode.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The sections this panel is built from, one method each.
 *
 * Each renders only what the window actually returned: a section with no data says so rather than
 * drawing an empty chart, because an empty chart and a chart of zeroes read the same way and only one
 * of them is true.
 */
export abstract class MediaActivityPanelSections extends MediaActivityPanelActions {
  /**
   * The range control: the admin's own Select for the presets, its own DateTimePicker for a custom
   * window. Native browser inputs sat here briefly and looked like a different product — the framework
   * has these controls precisely so every screen offers the same ones.
   */
  protected renderRange(): ReactNode {
    const custom = this.rangeMode === MediaActivityRangeMode.CUSTOM;

    return (
      <div className="fc-chip-row">
        <div className="fc-page-bar__pick">
          <Select
            value={custom ? 'custom' : String(this.days)}
            onChange={(value: string) => void this.handleRangeMode(value)}
            options={[
              { value: '7', label: AdminI18n.t('media.last7Days') },
              { value: '30', label: AdminI18n.t('media.last30Days') },
              { value: '90', label: AdminI18n.t('media.last90Days') },
              { value: 'custom', label: AdminI18n.t('media.customRange') },
            ]}
          />
        </div>
        {custom ? (
          <>
            <div className="fc-page-bar__pick">
              <DateTimePicker value={this.fromIso || undefined} showTime={false} placeholder={AdminI18n.t('media.from')} onChange={(value: string | null) => this.patch({ fromIso: value || '' })} />
            </div>
            <div className="fc-page-bar__pick">
              <DateTimePicker value={this.toIso || undefined} showTime={false} placeholder={AdminI18n.t('media.to')} onChange={(value: string | null) => this.patch({ toIso: value || '' })} />
            </div>
            <Button variant={ButtonVariant.SECONDARY} disabled={!this.customWindow()} onClick={() => void this.load()}>{AdminI18n.t('media.apply')}</Button>
          </>
        ) : null}
      </div>
    );
  }

  protected renderTotals(): ReactNode {
    const totals = this.data?.totals || {};
    const cells: Array<[string, number]> = [
      [AdminI18n.t('media.sharesSent'), Number(totals.sharesSent || 0)],
      [AdminI18n.t('media.recipients'), Number(totals.recipients || 0)],
      [AdminI18n.t('media.pageOpens'), Number(totals.views || 0)],
      [AdminI18n.t('media.downloads'), Number(totals.downloads || 0)],
      [AdminI18n.t('media.refused'), Number(totals.refused || 0)],
    ];
    return <div className="fc-stat-strip">{cells.map(([label, value]) => <StatCard key={label} title={label} value={String(value)} />)}</div>;
  }

  /**
   * Opens and downloads per day. This is what makes the screen statistics rather than a list: the
   * shape of a week is visible at a glance, and a spike points at the day worth reading below.
   */
  protected renderTrend(): ReactNode {
    const series = this.data?.series;
    const labels: string[] = Array.isArray(series?.labels) ? series.labels : [];
    if (labels.length < 2) return null;

    // Day-of-month ticks; full dates for 90 days would overlap into noise.
    const ticks = labels.map((day: string, i: number) => (labels.length > 14 && i % Math.ceil(labels.length / 14) !== 0 ? '' : day.slice(8)));

    return (
      <RecordCard title={AdminI18n.t('media.opensAndDownloadsPerDay')}>
        <div className="fc-stack">
          <PluginTrendChart
            xLabels={ticks}
            height={150}
            series={[
              { label: AdminI18n.t('media.opens'), data: series.views },
              { label: AdminI18n.t('media.downloads'), data: series.downloads },
            ]}
          />
        </div>
      </RecordCard>
    );
  }

  /** The actionable block, and the reason this screen exists. */
  protected renderNotOpened(): ReactNode {
    const rows: any[] = Array.isArray(this.data?.notOpened) ? this.data.notOpened : [];

    return (
      <ListShell title={AdminI18n.t('media.notOpenedYet')} count={rows.length} subtitle={AdminI18n.t('media.liveLinksNobodyHasOpened')}>
        {!rows.length ? <EmptyState inline title={AdminI18n.t('media.everyoneHasOpenedWhatYou')} /> : (
          <div>
            {rows.map((row: any, index: number) => (
              <ListRow
                key={`${row.email}-${row.shareId}-${index}`}
                title={<span className="fc-ext-row__plain">{row.email}</span>}
                description={<>{this.shareLink(row.shareId, row.shareTitle)}{this.formatWhen(row.sentAt) ? ` · ${AdminI18n.t('media.sentAt', { when: this.formatWhen(row.sentAt) })}` : ''}</>}
                actions={row.expiresAt ? <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('media.expiresAt', { when: this.formatWhen(row.expiresAt) })}</Badge> : undefined}
              />
            ))}
          </div>
        )}
      </ListShell>
    );
  }

  protected renderTopFiles(): ReactNode {
    const rows: any[] = Array.isArray(this.data?.topFiles) ? this.data.topFiles : [];
    if (!rows.length) return null;

    return (
      <ListShell title={AdminI18n.t('media.mostDownloaded')} count={rows.length}>
        <div>
          {rows.map((row: any) => <ListRow key={row.mediaId} title={<span className="fc-ext-row__plain">{row.name || `#${row.mediaId}`}</span>} actions={<Badge>{String(row.downloads)}</Badge>} />)}
        </div>
      </ListShell>
    );
  }

  protected renderRefusals(): ReactNode {
    const rows: any[] = Array.isArray(this.data?.refusals) ? this.data.refusals : [];
    if (!rows.length) return null;

    return (
      <ListShell title={AdminI18n.t('media.refused')} subtitle={MediaActivityLabels.REFUSAL_NOTE}>
        <div>
          {rows.map((row: any) => <ListRow key={row.outcome} title={<span className="fc-ext-row__plain">{MediaActivityLabels.outcome(row.outcome)}</span>} actions={<Badge>{String(row.count)}</Badge>} />)}
        </div>
      </ListShell>
    );
  }

  protected renderEvents(): ReactNode {
    const rows: any[] = Array.isArray(this.data?.events) ? this.data.events : [];

    return (
      <ListShell title={AdminI18n.t('media.recentActivity')}
        foot={this.data?.eventsHasMore ? <Button variant={ButtonVariant.SECONDARY} isLoading={this.loadingMore} onClick={this.handleMoreEvents}>{AdminI18n.t('media.loadMore')}</Button> : undefined}>
        {!rows.length ? <EmptyState inline title={AdminI18n.t('media.nothingRecordedInThisRange')} /> : (
          <div>
            {rows.map((row: any) => (
              <ListRow
                key={row.id}
                title={<span className="fc-ext-row__plain">{row.email || AdminI18n.t('media.unknownRecipient')} · {MediaActivityLabels.action(row)}</span>}
                description={row.shareId ? this.shareLink(row.shareId, row.shareTitle) : undefined}
                meta={this.formatWhen(row.at)}
              />
            ))}
          </div>
        )}
      </ListShell>
    );
  }
}
