import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { SitesPageClient } from '@/app/sites/page.client';

/** Sites (tenants) route — platform admins only. */
export class SitesPage extends Reactor {
  render(): ReactNode {
    return <SitesPageClient />;
  }
}
