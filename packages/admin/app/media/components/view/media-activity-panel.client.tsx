import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { Loader } from '@/components/ui/view/loader.client';
import { MediaActivityPanelSections } from '@/app/media/components/view/media-activity-panel-sections.client';

/**
 * Media activity — who opened what, and what was refused.
 *
 * The top of the chain: the lifecycle and the panel's frame. The window, the fetches and the sections
 * live in the links below — see `MediaActivityPanelState`.
 */
export class MediaActivityPanel extends MediaActivityPanelSections {
  componentDidMount(): void {
    this.mounted = true;
    const fromUrl = Number(new URLSearchParams(window.location.search).get('share'));
    if (Number.isFinite(fromUrl) && fromUrl > 0) this.shareId = fromUrl;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          {this.shareId ? (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <FrameworkIcons.Activity size={13} className="opacity-60" />
              <span className="font-semibold">{String(this.data?.shareTitle || `Share #${this.shareId}`)}</span>
              <button type="button" onClick={this.handleClearScope} className="text-indigo-500 hover:underline">
                show all shares
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-[11px] opacity-60">
              <FrameworkIcons.Activity size={13} /> Everything sent, across all shares
            </span>
          )}
          {this.renderRange(dark)}
        </div>

        {this.loadError ? (
          <LoadErrorPanel
            title="Activity could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.loading}
          />
        ) : this.loading ? <Loader /> : (
          <>
            {this.renderTotals()}
            {this.renderTrend(dark)}
            {this.renderNotOpened(dark)}
            {this.renderTopFiles(dark)}
            {this.renderRefusals(dark)}
            {this.renderEvents(dark)}
          </>
        )}
      </div>
    );
  }
}
