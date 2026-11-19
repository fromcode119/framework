import type { ChangeEvent, ReactNode } from 'react';
import { state, prop, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Input } from '@/components/ui/view/input.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Label } from '@/components/ui/view/label.client';
import { Hint } from '@/components/ui/view/hint.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { MediaShareController } from '@/app/media/media-share-controller';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Share one or more files with named people, from the files themselves.
 *
 * Sharing lives here rather than on a page of its own because the file is the thing being shared — a
 * separate screen duplicated Media's picker and sent the operator back and forth to mark a file private
 * first. Here, "who can open this?" is answered in the same place the file is.
 *
 * A SHARE is the grouping: several files sent together under one name, to a set of recipients, on one
 * set of terms. "Who has access" is therefore grouped by share rather than listed flat — that is the
 * unit the operator created, and the unit they revoke.
 *
 * Public files are moved to private storage as part of sending, and the dialog says so first: a link to
 * a file that is already world-readable protects nothing.
 */
export class MediaShareDialog extends AdminComponent {
  @prop declare items: IMediaItem[];
  @prop declare onClose: () => void;

  @state private title = '';
  @state private recipients: string[] = [];
  @state private message = '';
  @state private expiryDays: number | string = 30;
  @state private maxDownloads: number | string = 0;
  @state private requireAccount = false;
  @state private busy = false;
  @state private notice = '';
  @state private grants: any[] = [];
  /**
   * Which files are still public, as of NOW. `items` is a snapshot from when the dialog opened, and
   * reading it after a send left the warning claiming files were public when they no longer were.
   */
  @state private publicCount = 0;
  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.patch({
      title: this.defaultTitle,
      publicCount: (this.items || []).filter((item) => String(item.visibility || 'public') !== 'private').length,
    });
    await this.loadGrants();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /** One file names itself; several need a name the operator can edit before sending. */
  private get defaultTitle(): string {
    const items = this.items || [];
    if (items.length === 1) return String(items[0].originalName || items[0].filename || '');
    return `${items.length} files`;
  }

  private async loadGrants(): Promise<void> {
    const grants = await MediaShareController.listGrantsForItems((this.items || []).map((item) => Number(item.id)));
    if (this.mounted) this.grants = grants;
  }

  /** Grants grouped by the share they belong to — the unit the operator created and revokes. */
  private get grantsByShare(): Array<{ shareId: number; shareTitle: string; grants: any[] }> {
    const groups = new Map<number, { shareId: number; shareTitle: string; grants: any[] }>();
    for (const grant of this.grants) {
      const shareId = Number(grant.shareId);
      if (!groups.has(shareId)) groups.set(shareId, { shareId, shareTitle: String(grant.shareTitle || ''), grants: [] });
      groups.get(shareId)?.grants.push(grant);
    }
    return [...groups.values()];
  }

  @bound private async handleSubmit(): Promise<void> {
    this.patch({ busy: true, notice: '' });
    try {
      const result = await MediaShareController.shareFiles({
        items: this.items || [],
        title: this.title.trim() || this.defaultTitle,
        recipients: MediaShareController.normalizeRecipients(this.recipients),
        message: this.message.trim(),
        expiryDays: Number(this.expiryDays) || 0,
        maxDownloads: Number(this.maxDownloads) || 0,
        requireAccount: this.requireAccount,
      });

      if (!this.mounted) return;
      // A failed send is named, never swallowed: the link exists only in that email, so a bounced
      // recipient has access nobody can reach until it is reissued.
      this.patch({
        busy: false,
        recipients: [],
        publicCount: 0,
        notice: result.failedRecipients.length
          ? AdminI18n.t('media.sentExceptTo', { join: result.failedRecipients.join(', ') })
          : AdminI18n.t('media.linksSent'),
      });
      await this.loadGrants();
    } catch (error: any) {
      if (this.mounted) this.patch({ busy: false, notice: String(error?.message || error) });
    }
  }

  @bound private async handleRevokeShare(shareId: number): Promise<void> {
    await MediaShareController.revokeShare(shareId);
    await this.loadGrants();
  }

  @bound private async handleRevokeGrant(grantId: number): Promise<void> {
    await MediaShareController.revokeGrant(grantId);
    await this.loadGrants();
  }

  @bound private handleTitle(e: ChangeEvent<HTMLInputElement>): void { this.title = e.target.value; }
  @bound private handleRecipients(value: string[] | string): void {
    this.recipients = Array.isArray(value) ? value : String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
  }
  @bound private handleMessage(e: ChangeEvent<HTMLInputElement>): void { this.message = e.target.value; }
  @bound private handleExpiry(value: number | string): void { this.expiryDays = value; }
  @bound private handleMaxDownloads(value: number | string): void { this.maxDownloads = value; }
  @bound private handleRequireAccount(checked: boolean): void { this.requireAccount = checked; }

  private grantStatus(grant: any): string {
    if (grant.revokedAt) return AdminI18n.t('media.revoked');
    if (grant.expiresAt && new Date(String(grant.expiresAt)).getTime() <= Date.now()) return AdminI18n.t('media.expired');
    if (grant.maxDownloads > 0 && grant.downloadCount >= grant.maxDownloads) return AdminI18n.t('media.limitReached');
    return grant.lastAccessAt ? AdminI18n.t('media.openedDownloadS', { downloadCount: grant.downloadCount }) : AdminI18n.t('media.notOpenedYet');
  }

  /** Who can open these files, share by share: the unit that was sent and the unit that is taken back. */
  private renderAccess(): ReactNode {
    const groups = this.grantsByShare;
    if (!groups.length) return null;
    return (
      <div className="fc-form-stack">
        <Label>{AdminI18n.t('media.whoHasAccess')}</Label>
        {groups.map((group) => (
          <ListCard key={group.shareId}>
            <ListRow title={<span>{group.shareTitle}</span>} actions={<Button variant={ButtonVariant.SECONDARY} onClick={() => this.handleRevokeShare(group.shareId)}>{AdminI18n.t('media.revokeAll')}</Button>} />
            {group.grants.map((grant: any) => (
              <ListRow key={grant.id} title={<span className="fc-ext-row__plain">{grant.email}</span>} description={this.grantStatus(grant)}
                actions={grant.revokedAt ? undefined : <Button variant={ButtonVariant.GHOST} onClick={() => this.handleRevokeGrant(grant.id)}>{AdminI18n.t('media.revoke')}</Button>} />
            ))}
          </ListCard>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    const items = this.items || [];
    if (!items.length) return null;
    const subtitle = items.length === 1 ? String(items[0].originalName || items[0].filename || '') : AdminI18n.t('media.filesSelected', { length: items.length });

    return (
      <EditSheet isOpen title={AdminI18n.t('media.shareFiles')} subtitle={subtitle} onClose={this.onClose} saving={this.busy}
        foot={<>
          <Button variant={ButtonVariant.SECONDARY} onClick={this.onClose} disabled={this.busy}>{AdminI18n.t('media.close')}</Button>
          <Button variant={ButtonVariant.PRIMARY} onClick={() => void this.handleSubmit()} isLoading={this.busy} disabled={!MediaShareController.normalizeRecipients(this.recipients).length}>
            {items.length > 1 ? AdminI18n.t('media.sendLinks') : AdminI18n.t('media.sendLink')}
          </Button>
        </>}>
        <div className="fc-form-stack">
          {this.publicCount ? (
            <Alert tone="warning">
              {this.publicCount === items.length ? AdminI18n.t('media.theseFilesArePublic') : AdminI18n.t('media.ofTheseFilesArePublic', { publicCount: this.publicCount })}
              {' '}{AdminI18n.t('media.sendingMovesToPrivate')}
            </Alert>
          ) : null}
          <Input label={AdminI18n.t('media.shareName')} value={this.title} onChange={this.handleTitle} disabled={this.busy} />
          <div className="fc-field-stack">
            <Label>{AdminI18n.t('media.sendTo')}</Label>
            {/* Suggests from `people` — which already holds unregistered contacts, backfilled guest
                customers and relatives — while still accepting a typed address. Both, deliberately:
                a picker limited to known people would make sharing with a stranger impossible, and
                that is half the feature. */}
            <TagField
              value={this.recipients}
              onChange={this.handleRecipients}
              placeholder={AdminI18n.t('media.typeAnEmailOrPick')}
              suggestionsLabel={AdminI18n.t('media.people')}
              theme={this.theme}
              allowCreate
              apiOverrides={{ suggest: AdminConstants.ENDPOINTS.SYSTEM.PEOPLE_SUGGEST }}
            />
          </div>
          <Input label={AdminI18n.t('media.message')} placeholder={AdminI18n.t('media.optionalNoteShownInThe')} value={this.message} onChange={this.handleMessage} disabled={this.busy} />
          <div className="fc-form-grid">
            <div className="fc-field-stack">
              <Label>{AdminI18n.t('media.expires')}</Label>
              <NumberStepper value={this.expiryDays} onChange={this.handleExpiry} disabled={this.busy} min={0} />
              {/* 0 = never / unlimited is the one convention across this feature. */}
              <Hint>{AdminI18n.t('media.daysZeroNever')}</Hint>
            </div>
            <div className="fc-field-stack">
              <Label>{AdminI18n.t('media.maxDownloads')}</Label>
              <NumberStepper value={this.maxDownloads} onChange={this.handleMaxDownloads} disabled={this.busy} min={0} />
              <Hint>{AdminI18n.t('media.zeroUnlimited')}</Hint>
            </div>
          </div>
          <Switch
            label={AdminI18n.t('media.requireASignedInAccount')}
            description={AdminI18n.t('media.theRecipientMustBeSigned')}
            checked={this.requireAccount}
            onChange={this.handleRequireAccount}
            disabled={this.busy}
          />
          {this.notice ? <Alert tone="info">{this.notice}</Alert> : null}
          {this.renderAccess()}
        </div>
      </EditSheet>
    );
  }
}
