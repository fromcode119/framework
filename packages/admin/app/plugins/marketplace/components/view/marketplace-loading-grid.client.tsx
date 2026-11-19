import { Skeleton } from '@/components/ui/view/skeleton.client';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

export class MarketplaceLoadingGrid extends PureReactor {
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    // The shape of the rows that are coming, so the list does not jump when they arrive.
    return (
      <>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="fc-ext-row">
            <Skeleton width={32} height={32} />
            <div className="fc-ext-row__text fc-stack"><Skeleton height={12} width="30%" /><Skeleton height={12} width="60%" /></div>
          </div>
        ))}
      </>
    );
  }
}
