import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { MediaPageClient } from '@/app/media/components/view/page-client.client';

// Next.js App Router route page — client component, so a reactor class is valid here.
export class MediaPage extends PureReactor {
  render(): ReactNode {
    return <MediaPageClient />;
  }
}
