import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { Platform, state, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { MediaShareController } from '@/app/media/media-share-controller';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';

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
  /**
   * Collapses the compose form once something has been sent.
   *
   * After a successful send the job is done: leaving the full form expanded — with a greyed-out Send
   * button, because the recipients were just cleared — reads as a broken screen rather than a finished
   * one. The access list becomes the subject, and composing again is one click away.
   */
  @state private composing = true;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    if (Platform.isBrowser) document.body.style.overflow = 'hidden';
    this.patch({
      title: this.defaultTitle,
      publicCount: (this.items || []).filter((item) => String(item.visibility || 'public') !== 'private').length,
    });
    await this.loadGrants();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
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

  @bound private async handleSubmit(e?: FormEvent): Promise<void> {
    e?.preventDefault();
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
        composing: false,
        notice: result.failedRecipients.length
          ? `Sent, except to: ${result.failedRecipients.join(', ')}`
          : 'Links sent.',
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

  @bound private handleCompose(): void { this.composing = true; }

  @bound private handleTitle(e: ChangeEvent<HTMLInputElement>): void { this.title = e.target.value; }
  @bound private handleRecipients(value: string[] | string): void {
    this.recipients = Array.isArray(value) ? value : String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
  }
  @bound private handleMessage(e: ChangeEvent<HTMLInputElement>): void { this.message = e.target.value; }
  @bound private handleExpiry(value: number | string): void { this.expiryDays = value; }
  @bound private handleMaxDownloads(value: number | string): void { this.maxDownloads = value; }
  @bound private handleRequireAccount(checked: boolean): void { this.requireAccount = checked; }

  private grantStatus(grant: any): string {
    if (grant.revokedAt) return 'Revoked';
    if (grant.expiresAt && new Date(String(grant.expiresAt)).getTime() <= Date.now()) return 'Expired';
    if (grant.maxDownloads > 0 && grant.downloadCount >= grant.maxDownloads) return 'Limit reached';
    return grant.lastAccessAt ? `Opened · ${grant.downloadCount} download(s)` : 'Not opened yet';
  }

  private renderAccess(dark: boolean, labelClass: string): ReactNode {
    const groups = this.grantsByShare;
    if (!groups.length) return null;

    return (
      <div className={`mt-6 pt-6 border-t ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
        <p className={labelClass}>Who has access</p>
        {groups.map((group) => (
          <div key={group.shareId} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[11px] font-semibold truncate ${dark ? 'text-white' : 'text-slate-900'}`}>{group.shareTitle}</p>
              <Button variant={ButtonVariant.GHOST} onClick={() => this.handleRevokeShare(group.shareId)}>Revoke all</Button>
            </div>
            {group.grants.map((grant: any) => (
              <div key={grant.id} className="flex items-center justify-between gap-3 py-1.5 pl-3">
                <div className="min-w-0">
                  <p className={`text-[11px] truncate ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{grant.email}</p>
                  <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{this.grantStatus(grant)}</p>
                </div>
                {grant.revokedAt ? null : (
                  <Button variant={ButtonVariant.GHOST} onClick={() => this.handleRevokeGrant(grant.id)}>Revoke</Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    const items = this.items || [];
    if (!items.length) return null;

    const dark = this.theme === ThemeMode.DARK;
    const labelClass = `block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`;
    const hintClass = `mt-1 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`;
    const subtitle = items.length === 1 ? String(items[0].originalName || items[0].filename || '') : `${items.length} files selected`;

    return (
      <RootFramework>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={this.onClose} />

          <div className={`relative w-full max-w-md my-auto rounded-xl border shadow-2xl p-6 max-h-[calc(100vh-3rem)] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
            dark ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
          }`}>
            <div className="flex items-start gap-3 mb-5">
              <div className={`p-3 rounded-xl flex-shrink-0 ${dark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.Share size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Share Files</h3>
                <p className={`mt-1 text-sm leading-relaxed truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`} title={subtitle}>{subtitle}</p>
              </div>
              <button onClick={this.onClose} className={`p-1 rounded-lg transition-colors ${dark ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}>
                <FrameworkIcons.Close size={20} />
              </button>
            </div>

            {this.publicCount ? (
              <div className={`mb-6 rounded-xl border p-3 text-[11px] leading-relaxed ${dark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {this.publicCount === items.length ? 'These files are public.' : `${this.publicCount} of these files are public.`}
                {' '}Sending will move them to private storage so the link becomes the only way in. Anyone
                who already has a current URL keeps whatever they downloaded.
              </div>
            ) : null}

            <form onSubmit={this.handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Share name</label>
                <Input type="text" value={this.title} onChange={this.handleTitle} disabled={this.busy} className="w-full" />
              </div>
              <div>
                <label className={labelClass}>Send to</label>
                {/* Suggests from `people` — which already holds unregistered contacts, backfilled guest
                    customers and relatives — while still accepting a typed address. Both, deliberately:
                    a picker limited to known people would make sharing with a stranger impossible, and
                    that is half the feature. */}
                <TagField
                  value={this.recipients}
                  onChange={this.handleRecipients}
                  placeholder="Type an email, or pick someone"
                  suggestionsLabel="People"
                  theme={this.theme}
                  allowCreate
                  apiOverrides={{ suggest: AdminConstants.ENDPOINTS.SYSTEM.PEOPLE_SUGGEST }}
                />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <Input type="text" placeholder="Optional note shown in the email…" value={this.message} onChange={this.handleMessage} disabled={this.busy} className="w-full" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Expires</label>
                  <NumberStepper value={this.expiryDays} onChange={this.handleExpiry} disabled={this.busy} min={0} />
                  {/* 0 = never / unlimited is the one convention across this feature; as a hint under
                      the field it cannot push the two columns out of alignment. */}
                  <p className={hintClass}>days · 0 = never</p>
                </div>
                <div>
                  <label className={labelClass}>Max downloads</label>
                  <NumberStepper value={this.maxDownloads} onChange={this.handleMaxDownloads} disabled={this.busy} min={0} />
                  <p className={hintClass}>0 = unlimited</p>
                </div>
              </div>

              <Switch
                label="Require a signed-in account"
                description="The recipient must be signed in with the address this was sent to."
                checked={this.requireAccount}
                onChange={this.handleRequireAccount}
                disabled={this.busy}
              />

              {this.notice ? <p className={`text-[11px] ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{this.notice}</p> : null}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button variant={ButtonVariant.GHOST} className="flex-1" onClick={this.onClose} type="button" disabled={this.busy}>Close</Button>
                <Button variant={ButtonVariant.PRIMARY} className="flex-1" type="submit" isLoading={this.busy} disabled={!MediaShareController.normalizeRecipients(this.recipients).length}>
                  Send link{items.length > 1 ? 's' : ''}
                </Button>
              </div>
            </form>

            {this.renderAccess(dark, labelClass)}
          </div>
        </div>
      </RootFramework>
    );
  }
}
