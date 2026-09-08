import type { ChangeEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteMember } from '@/lib/tenants/site-member';
import { SiteGrantDialog } from '@/app/sites/[id]/site-grant-dialog.client';
import { ThemeMode } from '@fromcode119/core/client';
import { SitesClient } from '@/lib/tenants/sites-client';

/**
 * Who can enter this site, and as what. Grants go to EXISTING accounts by email — identity is
 * global (T1), a site never creates accounts of its own here. Revoking removes the membership only.
 */
export class SiteMembersCard extends AdminComponent {
  @prop declare site: SiteRecord;
  @prop declare onChanged: (site: SiteRecord) => void;

  /** One page at a time: a site's membership is unbounded, and this used to render all of it. */
  private static readonly PAGE = 25;

  /** The avatar letter. An account with no email is one that no longer exists, so it gets a dash. */
  private static initial(email: string): string {
    return email ? email.charAt(0).toUpperCase() : '—';
  }

  @state granting = false;
  @state busy = false;
  @state members: SiteMember[] = [];
  @state total = 0;
  @state offset = 0;
  @state search = '';
  @state loading = true;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  componentDidMount(): void {
    void this.loadPage();
  }

  private async loadPage(): Promise<void> {
    this.loading = true;
    try {
      const page = await SitesClient.members(this.site.id, {
        q: this.search.trim() || undefined,
        limit: SiteMembersCard.PAGE,
        offset: this.offset,
      });
      this.members = page.members;
      this.total = page.total;
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Members unavailable', message: err?.message || 'The member list could not be loaded.', type: NotificationType.ERROR });
    } finally {
      this.loading = false;
    }
  }

  @bound onSearch(e: ChangeEvent<HTMLInputElement>): void {
    this.search = e.target.value;
    this.offset = 0;
    void this.loadPage();
  }

  @bound prevPage(): void {
    this.offset = Math.max(this.offset - SiteMembersCard.PAGE, 0);
    void this.loadPage();
  }

  @bound nextPage(): void {
    if (this.offset + SiteMembersCard.PAGE >= this.total) return;
    this.offset += SiteMembersCard.PAGE;
    void this.loadPage();
  }

  @bound openGrant(): void {
    this.granting = true;
  }

  @bound closeGrant(): void {
    this.granting = false;
  }

  @bound
  async grant(email: string, asAdmin: boolean): Promise<void> {
    this.busy = true;
    try {
      this.onChanged(await SitesClient.addMember(this.site.id, email, asAdmin ? ['admin'] : []));
      this.granting = false;
      await this.loadPage();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Not granted', message: err?.message || 'The membership could not be granted.', type: NotificationType.ERROR });
    } finally {
      this.busy = false;
    }
  }

  private async revoke(userId: string): Promise<void> {
    this.busy = true;
    try {
      this.onChanged(await SitesClient.removeMember(this.site.id, userId));
      await this.loadPage();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Not revoked', message: err?.message || 'The membership could not be revoked.', type: NotificationType.ERROR });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    return (
      <Card title={`Members${this.total ? ` (${this.total})` : ''}`}>
        {/* The action lives at the top, as an action. A permanent form under the list read as a third
            row of pagination and left an empty form open on a page nobody came to fill one in. */}
        <div className="fc-sites__card-action">
          <Button size={FieldSize.SM} onClick={this.openGrant} icon={<FrameworkIcons.Plus size={13} />}>Grant access</Button>
        </div>
        {this.total > SiteMembersCard.PAGE || this.search ? (
          <Input value={this.search} onChange={this.onSearch} placeholder="search by email" />
        ) : null}
        {/* Same row shape as the Access list and the Installed Plugins page: an avatar, the person,
            then their roles and the action. Bare lines of text with no divider read as a data dump.
            Dividers only — NOT a second `.fc-surface`. Nested, a surface keeps the card border and the
            same `--card` background as the card it sits in, so in light theme one member rendered as an
            empty white rectangle framed inside another white rectangle. A list inside a card needs
            separators, not a frame of its own. */}
        <div className={`overflow-hidden divide-y mt-3 ${this.isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
          {this.loading ? <p className="fc-sites__none px-3 py-4">Loading members…</p> : null}
          {!this.loading && this.members.length === 0
            ? <p className="fc-sites__none px-3 py-4">{this.search ? 'No member matches that email.' : 'Nobody can enter this site yet.'}</p>
            : null}
          {this.members.map((member) => (
            <div key={member.userId} className={`group flex items-center gap-3 px-3 py-2 transition-colors ${this.isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
              <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${this.isDark ? 'bg-slate-800 text-slate-300 ring-1 ring-white/10' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
                {SiteMembersCard.initial(member.email)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-semibold tracking-tight truncate ${this.isDark ? 'text-white' : 'text-slate-900'}`}>
                  {member.email || <em className="font-normal text-slate-500">deleted account (id {member.userId})</em>}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {member.roles.length
                  ? member.roles.map((role) => <Badge key={role} variant={role === 'admin' ? BadgeVariant.INFO : BadgeVariant.GRAY}>{role}</Badge>)
                  : <Badge variant={BadgeVariant.GRAY}>member</Badge>}
                <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} isLoading={this.busy} onClick={() => this.revoke(member.userId)} icon={<FrameworkIcons.X size={13} />}>Revoke</Button>
              </div>
            </div>
          ))}
        </div>
        {/* A compact cluster, not `space-between` across the card: spread edge to edge the two controls
            ended up a hand's width apart with the count stranded between them. Outlined, because ghost
            buttons at that size read as plain text and "Next" was easy to miss entirely. */}
        {this.total > SiteMembersCard.PAGE ? (
          <div className="fc-sites__paging">
            <span className="fc-sites__paging-label">
              {this.offset + 1}–{Math.min(this.offset + SiteMembersCard.PAGE, this.total)} of {this.total}
            </span>
            <Button size={FieldSize.SM} variant={ButtonVariant.OUTLINE} disabled={this.offset === 0} onClick={this.prevPage}>Previous</Button>
            <Button size={FieldSize.SM} variant={ButtonVariant.OUTLINE} disabled={this.offset + SiteMembersCard.PAGE >= this.total} onClick={this.nextPage}>Next</Button>
          </div>
        ) : null}
        <SiteGrantDialog
          isOpen={this.granting}
          onClose={this.closeGrant}
          onConfirm={this.grant}
          isLoading={this.busy}
        />
      </Card>
    );
  }
}
