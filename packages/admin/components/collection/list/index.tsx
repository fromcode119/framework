"use client";

import React from 'react';

import { CollectionListPageClient } from './page-client';

export default function CollectionListPage({
  params
}: {
  params: Promise<{ pluginSlug: string; slug: string }>;
}) {
  return <CollectionListPageClient params={params} />;
}
