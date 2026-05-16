"use client";

import React, { use } from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import CollectionEditPage from '@/components/collection/collection-edit-page';
import { Loader } from '@/components/ui/loader';

export default function CollectionEditSubRoute({ params }: { params: Promise<{ pluginSlug: string; slug: string; id: string }> }) {
  const { pluginSlug, slug, id } = use(params);
  const { slots, plugins, isReady } = ContextHooks.usePlugins();

  const editSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}.${slug}.edit`;
  const activePlugin = plugins.find((p: any) => p.slug === pluginSlug);
  const hasEditSlot = !!(slots?.[editSlot] && slots[editSlot].length > 0);
  const hasDeclaredEditSlot = Boolean(
    activePlugin?.admin?.slots?.some((entry: any) => entry?.slot === editSlot),
  );

  if (!isReady) {
    return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
  }

  if (hasEditSlot) {
    return <Slot name={editSlot} props={{ id, pluginSlug, entitySlug: slug }} />;
  }

  if (hasDeclaredEditSlot) {
    return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
  }

  return <CollectionEditPage params={params} />;
}
