import type { ReactNode } from 'react';
import { AdminClass } from '@/lib/admin-class';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Select } from '@/components/ui/view/select.client';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { MediaActivityLabels } from '@/app/media/media-activity-labels';
import { PluginTrendChart } from '@/components/plugin-dashboard/view/plugin-trend-chart.client';
import { MediaActivityPanelActions } from '@/app/media/components/view/media-activity-panel-actions.client';
import { MediaActivityRangeMode } from '@/app/media/enums/media-activity-range-mode.enum';

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
  protected renderRange(dark: boolean): ReactNode {
    const custom = this.rangeMode === MediaActivityRangeMode.CUSTOM;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40 flex-shrink-0">
          <Select
            value={custom ? 'custom' : String(this.days)}
            onChange={(value: string) => void this.handleRangeMode(value)}
            size={FieldSize.SM}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: 'custom', label: 'Custom range…' },
            ]}
          />
        </div>
        {custom ? (
          <>
            <div className="w-36 flex-shrink-0">
              <DateTimePicker
                value={this.fromIso || undefined}
                showTime={false}
                size={FieldSize.SM}
                placeholder="From"
                onChange={(value: string | null) => this.patch({ fromIso: value || '' })}
              />
            </div>
            <span className="text-[11px] opacity-50">–</span>
            <div className="w-36 flex-shrink-0">
              <DateTimePicker
                value={this.toIso || undefined}
                showTime={false}
                size={FieldSize.SM}
                placeholder="To"
                onChange={(value: string | null) => this.patch({ toIso: value || '' })}
              />
            </div>
            <button
              type="button"
              disabled={!this.customWindow()}
              onClick={() => void this.load()}
              className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-40 bg-indigo-600 text-white"
            >
              Apply
            </button>
          </>
        ) : null}
      </div>
    );
  }

  protected renderTotals(): ReactNode {
    const totals = this.data?.totals || {};
    const cells: Array<[string, number]> = [
      ['Shares sent', Number(totals.sharesSent || 0)],
      ['Recipients', Number(totals.recipients || 0)],
      ['Page opens', Number(totals.views || 0)],
      ['Downloads', Number(totals.downloads || 0)],
      ['Refused', Number(totals.refused || 0)],
    ];

    return (
      <Card className={`px-4 py-3 ${AdminClass.SURFACE}`}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {cells.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-[17px] font-semibold tabular-nums leading-none">{value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest opacity-50 truncate">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  /**
   * Opens and downloads per day. This is what makes the screen statistics rather than a list: the
   * shape of a week is visible at a glance, and a spike points at the day worth reading below.
   */
  protected renderTrend(dark: boolean): ReactNode {
    const series = this.data?.series;
    const labels: string[] = Array.isArray(series?.labels) ? series.labels : [];
    if (labels.length < 2) return null;

    // Day-of-month ticks; full dates for 90 days would overlap into noise.
    const ticks = labels.map((day: string, i: number) => (labels.length > 14 && i % Math.ceil(labels.length / 14) !== 0 ? '' : day.slice(8)));

    return (
      <Card className={`px-4 py-3 ${AdminClass.SURFACE}`}>
        <div className="mb-2 flex items-center gap-4">
          <p className="text-[13px] font-semibold flex-1">Opens and downloads per day</p>
          <span className="inline-flex items-center gap-1.5 text-[10px] opacity-60"><span className="h-2 w-2 rounded-full" style={{ background: '#6366f1' }} /> Opens</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] opacity-60"><span className="h-2 w-2 rounded-full" style={{ background: '#10b981' }} /> Downloads</span>
        </div>
        <PluginTrendChart
          xLabels={ticks}
          height={150}
          series={[
            { label: 'Opens', data: series.views, color: '#6366f1' },
            { label: 'Downloads', data: series.downloads, color: '#10b981' },
          ]}
        />
      </Card>
    );
  }

  /** The actionable block, and the reason this screen exists. */
  protected renderNotOpened(dark: boolean): ReactNode {
    const rows: any[] = Array.isArray(this.data?.notOpened) ? this.data.notOpened : [];

    return (
      <Card className={`p-0 overflow-hidden ${AdminClass.SURFACE}`}>
        <div className={`px-4 py-3 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-[13px] font-semibold">Not opened yet</p>
          <p className="mt-0.5 text-[10px] opacity-55">Live links nobody has opened. Not limited to the date range.</p>
        </div>
        {!rows.length ? (
          <p className="px-4 py-4 text-[11px] opacity-55">Everyone has opened what you sent them.</p>
        ) : rows.map((row: any, index: number) => (
          <div key={`${row.email}-${row.shareId}-${index}`} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${index ? `border-t ${dark ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
            <div className="min-w-0">
              <p className="text-[12px] font-medium truncate">{row.email}</p>
              <p className="text-[10px] opacity-55 truncate">
                {this.shareLink(row.shareId, row.shareTitle)}
                {this.formatWhen(row.sentAt) ? ` · sent ${this.formatWhen(row.sentAt)}` : ''}
              </p>
            </div>
            {row.expiresAt ? (
              <Badge variant={BadgeVariant.WARNING} className="text-[10px] flex-shrink-0">
                expires {this.formatWhen(row.expiresAt)}
              </Badge>
            ) : null}
          </div>
        ))}
      </Card>
    );
  }

  protected renderTopFiles(dark: boolean): ReactNode {
    const rows: any[] = Array.isArray(this.data?.topFiles) ? this.data.topFiles : [];
    if (!rows.length) return null;

    return (
      <Card className={`p-0 overflow-hidden ${AdminClass.SURFACE}`}>
        <div className={`px-4 py-3 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-[13px] font-semibold">Most downloaded</p>
        </div>
        {rows.map((row: any) => (
          <div key={row.mediaId} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-[12px] truncate">{row.name || `#${row.mediaId}`}</span>
            <span className="text-[12px] font-semibold tabular-nums flex-shrink-0">{row.downloads}</span>
          </div>
        ))}
      </Card>
    );
  }

  protected renderRefusals(dark: boolean): ReactNode {
    const rows: any[] = Array.isArray(this.data?.refusals) ? this.data.refusals : [];
    if (!rows.length) return null;

    return (
      <Card className={`p-0 overflow-hidden ${AdminClass.SURFACE}`}>
        <div className={`px-4 py-3 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-[13px] font-semibold">Refused</p>
          <p className="mt-0.5 text-[10px] opacity-55">{MediaActivityLabels.REFUSAL_NOTE}</p>
        </div>
        {rows.map((row: any) => (
          <div key={row.outcome} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-[12px]">{MediaActivityLabels.outcome(row.outcome)}</span>
            <span className="text-[12px] font-semibold tabular-nums">{row.count}</span>
          </div>
        ))}
      </Card>
    );
  }

  protected renderEvents(dark: boolean): ReactNode {
    const rows: any[] = Array.isArray(this.data?.events) ? this.data.events : [];

    return (
      <Card className={`p-0 overflow-hidden ${AdminClass.SURFACE}`}>
        <div className={`px-4 py-3 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-[13px] font-semibold">Recent activity</p>
        </div>
        {!rows.length ? (
          <p className="px-4 py-4 text-[11px] opacity-55">Nothing recorded in this range.</p>
        ) : rows.map((row: any) => (
          <div key={row.id} className={`flex items-center justify-between gap-3 px-4 py-2 border-t ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="min-w-0">
              <p className="text-[12px] truncate">
                <span className="opacity-80">{row.email || 'Unknown recipient'}</span>
                <span className="opacity-50"> · {MediaActivityLabels.action(row)}</span>
              </p>
              <p className="text-[10px] opacity-45 truncate">{row.shareId ? this.shareLink(row.shareId, row.shareTitle) : null}</p>
            </div>
            <span className="text-[10px] opacity-45 flex-shrink-0">{this.formatWhen(row.at)}</span>
          </div>
        ))}
        {this.data?.eventsHasMore ? (
          <div className={`flex justify-center px-4 py-2.5 border-t ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            <button type="button" disabled={this.loadingMore} onClick={this.handleMoreEvents}
              className="text-[11px] font-semibold text-indigo-500 hover:underline disabled:opacity-50">
              {this.loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </Card>
    );
  }
}
