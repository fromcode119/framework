import type { useRouter } from 'next/navigation';
import type { ThemeHooks } from '@/components/view/use-theme.client';

/** Hook values the {@link CollectionListPageClient} bridge reads and forwards to its view. */
export interface ICollectionListPageValues {
  route: { pluginSlug: string; slug: string };
  router: ReturnType<typeof useRouter>;
  pathname: string | null;
  searchParams: URLSearchParams;
  collections: any;
  settings: any;
  theme: ReturnType<typeof ThemeHooks.useTheme>['theme'];
}
