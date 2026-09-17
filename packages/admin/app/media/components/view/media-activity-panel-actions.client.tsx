import { bound } from '@fromcode119/react-class-components';
import { MediaShareController } from '@/app/media/media-share-controller';
import { AdminPathUtils } from '@/lib/admin-path';
import { MediaActivityPanelState } from '@/app/media/components/view/media-activity-panel-state.client';

/**
 * Fetching activity for the current window, and paging further back through it.
 */
export abstract class MediaActivityPanelActions extends MediaActivityPanelState {
  protected async load(): Promise<void> {
    this.loading = true;
    const data = await MediaShareController.activity(this.query());
    if (this.mounted) this.patch({ data, loading: false });
  }

  /** The next page of the timeline, appended. Same window, same scope — only the offset moves. */
  @bound protected async handleMoreEvents(): Promise<void> {
    this.loadingMore = true;
    try {
      const page = await MediaShareController.activity({ ...this.query(), eventsOffset: (this.data?.events || []).length });
      if (this.mounted && page) {
        this.data = { ...this.data, events: [...(this.data?.events || []), ...(page.events || [])], eventsHasMore: Boolean(page.eventsHasMore) };
      }
    } finally {
      if (this.mounted) this.loadingMore = false;
    }
  }

  /** Back to everything: drop the scope from state AND from the URL, so reload agrees with the screen. */
  @bound protected async handleClearScope(): Promise<void> {
    this.shareId = null;
    window.history.pushState(null, '', AdminPathUtils.toAdminPath('/media/activity'));
    await this.load();
  }

  @bound protected async handleRangeMode(value: string): Promise<void> {
    if (value === 'custom') {
      // Switching to custom only reveals the pickers; nothing reloads until the window is coherent.
      this.rangeMode = 'custom';
      return;
    }
    this.patch({ rangeMode: 'preset', days: Number(value), fromIso: '', toIso: '' });
    await this.load();
  }
}
