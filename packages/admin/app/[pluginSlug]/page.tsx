"use client";

import React, { use } from 'react';
import CollectionListPage from '@/components/collection/collection-list-page';

/**
 * Root route for a plugin. 
 * Defaults to showing the collection that matches the plugin slug (primary collection).
 */
export default function PluginRootRoute({ params }: { params: Promise<{ pluginSlug: string }> }) {
  const { pluginSlug } = use(params);
  
  // We wrap the params in a new promise that includes slug = pluginSlug
  const resolvedParams = Promise.resolve({ 
    pluginSlug, 
    slug: pluginSlug 
  });

  return <CollectionListPage params={resolvedParams} />;
}