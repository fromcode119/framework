import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Label } from '@/components/ui/view/label.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Loader } from '@/components/ui/view/loader.client';
import { MediaShareController } from '@/app/media/media-share-controller';
import { MediaShareEditForm } from '@/app/media/components/view/media-share-edit-form.client';
import { MediaShareActivity } from '@/app/media/components/view/media-share-activity.client';
import { MediaShareFiles } from '@/app/media/components/view/media-share-files.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  @bound private closeShare(): void {
    this.expandedId = null;
  }

  /** The share whose panel is open, or null. */
  private get openedShare(): any {
    return this.shares.find((share: any) => Number(share.id) === this.expandedId) ?? null;
  }

  @bound private async handleToggle(shareId: number): Promise<void> {
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
    if (grant.revokedAt) return AdminI18n.t('media.revoked');
    if (grant.expiresAt && new Date(String(grant.expiresAt)).getTime() <= Date.now()) return AdminI18n.t('media.expired');
    if (grant.maxDownloads > 0 && grant.downloadCount >= grant.maxDownloads) return AdminI18n.t('media.limitReached');
    return grant.lastAccessAt ? AdminI18n.t('media.openedDownloadS', { downloadCount: grant.downloadCount }) : AdminI18n.t('media.notOpenedYet');
  }

  private renderGrants(shareId: number): ReactNode {
    const grants = this.grantsByShare[shareId];
    if (!grants) return <Loader label={AdminI18n.t('media.loading')} />;
    if (!grants.length) return <EmptyState inline title={AdminI18n.t('media.noRecipients')} />;

    return (
      <ListCard>
        {grants.map((grant: any) => (
          <ListRow key={grant.id} title={<span className="fc-ext-row__plain">{grant.email}</span>}
            description={`${this.grantStatus(grant)}${this.formatDate(grant.expiresAt) ? ` · ${AdminI18n.t('media.expiresAt', { when: this.formatDate(grant.expiresAt) })}` : ''}`}
            actions={grant.revokedAt
              ? <Badge variant={BadgeVariant.GRAY}>{AdminI18n.t('media.revoked')}</Badge>
              : <Button variant={ButtonVariant.GHOST} onClick={() => this.handleRevokeGrant(grant.id, shareId)}>{AdminI18n.t('media.revoke')}</Button>} />
        ))}
      </ListCard>
    );
  }

  /**
   * Everything about ONE share, once it is opened: which files, what it has done, who holds it, and
   * the controls to change its terms. Questions an operator asks together, so they are not three screens.
   */
  private renderOpened(share: any): ReactNode {
    const shareId = Number(share.id);
    return (
      <div className="fc-form-stack">
        <MediaShareFiles files={share.files} />
        <MediaShareActivity shareId={shareId} />
        <div className="fc-field-stack">
          <Label>{AdminI18n.t('media.whoHasAccess')}</Label>
          {this.renderGrants(shareId)}
        </div>
        <MediaShareEditForm shareId={shareId} onChanged={() => void this.refresh(shareId)} />
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

  private fileNames(share: any): string {
    return (Array.isArray(share.files) ? share.files : []).map((file: any) => String(file.name || '')).filter(Boolean).join(', ');
  }

  render(): ReactNode {
    if (this.loading) return <Loader />;

    if (!this.shares.length) {
      return <ListCard empty={<EmptyState icon={<FrameworkIcons.Share size={18} />} title={AdminI18n.t('media.nothingSharedYet')} hint={AdminI18n.t('media.selectFilesInTheLibrary')} />} />;
    }

    const opened = this.openedShare;
    return (
      <div className="fc-columns__stack">
        <ListCard>
          {this.shares.map((share: any) => (
            <ListRow
              key={share.id}
              icon={<FrameworkIcons.Share size={16} />}
              title={<button type="button" className="fc-ext-row__link" onClick={() => void this.handleToggle(share.id)}>{share.title}</button>}
              badges={share.activeCount === 0
                ? <Badge variant={BadgeVariant.GRAY}>{AdminI18n.t('media.allRevoked')}</Badge>
                : <Badge variant={BadgeVariant.SUCCESS}>{AdminI18n.t('media.activeCount', { count: share.activeCount })}</Badge>}
              description={[AdminI18n.t('media.recipientCount', { count: share.recipientCount }), this.formatDate(share.createdAt), this.fileNames(share)].filter(Boolean).join(' · ')}
              descriptionTitle={this.fileNames(share)}
              menu={[
                // This send's own analytics: the Activity screen scoped to it — graph, refusals, timeline.
                { label: AdminI18n.t('media.activity'), icon: <FrameworkIcons.Activity size={15} />, onClick: () => this.router.push(AdminPathUtils.toAdminPath(`/media/activity?share=${share.id}`)) },
                ...(share.activeCount === 0 || this.busyId === share.id ? [] : [{ label: AdminI18n.t('media.revokeAll'), icon: <FrameworkIcons.Close size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => void this.handleRevokeShare(share.id) }]),
              ]}
            />
          ))}
        </ListCard>
        {/* One share, opened over the list: a row opens its own panel. */}
        <EditSheet
          isOpen={Boolean(opened)}
          title={String(opened?.title ?? AdminI18n.t('media.share'))}
          onClose={this.closeShare}
          foot={<Button variant={ButtonVariant.SECONDARY} onClick={this.closeShare}>{AdminI18n.t('common.close')}</Button>}
        >
          {opened ? this.renderOpened(opened) : null}
        </EditSheet>
        {this.hasMore ? (
          <div><Button variant={ButtonVariant.SECONDARY} isLoading={this.loadingMore} onClick={this.handleLoadMore}>{AdminI18n.t('media.loadMore')}</Button></div>
        ) : null}
      </div>
    );
  }
}
