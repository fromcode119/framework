"use client";

import React, { use } from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';

/**
 * Nested entity page — e.g. /numerology/profiles/3/readings.
 * Resolves to slot `admin.plugin.<plugin>.page.<plugin>.<slug>.<subSlug>`
 * with `id` passed as a prop. Falls back to "edit" auto-CRUD-like behavior
 * is intentionally NOT supported here; if no slot exists, we render a Loader
 * (manifest declared) or nothing (unknown route).
 */
export default function NestedEntityRoute({ params }: { params: Promise<{ pluginSlug: string; slug: string; id: string; subSlug: string }> }) {
  const { pluginSlug, slug, id, subSlug } = use(params);
  const { slots, plugins, isReady } = ContextHooks.usePlugins();

  const slotName = `admin.plugin.${pluginSlug}.page.${pluginSlug}.${slug}.${subSlug}`;
  const activePlugin = plugins.find((p: any) => p.slug === pluginSlug);
  const hasSlot = !!(slots?.[slotName] && slots[slotName].length > 0);
  const hasDeclaredSlot = Boolean(
    activePlugin?.admin?.slots?.some((entry: any) => entry?.slot === slotName),
  );

  if (!isReady) {
    return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
  }

  if (hasSlot) {
    return <Slot name={slotName} props={{ id, pluginSlug, entitySlug: slug, subSlug }} />;
  }

  if (hasDeclaredSlot) {
    return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
  }

  return (
    <div className="p-8">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 text-sm">
        No slot registered for <code className="font-mono">{slotName}</code>.
      </div>
    </div>
  );
}
