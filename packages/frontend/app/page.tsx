import { unstable_noStore as noStore } from 'next/cache';
import HomeClient from './home-client';
import { HomePageResolver } from './home-page-resolver';
import type { HomePageProps } from './home-page.types';

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();
  const { content, forcedLayout } = await HomePageResolver.resolve(searchParams);
  return <HomeClient initialContent={content} forcedLayout={forcedLayout} />;
}
