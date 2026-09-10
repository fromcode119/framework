import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { ImportSitePageClient } from '@/app/sites/import/page.client';

/** Import a site archive route. */
export class ImportSitePage extends Reactor {
  render(): ReactNode {
    return <ImportSitePageClient />;
  }
}
