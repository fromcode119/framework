import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { MediaPageClient } from '@/app/media/components/view/page-client.client';

// The Files view of the media area, as its own URL. The view used to live only in component state,
// so a reload or a pasted link always landed on Files and the address bar lied about what was on screen.
export class MediaPage extends PureReactor {
  render(): ReactNode {
    return <MediaPageClient initialView="files" />;
  }
}
