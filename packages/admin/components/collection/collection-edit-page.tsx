"use client";

import React, { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';

import { ThemeHooks } from '@/components/use-theme';
import { CollectionEditPageView } from './edit/collection-edit-page-view';

/**
 * Thin functional shim: the ONLY place the irreducible Next.js App Router hooks (useRouter/
 * useSearchParams) and framework ContextHooks are read for the edit page. Their values are forwarded
 * as props to the `CollectionEditPageView` class, which owns all state, effects, and handlers.
 */
export default function CollectionEditPage({ params }: { params: Promise<{ pluginSlug: string; slug: string; id: string }> }) {
  const { pluginSlug, slug, id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const collections = ContextHooks.useCollections();
  const settings = ContextHooks.useGlobalSettings();
  const { theme } = ThemeHooks.useTheme();

  return (
    <CollectionEditPageView
      pluginSlug={pluginSlug}
      slug={slug}
      id={id}
      router={router}
      searchParams={new URLSearchParams(searchParams?.toString() || '')}
      collections={collections}
      settings={settings}
      theme={theme}
    />
  );
}
