"use client";

import React from 'react';
import CollectionListPage from '@/components/collection/collection-list-page';

export default function CollectionListRoute({ params }: { params: Promise<{ pluginSlug: string; slug: string }> }) {
  return <CollectionListPage params={params} />;
}
