import type { useRouter } from 'next/navigation';
import type { ThemeHooks } from '@/components/view/use-theme.client';

/** Hook values the {@link CollectionEditPage} bridge reads and forwards to its view. */
export interface ICollectionEditPageValues {
  route: { pluginSlug: string; slug: string; id: string };
  router: ReturnType<typeof useRouter>;
  searchParams: URLSearchParams;
  collections: any;
  settings: any;
  theme: ReturnType<typeof ThemeHooks.useTheme>['theme'];
}
