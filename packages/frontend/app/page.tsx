import { unstable_noStore as noStore } from 'next/cache';
import HomeClient from './home-client';
import SsrContentShell from '@/components/ssr-content-shell';
import PageDocPrefetch from '@/components/page-doc-prefetch';
import { HomePageResolver } from './home-page-resolver';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import type { HomePageProps } from './home-page.types';

export async function generateMetadata({ searchParams }: HomePageProps) {
  const { content, resolution } = await HomePageResolver.resolve(searchParams);
  return ResolvedContentMetadata.buildEnriched((content as Record<string, unknown> | null) || null, resolution?.type, '/');
}

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();
  const { content, forcedLayout } = await HomePageResolver.resolve(searchParams);
  return (
    <>
      {/* Static RSC sibling: server-painted above-the-fold shell, hidden by the theme on first paint. */}
      <SsrContentShell content={content} />
      {/* Page-scoped data prefetch (theme.json `fromPage` entries) — body script, pre-theme-boot. */}
      <PageDocPrefetch content={content} />
      <HomeClient initialContent={content} forcedLayout={forcedLayout} />
    </>
  );
}
