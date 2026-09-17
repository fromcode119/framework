import { bound } from '@fromcode119/react-class-components';
import { MediaShareController } from '@/app/media/media-share-controller';
import { AdminPathUtils } from '@/lib/admin-path';
import { MediaActivityPanelState } from '@/app/media/components/view/media-activity-panel-state.client';

/**
 * Fetching activity for the current window, and paging further back through it.
 */
export abstract class MediaActivityPanelActions extends MediaActivityPanelState {
  /**
   * Read the current window.
   *
   * A failure has to CLEAR `loading`. Without this the request's rejection escaped and the panel sat
   * on its spinner for ever — which is how a 500 from `/files/activity` read on screen as "still
   * working" rather than as a failure, for as long as the operator was willing to wait.
   */
  protected async load(): Promise<void> {
    this.patch({ loading: true, loadError: '' });
    try {
      const data = await MediaShareController.activity(this.query());
      if (this.mounted) this.patch({ data, loading: false });
    } catch (error: any) {
      if (this.mounted) {
        this.patch({ loading: false, loadError: String(error?.message || 'Activity could not be read.') });
      }
    }
  }

  /** Ask again after a failure. */
  @bound protected async retryLoad(): Promise<void> {
    await this.load();
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
