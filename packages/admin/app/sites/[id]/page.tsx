import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { SiteDetailPageClient } from '@/app/sites/[id]/page.client';

/** Site detail route. */
export class SiteDetailPage extends Reactor {
  render(): ReactNode {
    return <SiteDetailPageClient />;
  }
}
