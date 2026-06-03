export interface CollectionListRouteProps {
  params: Promise<{ pluginSlug: string; slug: string }>;
}

export interface CollectionListRouteState {
  pluginSlug: string;
  slug: string;
  resolved: boolean;
}
