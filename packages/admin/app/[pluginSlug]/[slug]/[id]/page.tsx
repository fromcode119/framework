"use client";

import React from 'react';
import CollectionEditPage from '@/components/collection/CollectionEditPage';

export default function CollectionEditRoute({ params }: { params: Promise<{ pluginSlug: string; slug: string; id: string }> }) {
  return <CollectionEditPage params={params} />;
}
