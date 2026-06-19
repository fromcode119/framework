"use client";

import React, { use } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';

import { ThemeHooks } from '@/components/use-theme';
import { CollectionListPageView } from './collection-list-page-view';

/**
 * Thin functional shim: the ONLY place the irreducible Next.js App Router hooks
 * (useRouter/usePathname/useSearchParams) and framework ContextHooks are read. Their values are
 * forwarded as props to the `CollectionListPageView` class, which owns all state and lifecycle.
 */
export function CollectionListPageClient({
  params
}: {
  params: Promise<{ pluginSlug: string; slug: string }>;
}) {
  const { pluginSlug, slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const collections = ContextHooks.useCollections();
  const settings = ContextHooks.useGlobalSettings();
  const { theme } = ThemeHooks.useTheme();

  return (
    <CollectionListPageView
      pluginSlug={pluginSlug}
      slug={slug}
      router={router}
      pathname={pathname}
      searchParams={new URLSearchParams(searchParams?.toString() || '')}
      collections={collections}
      settings={settings}
      theme={theme}
    />
  );
}
