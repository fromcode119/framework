import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { MediaPageClient } from '@/app/media/components/view/page-client.client';
import { SiteRequiredNotice } from '@/components/view/site-required-notice.client';

// Next.js App Router route page — client component, so a reactor class is valid here.
export class MediaPage extends PureReactor {
  render(): ReactNode {
    return <SiteRequiredNotice subject="media"><MediaPageClient /></SiteRequiredNotice>;
  }
}
