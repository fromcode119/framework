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
import { SitesClient } from '@/lib/tenants/sites-client';

/**
 * Who can enter this site, and as what. Grants go to EXISTING accounts by email — identity is
 * global (T1), a site never creates accounts of its own here. Revoking removes the membership only.
 */
export class SiteMembersCard extends AdminComponent {
  @prop declare site: SiteRecord;
  @prop declare onChanged: (site: SiteRecord) => void;

  @state email = '';
  @state asAdmin = true;
  @state busy = false;

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
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Not revoked', message: err?.message || 'The membership could not be revoked.', type: NotificationType.ERROR });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    return (
      <Card title="Members">
        <ul className="fc-sites__members">
          {this.site.members.length === 0 ? <li className="fc-sites__none">Nobody can enter this site yet.</li> : null}
          {this.site.members.map((member) => (
            <li key={member.userId} className="fc-sites__member">
              <span className="fc-sites__member-email">{member.email || `user ${member.userId}`}</span>
              <span className="fc-sites__member-roles">
                {member.roles.length ? member.roles.map((role) => <Badge key={role} variant={role === 'admin' ? BadgeVariant.INFO : BadgeVariant.GRAY}>{role}</Badge>) : <Badge variant={BadgeVariant.GRAY}>member</Badge>}
              </span>
              <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} isLoading={this.busy} onClick={() => this.revoke(member.userId)} icon={<FrameworkIcons.X size={13} />}>Revoke</Button>
            </li>
          ))}
        </ul>
        <div className="fc-sites__grant">
          <Input value={this.email} onChange={this.onEmail} placeholder="email of an existing account" />
          <Switch checked={this.asAdmin} onChange={this.onAsAdmin} label="Site administrator" />
          <Button onClick={this.grant} isLoading={this.busy} icon={<FrameworkIcons.Plus size={14} />}>Grant access</Button>
        </div>
      </Card>
    );
  }
}
