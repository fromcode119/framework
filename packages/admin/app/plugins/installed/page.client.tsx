import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { InstalledPluginsPageClient } from '@/app/plugins/installed/components/view/page-client.client';

// Next.js App Router route page — client component, so a reactor class is valid here.
export class InstalledPluginsPage extends PureReactor {
  render(): ReactNode {
    return <InstalledPluginsPageClient />;
  }
}
