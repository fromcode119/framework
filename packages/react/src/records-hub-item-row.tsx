import type { ComponentType, ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@react/icons/view/framework-icons.client';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';
import { ViewTranslations } from '@react/view/view-translations';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';

/**
 * One row of the records hub: icon, title/status/badges, trailing label + date, and its actions.
 *
 * A record with a document gets TWO buttons, not one. There used to be a single action that resolved
 * to the download whenever a `downloadUrl` existed, which made the record itself unreachable: an
 * invoice row handed you the PDF and there was no way to open the invoice to edit it.
 */
export class RecordsHubItemRow extends PureReactor {
  @prop declare item: IRecordsHubItem;
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;
  @prop declare onDownloadItem?: (item: IRecordsHubItem) => void;

  /**
   * Resolves a provider-supplied icon name to a component, falling back to
   * FileText for a missing or unknown name. Icons resolve lazily at render time.
   */
  private icon(name?: string): ComponentType<any> {
    const resolved = name && LucideLazyLoader.has(name) ? name : 'FileText';
    return FrameworkIcons.getIcon(resolved);
  }

  // The framework is domain-agnostic: it has NO money concept. It renders the provider's
  // opaque `trailing` label verbatim — the owning plugin decides what it means.
  private trailing(item: IRecordsHubItem): string | null {
    const display = item.trailing == null ? '' : String(item.trailing).trim();
    return display || null;
  }

  private date(value?: string): string {
    if (!value) return '';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms).toISOString().slice(0, 10);
  }

  @bound
  private open(): void {
    this.onOpenItem?.(this.item);
  }

  @bound
  private download(): void {
    this.onDownloadItem?.(this.item);
  }

  render(): ReactNode {
    const item = this.item;
    const Icon = this.icon(item.icon);
    const trailing = this.trailing(item);
    const date = this.date(item.date);
    const OpenIcon = this.icon('ExternalLink');
    const DownloadIcon = this.icon('Download');
    // The console's row of a named thing: icon, name and state, a line under it, a quiet fact, its controls.
    return (
      <div className="fc-ext-row">
        <div className="fc-ext-row__icon"><Icon size={16} /></div>
        <div className="fc-ext-row__text">
          <div className="fc-ext-row__name">
            <span>{item.title}</span>
            {item.status ? <span className="fc-badge fc-badge--neutral">{item.status}</span> : null}
            {(item.badges || []).map((b) => <span key={b} className="fc-badge fc-badge--success">{b}</span>)}
          </div>
          {item.subtitle ? <p className="fc-ext-row__desc" title={item.subtitle}>{item.subtitle}</p> : null}
        </div>
        {trailing || date ? <div className="fc-ext-row__meta" title={[trailing, date].filter(Boolean).join(' · ')}>{[trailing, date].filter(Boolean).join(' · ')}</div> : null}
        {item.downloadUrl || item.href ? (
          <div className="fc-ext-row__actions">
            {item.downloadUrl ? (
              <button type="button" onClick={this.download} className="fc-ext-row__more" aria-label={ViewTranslations.t('view.recordsHub.downloadItem', undefined, { title: item.title })} title={ViewTranslations.t('view.recordsHub.download')}>
                <DownloadIcon size={15} />
              </button>
            ) : null}
            {item.href ? (
              <button type="button" onClick={this.open} className="fc-ext-row__more" aria-label={ViewTranslations.t('view.recordsHub.openItem', undefined, { title: item.title })} title={ViewTranslations.t('view.recordsHub.open')}>
                <OpenIcon size={15} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
}
