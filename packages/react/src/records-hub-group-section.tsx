import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import { RecordsHubItemRow } from '@react/records-hub-item-row';

/** A titled group of records-hub rows with its count. */
export class RecordsHubGroupSection extends PureReactor {
  @prop declare group: IRecordsHubGroup;
  @prop declare dark: boolean;
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;

  render(): ReactNode {
    const group = this.group;
    const dark = this.dark;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h4 className={`text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{group.group}</h4>
          <span className="text-[11px] font-bold text-slate-400">{group.items.length}</span>
        </div>
        <div className="space-y-1.5">{group.items.map((item) => <RecordsHubItemRow key={`${item.kind}:${item.id}`} item={item} dark={dark} onOpenItem={this.onOpenItem} />)}</div>
      </div>
    );
  }
}
