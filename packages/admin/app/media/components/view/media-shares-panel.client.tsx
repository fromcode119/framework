import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Loader } from '@/components/ui/view/loader.client';
import { MediaShareController } from '@/app/media/media-share-controller';
import { MediaShareEditForm } from '@/app/media/components/view/media-share-edit-form.client';
import { MediaShareActivity } from '@/app/media/components/view/media-share-activity.client';
import { MediaShareFiles } from '@/app/media/components/view/media-share-files.client';

/**
 * Everything that has been sent out, as a whole.
 *
 * The share dialog answers "who can open THIS file". It cannot answer "what did we send, and to whom" —
 * an operator wanting to withdraw something a month later has no file in mind, only a memory of sending
 * it.
 *
 * Two things the first version got wrong and this fixes: a row said "2 files" and nothing about WHICH
 * files, which is the one thing the screen exists to show; and it drew its own near-invisible border
 * instead of using `Card` + the admin surface class, so the rows barely separated from the page.
 */
export class MediaSharesPanel extends AdminComponent {
  @state private loading = true;
  @state private shares: any[] = [];
  @state private hasMore = false;
  @state private loadingMore = false;
  @state private grantsByShare: Record<number, any[]> = {};
  @state private expandedId: number | null = null;
  @state private busyId: number | null = null;

  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
    this.expandFromUrl();
  }

  /**
   * `?share=<id>` opens that share expanded — it is what every share link on the Activity screen
   * points at, so "who is this about" lands on the controls for exactly that send.
   */
  private expandFromUrl(): void {
    const shareId = Number(new URLSearchParams(window.location.search).get('share'));
    if (!Number.isFinite(shareId) || shareId <= 0) return;
    void this.handleToggle(shareId);
    void this.loadUntilVisible(shareId);
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    const page = await MediaShareController.listShares(0);
    if (this.mounted) this.patch({ shares: page.shares, hasMore: page.hasMore, loading: false });
  }

  /** The next page, appended — the list grows, it never jumps. */
  @bound private async handleLoadMore(): Promise<void> {
    this.loadingMore = true;
    try {
      const page = await MediaShareController.listShares(this.shares.length);
      if (this.mounted) this.patch({ shares: [...this.shares, ...page.shares], hasMore: page.hasMore });
    } finally {
      if (this.mounted) this.loadingMore = false;
    }
  }

  /**
   * A deep link may point past the first page — keep paging until the share appears, bounded so a
   * deleted share cannot turn the panel into an infinite loader.
   */
  private async loadUntilVisible(shareId: number): Promise<void> {
    for (let guard = 0; guard < 25 && this.mounted; guard += 1) {
      if (this.shares.some((share: any) => Number(share.id) === shareId)) return;
      if (!this.hasMore) return;
      await this.handleLoadMore();
    }
  }

  @bound private async handleToggle(shareId: number): Promise<void> {
    if (this.expandedId === shareId) {
      this.expandedId = null;
      return;
    }

    this.expandedId = shareId;
    if (this.grantsByShare[shareId]) return;

    const grants = await MediaShareController.listGrants(shareId);
    if (this.mounted) this.grantsByShare = { ...this.grantsByShare, [shareId]: grants };
  }

  @bound private async handleRevokeShare(shareId: number): Promise<void> {
    this.busyId = shareId;
    try {
      await MediaShareController.revokeShare(shareId);
      const [page, grants] = await Promise.all([
        MediaShareController.listShares(0, Math.max(20, this.shares.length)),
        MediaShareController.listGrants(shareId),
      ]);
      if (this.mounted) this.patch({ shares: page.shares, hasMore: page.hasMore, grantsByShare: { ...this.grantsByShare, [shareId]: grants } });
    } finally {
      if (this.mounted) this.busyId = null;
    }
  }

  @bound private async handleRevokeGrant(grantId: number, shareId: number): Promise<void> {
    await MediaShareController.revokeGrant(grantId);
    const [page, grants] = await Promise.all([
      MediaShareController.listShares(0, Math.max(20, this.shares.length)),
      MediaShareController.listGrants(shareId),
    ]);
    if (this.mounted) this.patch({ shares: page.shares, hasMore: page.hasMore, grantsByShare: { ...this.grantsByShare, [shareId]: grants } });
  }

  /** A date the operator can read, or nothing — never a placeholder that looks like a value. */
  private formatDate(value: unknown): string {
    if (!value) return '';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  }

  private grantStatus(grant: any): string {
    if (grant.revokedAt) return 'Revoked';
    if (grant.expiresAt && new Date(String(grant.expiresAt)).getTime() <= Date.now()) return 'Expired';
    if (grant.maxDownloads > 0 && grant.downloadCount >= grant.maxDownloads) return 'Limit reached';
    return grant.lastAccessAt ? `Opened · ${grant.downloadCount} download(s)` : 'Not opened yet';
  }

  private renderGrants(shareId: number): ReactNode {
    const grants = this.grantsByShare[shareId];
    if (!grants) return <p className="px-4 py-3 text-[11px] opacity-60">Loading…</p>;
    if (!grants.length) return <p className="px-4 py-3 text-[11px] opacity-60">No recipients.</p>;

    return grants.map((grant: any) => (
      <div key={grant.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[12px] font-medium truncate">{grant.email}</p>
          <p className="text-[10px] opacity-55">
            {this.grantStatus(grant)}
            {this.formatDate(grant.expiresAt) ? ` · expires ${this.formatDate(grant.expiresAt)}` : ''}
          </p>
        </div>
        {grant.revokedAt ? (
          <Badge variant={BadgeVariant.GRAY} className="text-[10px]">Revoked</Badge>
        ) : (
          <Button variant={ButtonVariant.GHOST} onClick={() => this.handleRevokeGrant(grant.id, shareId)}>Revoke</Button>
        )}
      </div>
    ));
  }

  /**
   * Everything about ONE share, once it is opened: what it has done, who holds it, and the controls to
   * change its terms. Three questions an operator asks together, so they are not three screens.
   */
  private renderExpanded(shareId: number, dark: boolean): ReactNode {
    const divider = dark ? 'border-slate-800' : 'border-slate-100';
    return (
      <div className={`border-t ${divider}`}>
        <MediaShareActivity shareId={shareId} />
        <div className={`border-t ${divider}`}>{this.renderGrants(shareId)}</div>
        <div className={`border-t ${divider}`}>
          <MediaShareEditForm shareId={shareId} onChanged={() => void this.refresh(shareId)} />
        </div>
      </div>
    );
  }

  /** Re-reads the loaded window and this share's grants, so an edit is reflected without a reload. */
  private async refresh(shareId: number): Promise<void> {
    const [page, grants] = await Promise.all([
      MediaShareController.listShares(0, Math.max(20, this.shares.length)),
      MediaShareController.listGrants(shareId),
    ]);
    if (this.mounted) this.patch({ shares: page.shares, hasMore: page.hasMore, grantsByShare: { ...this.grantsByShare, [shareId]: grants } });
  }

  render(): ReactNode {
    if (this.loading) return <Loader />;

    const dark = this.theme === ThemeMode.DARK;

    if (!this.shares.length) {
      return (
        <Card className={`px-6 py-12 text-center ${AdminClass.SURFACE}`}>
          <FrameworkIcons.Share size={28} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-semibold">Nothing shared yet</p>
          <p className="mt-1 text-[11px] opacity-60">
            Select files in the library and choose Share to send them to someone.
          </p>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {this.shares.map((share: any) => (
          <Card key={share.id} className={`p-0 overflow-hidden ${AdminClass.SURFACE}`}>
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <button type="button" className="text-left min-w-0 flex-1" onClick={() => this.handleToggle(share.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold truncate">{share.title}</span>
                  {share.activeCount === 0 ? (
                    <Badge variant={BadgeVariant.GRAY} className="text-[10px]">All revoked</Badge>
                  ) : (
                    <Badge variant={BadgeVariant.SUCCESS} className="text-[10px]">
                      {share.activeCount} active
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] opacity-55">
                  {share.recipientCount} recipient(s)
                  {this.formatDate(share.createdAt) ? ` · ${this.formatDate(share.createdAt)}` : ''}
                </p>
                <MediaShareFiles files={share.files} />
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* This send's own analytics: the Activity screen scoped to it — graph, refusals, timeline. */}
                <Button
                  as="a"
                  href={AdminPathUtils.toAdminPath(`/media/activity?share=${share.id}`)}
                  variant={ButtonVariant.GHOST}
                  icon={<FrameworkIcons.Activity size={13} />}
                >
                  Activity
                </Button>
                <Button
                  variant={ButtonVariant.GHOST}
                  disabled={this.busyId === share.id || share.activeCount === 0}
                  onClick={() => this.handleRevokeShare(share.id)}
                >
                  {this.busyId === share.id ? 'Revoking…' : 'Revoke all'}
                </Button>
              </div>
            </div>

            {this.expandedId === share.id ? this.renderExpanded(share.id, dark) : null}
          </Card>
        ))}
        {this.hasMore ? (
          <div className="flex justify-center pt-1">
            <Button variant={ButtonVariant.SECONDARY} disabled={this.loadingMore} onClick={this.handleLoadMore}>
              {this.loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
}
