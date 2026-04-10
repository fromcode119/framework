import { unstable_noStore as noStore } from 'next/cache';
import HomeClient from './home-client';
import { HomePageResolver } from './home-page-resolver';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import type { HomePageProps } from './home-page.types';

export async function generateMetadata({ searchParams }: HomePageProps) {
  const { content, resolution } = await HomePageResolver.resolve(searchParams);
  return ResolvedContentMetadata.build((content as Record<string, unknown> | null) || null, resolution?.type);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();
  const { content, forcedLayout } = await HomePageResolver.resolve(searchParams);
  return <HomeClient initialContent={content} forcedLayout={forcedLayout} />;
}
