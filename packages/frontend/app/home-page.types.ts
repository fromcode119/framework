import type { ResolvedDocResult } from '@/lib/dynamic-page-resolver.types';

export type SearchParams = Record<string, string | string[] | undefined>;

export type MaybePromise<T> = T | Promise<T>;

export type HomePageProps = {
  searchParams?: MaybePromise<SearchParams>;
};

export type LocaleUrlStrategy = 'query' | 'path' | 'none';

export type HomeTargetResolution = {
  content: unknown;
  forcedLayout: string | null;
  resolution: ResolvedDocResult | null;
};
