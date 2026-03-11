"use client";

import React, { use, useEffect } from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import CollectionListPage from '@/components/collection/collection-list-page';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionNotFound } from '@/components/collection/collection-not-found';
import { PluginNotFound } from '@/components/plugins/plugin-not-found';
import { Loader } from '@/components/ui/loader';
import { ThemeHooks } from '@/components/use-theme';
import { useRouter } from 'next/navigation';

export default function CollectionListRoute({ params }: { params: Promise<{ pluginSlug: string; slug: string }> }) {
  const { pluginSlug, slug } = use(params);
  const { collections, slots, plugins, isReady } = ContextHooks.usePlugins();
  const { theme } = ThemeHooks.useTheme();
  const router = useRouter();

  // Check if plugin is active
  const isActive = plugins.some((p: any) => p.slug === pluginSlug);

  const collection = AdminCollectionUtils.resolveCollection(collections as any, pluginSlug, slug);
  // Slot name uses hyphen separator to match UI registrations like 'admin.plugin.ecommerce.page.ecommerce-orders'
  const pageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}-${slug}`;
  const hasPageSlot = !!(slots?.[pageSlot] && slots[pageSlot].length > 0);
  const shouldRedirectToPluginSettings = !collection && slug === 'settings';

  useEffect(() => {
    if (!shouldRedirectToPluginSettings) return;
    router.replace(`/plugins/${pluginSlug}?tab=settings`);
  }, [pluginSlug, router, shouldRedirectToPluginSettings]);

  if (!isReady) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader label="Synchronizing Module Context..." />
      </div>
    );
  }

  if (!isActive) {
    return <PluginNotFound pluginSlug={pluginSlug} />;
  }

  if (hasPageSlot) {
    return (
      <Slot
        name={pageSlot}
        fallback={<Slot name={`admin.plugin.${pluginSlug}.content`} />}
      />
    );
  }

  if (!collection) {
    if (shouldRedirectToPluginSettings) {
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return <CollectionNotFound theme={theme === 'dark' ? 'dark' : 'light'} slug={slug} pluginSlug={pluginSlug} />;
  }

  return <CollectionListPage params={params} />;
}
