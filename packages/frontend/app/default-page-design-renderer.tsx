"use client";

import React from 'react';
import { CoreServices } from '@fromcode119/core/client';
import { ContextHooks } from '@fromcode119/react';
import { DefaultPageDesignRendererUtils } from './default-page-design-renderer-utils';

export default function DefaultPageDesignRenderer({ content, entry }: { content?: unknown; entry?: unknown }) {
  const { activeTheme } = ContextHooks.usePlugins();
  const targetKey = DefaultPageDesignRendererUtils.resolvePageTargetKey(entry);

  if (!targetKey) {
    return null;
  }

  const resolved = CoreServices.getInstance().defaultDesignRuntimeBridge.resolvePageTarget(
    targetKey,
    String(activeTheme?.slug || '').trim() || undefined,
  );

  if (resolved.status !== 'resolved' || !resolved.winner) {
    return null;
  }

  const Component = resolved.winner as React.ComponentType<{ content?: unknown; entry?: unknown }>;
  const isRenderableComponent =
    typeof Component === 'function' ||
    typeof Component === 'string' ||
    Boolean((Component as any)?.$$typeof);
  if (!isRenderableComponent) {
    console.warn(`[DefaultPageDesignRenderer] Invalid component for target "${targetKey}". Owner: ${resolved.winnerOwner || 'unknown'}`);
    return null;
  }

  return <Component content={content} entry={entry} />;
}
