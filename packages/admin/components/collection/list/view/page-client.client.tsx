import { use } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';
import { Bridge, prop } from '@fromcode119/reactor';

import { ThemeHooks } from '@/components/view/use-theme.client';
import { CollectionListPageView } from '@/components/collection/list/view/collection-list-page-view.client';
import type { ICollectionListPageValues } from '@/components/collection/list/interfaces/collection-list-page-values.interface';

/**
 * Hook→class bridge: the ONLY place the irreducible Next.js App Router hooks
 * (useRouter/usePathname/useSearchParams) and framework ContextHooks are read. Their values are
 * forwarded as props to the `CollectionListPageView` class, which owns all state and lifecycle.
 */
export class CollectionListPageClient extends Bridge<ICollectionListPageValues> {
  @prop declare params: PromiseLike<{ pluginSlug: string; slug: string }>;

  protected read(): ICollectionListPageValues {
    return {
      route: use(this.params),
      router: useRouter(),
      pathname: usePathname(),
      searchParams: new URLSearchParams(useSearchParams()?.toString() || ''),
      collections: ContextHooks.useCollections(),
      settings: ContextHooks.useGlobalSettings(),
      theme: ThemeHooks.useTheme().theme,
    };
  }

  protected present(values: ICollectionListPageValues): ReactNode {
    const { route, router, pathname, searchParams, collections, settings, theme } = values;
    return (
      <CollectionListPageView
        pluginSlug={route.pluginSlug}
        slug={route.slug}
        router={router}
        pathname={pathname}
        searchParams={searchParams}
        collections={collections}
        settings={settings}
        theme={theme}
      />
    );
  }
}
