import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

import { BulkActions } from '@/components/collection/list/view/bulk-actions.client';
import { FilterBar } from '@/components/collection/list/view/filter-bar.client';

export class CollectionListToolbar extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare filterBarProps: Record<string, any>;
  @prop declare bulkActionsProps: Record<string, any>;

  render(): ReactNode {
    // The toolbar is a BAND of the card, inset like the head and the foot — 16px above and below,
    // 24px at the sides (measured off the reference). It used to be flush to the card's edges, so the
    // search sat hard against the frame while the title above it kept the 24px inset.
    return (
      <div className="fc-list-toolbar-band space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <FilterBar {...this.filterBarProps} />
        </div>
        <BulkActions theme={this.theme} {...this.bulkActionsProps} />
      </div>
    );
  }
}
