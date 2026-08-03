import type { ICollectionListPageViewModel } from '@/components/collection/list/interfaces/collection-list-page-view-model.interface';

export interface IBuildPageClientPropsArgs {
  pluginSlug: string;
  slug: string;
  state: ICollectionListPageViewModel;
}
