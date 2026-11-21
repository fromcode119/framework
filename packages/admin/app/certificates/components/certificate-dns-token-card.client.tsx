import type { ChangeEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { Input } from '@/components/ui/view/input.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { NotificationType } from '@/components/enums/notification-type.enum';

/**
 * This SITE's own Cloudflare API token, for DNS-01 and wildcard orders.
 *
 * It exists because a customer's domain lives in the CUSTOMER's Cloudflare account. Proving control
 * of a zone over DNS-01 means writing into it, so the credential has to be theirs — a single
 * platform-wide token would mean either holding DNS-write on every customer's zones, or offering
 * "Automatic (wildcard)" on a host it can never obtain.
 *
 * WHERE THE VALUE COMES FROM IS STATED, always. A site with no token of its own falls back to the
 * platform's, and that is said out loud rather than shown as a blank field that looks unconfigured
 * — an inherited value the operator cannot see the source of is the one thing this admin may never
 * do. The token itself is never shown again once saved; only whether one exists, and whose.
 *
 * A typed token is saved by the page's one save bar; Clear stays a button, because it is an action
 * on what is stored, not a value being edited.
 */
export class CertificateDnsTokenCard extends AdminComponent {
  declare props: Pick<CertificateDnsTokenCard, 'automation' | 'onChanged'>;

  /** `automation` from the certificates read — carries the scope and whether a token resolved. */
  @prop declare automation: Record<string, unknown> | null;
  /** Re-read the page after a change, so the resolved scope shown here stays true. */
  @prop declare onChanged: () => Promise<void> | void;
  @state private tokenInput = '';
  @state private isSaving = false;
  @state private message = '';

  /** A token typed now: nothing typed is nothing to save, so a blank field keeps the stored one. */
  private pending: PendingSave | null = null;

  componentDidMount(): void {
    this.pending = new PendingSave(
      () => this.tokenInput.trim(),
      () => this.save(),
      (value) => { this.tokenInput = value; },
    );
    this.pending.mark();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  private get isConfigured(): boolean {
    return this.automation?.isCloudflareConfigured === true;
  }

  /** True when this site has none of its own and is using the platform's. */
  private get isInherited(): boolean {
    return this.automation?.isCloudflareTokenInherited === true;
  }

  /** True only when the site stores its own — the one case where Clear means anything here. */
  private get hasOwnToken(): boolean {
    return this.isConfigured && !this.isInherited;
  }

  @bound private onToken(event: ChangeEvent<HTMLInputElement>): void {
    this.tokenInput = event.target.value;
  }

  /**
   * Saves whatever is typed. A BLANK FIELD IS NEVER SAVED — the bar only appears once something is
   * typed, so it can never clear the stored token as a side effect. Clearing is what the explicit
   * Clear button is for, and the two must not be reachable by the same gesture.
   */
  private async save(): Promise<void> {
    const token = this.tokenInput.trim();
    if (!token) return;
    const saved = await this.write(token, AdminI18n.t('certificates.savedThisSiteNowUses'));
    if (!saved) this.pending?.failed();
  }

  @bound private async clear(): Promise<void> {
    await this.write('', AdminI18n.t('certificates.removedThisSiteFallsBack'));
  }

  /**
   * The outcome is announced, not just written into the hint line below the field — that line reads
   * almost the same before and after a save, so on its own a save looked like nothing happened. The
   * hosts that had failed on the old token are named, because they are what the operator is fixing.
   */
  private async write(token: string, success: string): Promise<boolean> {
    this.isSaving = true;
    try {
      const result = await CertificatesClient.setCloudflareToken(token);
      this.tokenInput = '';
      const retrying = result.requeuedHosts.length
        ? ` ${AdminI18n.t('certificates.retryingHosts', { hosts: result.requeuedHosts.join(', ') })}`
        : '';
      this.message = success + retrying;
      this.runtime.notify.addNotification({ type: NotificationType.SUCCESS, title: AdminI18n.t('certificates.cloudflareTokenTitle'), message: this.message });
      await this.onChanged();
      return true;
    } catch (error: any) {
      this.message = String(error?.message || AdminI18n.t('certificates.couldNotSaveTheToken'));
      this.runtime.notify.addNotification({ type: NotificationType.ERROR, title: AdminI18n.t('certificates.cloudflareTokenTitle'), message: this.message });
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  /** What is in use right now, named. Never a blank that could be read as "nothing configured". */
  private get provenance(): string {
    if (this.hasOwnToken) return AdminI18n.t('certificates.thisSiteUsesItsOwn');
    if (this.isInherited) {
      return AdminI18n.t('certificates.usingPlatformToken');
    }
    return AdminI18n.t('certificates.noCloudflareTokenAppliesTo');
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('certificates.cloudflareApiToken')}>
        <SettingRow theme={this.theme} title={AdminI18n.t('certificates.thisSiteSToken')} description={<AdminRichText k="certificates.dnsTokenHint" />}>
          <div className="fc-settings-group">
            <Input
              value={this.tokenInput}
              onChange={this.onToken}
              type="password"
              autoComplete="off"
              placeholder={this.hasOwnToken ? AdminI18n.t('certificates.savedLeaveBlankToKeep') : AdminI18n.t('certificates.pasteACloudflareApiToken')}
            />
            {this.hasOwnToken ? (
              <Button variant={ButtonVariant.SECONDARY} onClick={this.clear} isLoading={this.isSaving}>{AdminI18n.t('certificates.clear')}</Button>
            ) : null}
          </div>
        </SettingRow>
        <div className="fc-settings-note fc-settings-note--of-row">
          <Hint variant={this.hasOwnToken && !this.message ? 'success' : 'info'}>{this.message || this.provenance}</Hint>
        </div>
      </Card>
    );
  }
}
