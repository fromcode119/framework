import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { NewSitePageClient } from '@/app/sites/new/page.client';

/** New site route. */
export class NewSitePage extends Reactor {
  render(): ReactNode {
    return <NewSitePageClient />;
  }
}
