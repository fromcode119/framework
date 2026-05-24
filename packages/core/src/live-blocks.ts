import React from 'react';
import { RuntimeConstants } from './runtime-constants';

interface LiveBlocksSnapshot {
  pageId: string | number | null;
  slug: string | null;
  blocks: any[];
}

/**
 * Cross-package "live blocks" bus. Lets the visual editor publish optimistic
 * block patches and lets theme renderers subscribe to them without coupling.
 *
 *   Publisher (CMS plugin):   LiveBlocks.publish({ pageId, slug, blocks })
 *   Consumer  (theme page):   const blocks = LiveBlocks.useLiveBlocks(page) ?? fallback
 *
 * Themes that don't care about live preview simply don't call useLiveBlocks.
 */
export class LiveBlocks {
  static publish(snapshot: LiveBlocksSnapshot): void {
    if (typeof window === 'undefined') return;
    (window as any)[RuntimeConstants.FRONTEND.GLOBAL_KEYS.LIVE_BLOCKS] = snapshot;
    window.dispatchEvent(new Event(RuntimeConstants.FRONTEND.EVENTS.LIVE_BLOCKS_CHANGED));
  }

  static getSnapshot(): LiveBlocksSnapshot | null {
    if (typeof window === 'undefined') return null;
    return ((window as any)[RuntimeConstants.FRONTEND.GLOBAL_KEYS.LIVE_BLOCKS] ?? null) as LiveBlocksSnapshot | null;
  }

  static subscribe(handler: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(RuntimeConstants.FRONTEND.EVENTS.LIVE_BLOCKS_CHANGED, handler);
    return () => window.removeEventListener(RuntimeConstants.FRONTEND.EVENTS.LIVE_BLOCKS_CHANGED, handler);
  }

  /**
   * React hook. Returns the live patched blocks if the editor has published
   * any for this page, otherwise null. Falls back gracefully when the store
   * is empty or the page doesn't match.
   */
  static useLiveBlocks(page: any): any[] | null {
    const subscribe = React.useCallback((onChange: () => void) => LiveBlocks.subscribe(onChange), []);
    const snapshot = React.useSyncExternalStore<LiveBlocksSnapshot | null>(
      subscribe,
      () => LiveBlocks.getSnapshot(),
      () => null,
    );
    return React.useMemo(() => {
      if (!snapshot || !Array.isArray(snapshot.blocks) || snapshot.blocks.length === 0) return null;
      const matches =
        (page?.id != null && snapshot.pageId === page.id) ||
        (page?.documentId != null && snapshot.pageId === page.documentId) ||
        (page?.slug != null && snapshot.slug === page.slug);
      return matches ? snapshot.blocks : null;
    }, [snapshot, page]);
  }
}
