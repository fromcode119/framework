import { use } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';
import { Bridge, prop } from '@fromcode119/reactor';

import { ThemeHooks } from '@/components/view/use-theme.client';
import { CollectionEditPageView } from '@/components/collection/edit/view/collection-edit-page-view.client';
import type { ICollectionEditPageValues } from '@/components/collection/interfaces/collection-edit-page-values.interface';

/**
 * Hook→class bridge: the ONLY place the irreducible Next.js App Router hooks (useRouter/
 * useSearchParams) and framework ContextHooks are read for the edit page. Their values are forwarded
 * as props to the `CollectionEditPageView` class, which owns all state, effects, and handlers.
 */
export class CollectionEditPage extends Bridge<ICollectionEditPageValues> {
  @prop declare params: Promise<{ pluginSlug: string; slug: string; id: string }>;

  protected read(): ICollectionEditPageValues {
    return {
      route: use(this.params),
      router: useRouter(),
      searchParams: new URLSearchParams(useSearchParams()?.toString() || ''),
      collections: ContextHooks.useCollections(),
      settings: ContextHooks.useGlobalSettings(),
      theme: ThemeHooks.useTheme().theme,
    };
  }

  protected present(values: ICollectionEditPageValues): ReactNode {
    const { route, router, searchParams, collections, settings, theme } = values;
    return (
      <CollectionEditPageView
        pluginSlug={route.pluginSlug}
        slug={route.slug}
        id={route.id}
        router={router}
        searchParams={searchParams}
        collections={collections}
        settings={settings}
        theme={theme}
      />
    );
  }
}
