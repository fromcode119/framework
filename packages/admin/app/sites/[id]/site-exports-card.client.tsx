import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteRecord } from '@/lib/tenants/site-record';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeMode } from '@fromcode119/core/client';

/**
 * A site's export archives, as links that download.
 *
 * This card used to print one filename and send the operator to Settings → Backups to find it — a
 * "go elsewhere" that made a working feature look broken. The archives were always real; only the
 * card was inert.
 */
export class SiteExportsCard extends PureReactor {
  declare props: Pick<SiteExportsCard, 'site' | 'theme'>;

  @prop declare site: SiteRecord;
  @prop declare theme: ThemeMode;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  /** A size an operator reads, rather than a byte count. */
  private static megabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  render(): ReactNode {
    const exports = this.site.exports;
    return (
      <Card title={`Exports${exports.length ? ` (${exports.length})` : ''}`}>
        <p className="fc-sites__text">
          A portable archive of this site — rows, files, members, plugin and theme choices. Use it to move
          the site to another installation, or to keep a point-in-time copy.
        </p>
        {exports.length === 0 ? (
          <p className="fc-sites__none">Never exported.</p>
        ) : (
          /* A row per archive, with the download as a real button rather than the filename being the
             only clickable thing. It was one naked line of monospace text under a paragraph. */
          <div className={`overflow-hidden divide-y mt-3 ${this.isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {exports.map((entry) => (
              <div key={entry.id} className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${this.isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${this.isDark ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'}`}>
                  <FrameworkIcons.Package size={18} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold tracking-tight truncate ${this.isDark ? 'text-white' : 'text-slate-900'}`}>
                    {new Date(entry.modifiedAt).toLocaleString()}
                  </span>
                  <p className={`text-xs leading-snug truncate font-mono ${this.isDark ? 'text-slate-400' : 'text-slate-500'}`}>{entry.filename}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`text-[11px] tabular-nums ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {SiteExportsCard.megabytes(entry.sizeBytes)}
                  </span>
                  <a href={AdminConstants.ENDPOINTS.SYSTEM.BACKUP_DOWNLOAD(entry.id)} download className="no-underline">
                    <Button size={FieldSize.SM} variant={ButtonVariant.OUTLINE} icon={<FrameworkIcons.Download size={13} />}>Download</Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}
