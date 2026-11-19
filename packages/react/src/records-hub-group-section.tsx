import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import { RecordsHubItemRow } from '@react/records-hub-item-row';

/** A titled group of records-hub rows with its count. */
export class RecordsHubGroupSection extends PureReactor {
  @prop declare group: IRecordsHubGroup;
  @prop declare dark: boolean;
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;
  @prop declare onDownloadItem?: (item: IRecordsHubItem) => void;

  render(): ReactNode {
    const group = this.group;
    const dark = this.dark;
    return (
      <div className="fc-stack">
        <div className="fc-dt-inline">
          <h4 className="fc-heading fc-heading--h3">{group.group}</h4>
          <span className="fc-record-card__count">{group.items.length}</span>
        </div>
        <div className="fc-ext-list">{group.items.map((item) => <RecordsHubItemRow key={`${item.kind}:${item.id}`} item={item} dark={dark} onOpenItem={this.onOpenItem} onDownloadItem={this.onDownloadItem} />)}</div>
      </div>
    );
  }
}
