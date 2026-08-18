import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { prop, state } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { MediaShareController } from '@/app/media/media-share-controller';

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

  private renderStat(label: string, value: number): ReactNode {
    return (
      <div key={label} className="min-w-0">
        <p className="text-[15px] font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-[10px] uppercase tracking-widest opacity-50 truncate">{label}</p>
      </div>
    );
  }

  /** One recipient's whole story on one line: opens, downloads, when they were last there. */
  private renderRecipient(row: any, dark: boolean, index: number): ReactNode {
    const parts: string[] = [];
    if (row.views > 0) parts.push(`${row.views} open${row.views === 1 ? '' : 's'}`);
    if (row.downloads > 0) parts.push(`${row.downloads} download${row.downloads === 1 ? '' : 's'}`);
    if (row.refused > 0) parts.push(`${row.refused} refused`);
    const summary = parts.length ? parts.join(' · ') : 'Not opened yet';

    return (
      <div key={row.grantId} className={`flex items-center justify-between gap-3 px-4 py-2 ${index ? `border-t ${dark ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
        <div className="min-w-0">
          <p className="text-[12px] font-medium truncate">{row.email}</p>
          <p className="text-[10px] opacity-55">{summary}</p>
        </div>
        {row.lastAt ? (
          <span className="text-[10px] opacity-45 flex-shrink-0">last {this.formatWhen(row.lastAt)}</span>
        ) : (
          <Badge variant={BadgeVariant.GRAY} className="text-[10px] flex-shrink-0">no activity</Badge>
        )}
      </div>
    );
  }

  render(): ReactNode {
    if (this.loading) return <p className="px-4 py-3 text-[11px] opacity-60">Loading activity…</p>;

    const dark = this.theme === ThemeMode.DARK;
    const recipients: any[] = Array.isArray(this.data?.recipients) ? this.data.recipients : [];

    return (
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {this.renderStat('Recipients', Number(this.data?.recipientCount || 0))}
          {this.renderStat('Page opens', Number(this.data?.viewCount || 0))}
          {this.renderStat('Downloads', Number(this.data?.downloadCount || 0))}
          {this.renderStat('Refused', Number(this.data?.refusedCount || 0))}
        </div>
        {recipients.length ? (
          <div className={`rounded-xl border ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            {recipients.map((row, index) => this.renderRecipient(row, dark, index))}
          </div>
        ) : null}
      </div>
    );
  }
}
