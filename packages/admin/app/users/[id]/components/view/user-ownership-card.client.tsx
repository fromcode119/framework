import type { ReactElement } from 'react';
import { prop, state, bound } from '@fromcode119/reactor';
import { ThemeMode } from '@fromcode119/core/client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';

/**
 * Hands the platform owner seat to the account being viewed.
 *
 * Renders NOTHING unless the signed-in account actually holds the seat and is looking at someone else:
 * a control that cannot act is a bug, not a hint. It also states the consequence before the click,
 * because the person pressing it is demoting themselves.
 */
export class UserOwnershipCard extends AdminComponent {
  declare props: Pick<UserOwnershipCard, 'user' | 'onTransferred'>;

  @prop declare user: any;
  @prop declare onTransferred: () => void;

  @state confirming = false;
  @state transferring = false;

  /** The seat, not the role: only its current holder may pass it on. */
  private get viewerIsOwner(): boolean {
    return this.auth.user?.platformAdmin === true;
  }

  private get targetIsOwner(): boolean {
    return this.user?.isPlatformAdmin === true;
  }

  private get targetName(): string {
    return this.user?.email || `user ${this.user?.id}`;
  }

  @bound private startConfirm(): void {
    this.confirming = true;
  }

  @bound private cancel(): void {
    this.confirming = false;
  }

  @bound private async transfer(): Promise<void> {
    this.transferring = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_OWNERSHIP(this.user.id), {});
      this.runtime.notify.notify(
        NotificationType.SUCCESS,
        'Ownership transferred',
        `${this.targetName} now owns the platform. You remain an admin.`,
      );
      this.confirming = false;
      this.onTransferred?.();
    } catch (error: any) {
      this.runtime.notify.notify(
        NotificationType.ERROR,
        'Transfer failed',
        error?.message || 'Ownership could not be transferred.',
      );
    } finally {
      this.transferring = false;
    }
  }

  render(): ReactElement | null {
    if (this.targetIsOwner) return this.renderCurrentOwner();
    if (!this.viewerIsOwner) return null;

    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card title="Platform Ownership" icon={<FrameworkIcons.Key size={18} className="text-amber-500" />}>
        <p className={`text-sm py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          You own this platform. Handing ownership to {this.targetName} makes them the owner and leaves
          you an admin — they can hand it back, and an owner can never be deleted.
        </p>
        {this.confirming ? (
          <div className="flex items-center gap-3 pt-4">
            <Button variant={ButtonVariant.PRIMARY} onClick={this.transfer} disabled={this.transferring}>
              {this.transferring ? 'Transferring…' : `Yes, make ${this.targetName} the owner`}
            </Button>
            <Button variant={ButtonVariant.GHOST} onClick={this.cancel} disabled={this.transferring}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="pt-4">
            <Button variant={ButtonVariant.GHOST} onClick={this.startConfirm}>Transfer ownership</Button>
          </div>
        )}
      </Card>
    );
  }

  private renderCurrentOwner(): ReactElement {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card title="Platform Ownership" icon={<FrameworkIcons.Key size={18} className="text-amber-500" />}>
        <p className={`text-sm py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          This account owns the platform. It cannot be deleted, and only it can hand ownership to
          someone else.
        </p>
      </Card>
    );
  }
}
