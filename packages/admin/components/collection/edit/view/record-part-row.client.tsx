import type { ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One record another plugin holds about this one, drawn as a line of the section it belongs to.
 *
 * Every value is the provider's own and is shown as given: the framework attaches no meaning to the
 * status or to the trailing label.
 */
export class RecordPartRow extends PureReactor {
  @prop declare item: IRecordsHubItem;
  @prop declare onOpen: (item: IRecordsHubItem) => void;
  @prop declare onDownload: (item: IRecordsHubItem) => void;

  /** Left out when the provider's own trailing label already states it — a planned job's label IS its day. */
  private get date(): string {
    const ms = Date.parse(String(this.item.date || ''));
    if (!Number.isFinite(ms)) return '';
    const day = new Date(ms).toISOString().slice(0, 10);
    // Read as the console writes a day ("13.11.2026 г." in Bulgarian), not as the stored ISO string.
    return String(this.item.trailing || '').includes(day) ? '' : new Date(ms).toLocaleDateString(AdminI18n.locale);
  }

  @bound private open(): void { this.onOpen(this.item); }
  @bound private download(): void { this.onDownload(this.item); }

  private renderTitle(): ReactNode {
    const item = this.item;
    if (!item.href) return <span className="fc-record-part__title">{item.title}</span>;
    return <button type="button" onClick={this.open} className="fc-record-part__title fc-record-part__title--link">{item.title}</button>;
  }

  render(): ReactNode {
    const item = this.item;
    const Icon = FrameworkIcons.getIcon(item.icon || 'FileText');
    return (
      <div className="fc-record-part__row">
        <Icon size={15} className="fc-record-part__icon" />
        <div className="fc-record-part__main">
          {this.renderTitle()}
          {item.status ? <span className="fc-record-part__status">{item.status}</span> : null}
          {(item.badges || []).map((badge) => <span key={badge} className="fc-record-part__status">{badge}</span>)}
          {item.subtitle ? <span className="fc-record-part__meta">{item.subtitle}</span> : null}
        </div>
        {this.date ? <span className="fc-record-part__meta tabular-nums">{this.date}</span> : null}
        {item.trailing ? <span className="fc-record-part__trailing">{item.trailing}</span> : null}
        {item.downloadUrl ? (
          <button type="button" onClick={this.download} className="fc-record-part__action" aria-label={AdminI18n.t('collection.edit.recordPart.download', { title: item.title })}>
            <FrameworkIcons.Download size={15} />
          </button>
        ) : null}
      </div>
    );
  }
}
