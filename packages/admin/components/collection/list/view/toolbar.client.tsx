import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

import { BulkActions } from '@/components/collection/list/view/bulk-actions.client';
import { FilterBar } from '@/components/collection/list/view/filter-bar.client';

export class CollectionListToolbar extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare filterBarProps: Record<string, any>;
  @prop declare bulkActionsProps: Record<string, any>;

  render(): ReactNode {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <FilterBar {...this.filterBarProps} />
        </div>
        <BulkActions theme={this.theme} {...this.bulkActionsProps} />
      </div>
    );
  }
}
