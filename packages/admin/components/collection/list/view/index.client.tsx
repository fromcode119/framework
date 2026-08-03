import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

import { CollectionListPageClient } from '@/components/collection/list/view/page-client.client';

export class CollectionListPage extends PureReactor {
  @prop declare params: PromiseLike<{ pluginSlug: string; slug: string }>;

  render(): ReactNode {
    return <CollectionListPageClient params={this.params} />;
  }
}
