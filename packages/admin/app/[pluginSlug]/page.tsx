"use client";

import React, { use } from 'react';
import { Slot, usePlugins } from '@fromcode119/react';
import CollectionListPage from '../../components/collection/collection-list-page';
import { resolveCollection } from '../../lib/collection-utils';
import { PluginNotFound } from '../../components/plugins/plugin-not-found';
import { Loader } from '../../components/ui/loader';

/**
 * Root route for a plugin. 
 * Defaults to showing the collection that matches the plugin slug (primary collection).
 */
export default function PluginRootRoute({ params }: { params: Promise<{ pluginSlug: string }> }) {
  const { pluginSlug } = use(params);
  const { collections, slots, plugins, isReady } = usePlugins();
  
  // Check if plugin is active
  const isActive = plugins.some((p: any) => p.slug === pluginSlug);

  const collection = resolveCollection(collections as any, pluginSlug, pluginSlug);
  const pageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}`;
  const hasPageSlot = !!(slots?.[pageSlot] && slots[pageSlot].length > 0);

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

  if (hasPageSlot || !collection) {
    return (
      <Slot
        name={pageSlot}
        fallback={<Slot name={`admin.plugin.${pluginSlug}.content`} />}
      />
    );
  }

  const resolvedParams = Promise.resolve({
    pluginSlug,
    slug: pluginSlug
  });
  return <CollectionListPage params={resolvedParams} />;
}
