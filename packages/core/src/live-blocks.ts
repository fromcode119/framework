import type { ILiveBlocksSnapshot } from '@core/interfaces/live-blocks-snapshot.interface';
import React from 'react';
import { RuntimeConstants } from '@core/constants/runtime.constants';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Cross-package "live blocks" bus. Lets the visual editor publish optimistic
 * block patches and lets theme renderers subscribe to them without coupling.
 *
 *   Publisher (content host): LiveBlocks.publish({ pageId, slug, blocks })
 *   Consumer  (theme page):   const blocks = LiveBlocks.useLiveBlocks(page) ?? fallback
 *
 * Themes that don't care about live preview simply don't call useLiveBlocks.
 */
export class LiveBlocks {
  static publish(snapshot: ILiveBlocksSnapshot): void {
    if (EnvUtils.isServer()) return;
    (window as any)[RuntimeConstants.FRONTEND.GLOBAL_KEYS.LIVE_BLOCKS] = snapshot;
    window.dispatchEvent(new Event(RuntimeConstants.FRONTEND.EVENTS.LIVE_BLOCKS_CHANGED));
  }

  static getSnapshot(): ILiveBlocksSnapshot | null {
    if (EnvUtils.isServer()) return null;
    return ((window as any)[RuntimeConstants.FRONTEND.GLOBAL_KEYS.LIVE_BLOCKS] ?? null) as ILiveBlocksSnapshot | null;
  }

  static subscribe(handler: () => void): () => void {
    if (EnvUtils.isServer()) return () => {};
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
    const snapshot = React.useSyncExternalStore<ILiveBlocksSnapshot | null>(
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
