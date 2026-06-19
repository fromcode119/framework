"use client";

import React, { use } from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';

/**
 * Nested entity page — e.g. /numerology/profiles/3/readings, /mlm/affiliates/3/hub.
 * Resolves to slot `admin.plugin.<plugin>.page.<plugin>.<slug>.<subSlug>` with `id`
 * passed as a prop.
 *
 * IMPORTANT: this ALWAYS renders the `<Slot>` (with a Loader fallback) instead of
 * returning a standalone `<Loader>` while `!isReady` and then swapping to `<Slot>`.
 * That swap changed the root element type (div → Slot), so React tore down the loader
 * subtree and mounted the slot child FRESH the moment `isReady` flipped true — a visible
 * flash on every nested plugin page. Keeping the Slot as the stable root (keyed by slot
 * name) mounts the page exactly once. (The standard collection route never flashed for
 * the same reason — it never swapped its root.)
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

  // Only once the registry is ready AND the slot is genuinely absent do we show the
  // "not registered" notice. While loading, the Slot below renders its Loader fallback.
  if (isReady && !hasSlot && !hasDeclaredSlot) {
    return (
      <div className="p-8">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 text-sm">
          No slot registered for <code className="font-mono">{slotName}</code>.
        </div>
      </div>
    );
  }

  const loader = <div className="flex-1 flex items-center justify-center"><Loader /></div>;
  return (
    <Slot
      key={slotName}
      name={slotName}
      props={{ id, pluginSlug, entitySlug: slug, subSlug }}
      fallback={loader}
    />
  );
}
