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
import { Switch } from '@/components/ui/view/switch.client';
import { Input } from '@/components/ui/view/input.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteMember } from '@/lib/tenants/site-member';
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

  @state email = '';
  @state asAdmin = true;
  @state busy = false;
  @state members: SiteMember[] = [];
  @state total = 0;
  @state offset = 0;
  @state search = '';
  @state loading = true;

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

  @bound onEmail(e: ChangeEvent<HTMLInputElement>): void {
    this.email = e.target.value;
  }

  @bound onAsAdmin(checked: boolean): void {
    this.asAdmin = checked;
  }

  @bound
  async grant(): Promise<void> {
    if (!this.email.trim()) return;
    this.busy = true;
    try {
      this.onChanged(await SitesClient.addMember(this.site.id, this.email.trim(), this.asAdmin ? ['admin'] : []));
      this.email = '';
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
        {this.total > SiteMembersCard.PAGE || this.search ? (
          <Input value={this.search} onChange={this.onSearch} placeholder="search by email" />
        ) : null}
        <ul className="fc-sites__members">
          {this.loading ? <li className="fc-sites__none">Loading members…</li> : null}
          {!this.loading && this.members.length === 0
            ? <li className="fc-sites__none">{this.search ? 'No member matches that email.' : 'Nobody can enter this site yet.'}</li>
            : null}
          {this.members.map((member) => (
            <li key={member.userId} className="fc-sites__member">
              {/* An empty email means the membership points at an account that no longer exists — the
                  join found no user row. `user 6` read like a name; this says what it is, and leaves
                  Revoke as the way to clear it, because deleting rows nobody asked to delete is not
                  this page's business. */}
              <span className="fc-sites__member-email">
                {member.email || <em>deleted account (id {member.userId})</em>}
              </span>
              <span className="fc-sites__member-roles">
                {member.roles.length ? member.roles.map((role) => <Badge key={role} variant={role === 'admin' ? BadgeVariant.INFO : BadgeVariant.GRAY}>{role}</Badge>) : <Badge variant={BadgeVariant.GRAY}>member</Badge>}
              </span>
              <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} isLoading={this.busy} onClick={() => this.revoke(member.userId)} icon={<FrameworkIcons.X size={13} />}>Revoke</Button>
            </li>
          ))}
        </ul>
        {this.total > SiteMembersCard.PAGE ? (
          <div className="fc-sites__paging">
            <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} disabled={this.offset === 0} onClick={this.prevPage}>Previous</Button>
            <span className="fc-sites__paging-label">
              {this.offset + 1}–{Math.min(this.offset + SiteMembersCard.PAGE, this.total)} of {this.total}
            </span>
            <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} disabled={this.offset + SiteMembersCard.PAGE >= this.total} onClick={this.nextPage}>Next</Button>
          </div>
        ) : null}
        <div className="fc-sites__grant">
          <Input value={this.email} onChange={this.onEmail} placeholder="email of an existing account" />
          <Switch checked={this.asAdmin} onChange={this.onAsAdmin} label="Site administrator" />
          <Button onClick={this.grant} isLoading={this.busy} icon={<FrameworkIcons.Plus size={14} />}>Grant access</Button>
        </div>
      </Card>
    );
  }
}
