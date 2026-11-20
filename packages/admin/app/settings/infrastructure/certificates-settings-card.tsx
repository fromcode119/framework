import { RecordCard } from '@/components/ui/view/record-card.client';
import { Text } from '@/components/ui/view/text.client';
import { Hint } from '@/components/ui/view/hint.client';
import { Label } from '@/components/ui/view/label.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { AcmeDirectory, ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { CertificatesClient } from '@/lib/certificates/certificates-client';
import { Input } from '@/components/ui/view/input.client';
import { PlatformAddressSuggestion } from '@/app/settings/infrastructure/platform-address-suggestion.client';
import { Select } from '@/components/ui/view/select.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * What the platform needs before it can obtain a certificate on its own.
 *
 * BOTH REQUIRED FIELDS ARE BLANK BY DEFAULT AND BLANK MEANS OFF. Neither can be guessed: an
 * authority the platform would start placing orders with, and the address customers are told to
 * point DNS at. The addresses are OFFERED — resolved from the platform's own hostnames and shown
 * with their source — but only ever stored once somebody accepts them.
 */
export class CertificatesSettingsCard extends AdminComponent {
  @state private directory = '';
  @state private contactEmail = '';
  @state private addresses = '';
  @state private candidates: Array<{ host: string; ipv4: string[]; ipv6: string[] }> = [];
  @state private isSaving = false;
  @state private isLoaded = false;
  /** Never the token itself — only whether one is currently saved. */
  @state private isCloudflareConfigured = false;
  @state private cloudflareTokenInput = '';
  @state private isSavingCloudflareToken = false;
  @state private cloudflareTokenMessage = '';

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;
  /** A token typed now: nothing typed is nothing to save, so a blank field keeps the stored one. */
  private pendingToken: PendingSave | null = null;

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
    this.pendingToken?.dispose();
  }

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ directory: this.directory, contactEmail: this.contactEmail, addresses: this.addresses }),
      () => this.save(),
      (values) => { this.directory = values.directory; this.contactEmail = values.contactEmail; this.addresses = values.addresses; },
    );
    this.pendingToken = new PendingSave(
      () => this.cloudflareTokenInput.trim(),
      () => this.saveCloudflareToken(),
      (value) => { this.cloudflareTokenInput = value; },
    );
    this.pendingToken.mark();
    const settings = await AdminSystemSettingsClient.getAll().catch(() => ({} as Record<string, any>));
    this.directory = String(settings?.certificate_acme_directory ?? '');
    this.contactEmail = String(settings?.certificate_acme_contact_email ?? '');
    this.addresses = String(settings?.certificate_platform_addresses ?? '');
    this.isLoaded = true;
    this.pending?.mark();
    this.candidates = await CertificatesClient.detectPlatformAddresses();
    const automation = (await CertificatesClient.list().catch(() => null))?.automation;
    this.isCloudflareConfigured = automation?.isCloudflareConfigured === true;
  }

  @bound private onDirectory(value: string): void { this.directory = value; }
  @bound private onContact(e: ChangeEvent<HTMLInputElement>): void { this.contactEmail = e.target.value; }
  @bound private onAddresses(e: ChangeEvent<HTMLTextAreaElement>): void { this.addresses = e.target.value; }
  @bound private applyDetected(addresses: string): void { this.addresses = addresses; }
  @bound private onCloudflareToken(e: ChangeEvent<HTMLInputElement>): void { this.cloudflareTokenInput = e.target.value; }

  /**
   * Saves whatever is typed. A BLANK FIELD IS A NO-OP — leaving it empty and pressing Save must
   * keep the currently saved token, never clear it as a side effect; the explicit Clear button
   * below is the only control that removes a saved token, matching the masked-secret pattern
   * elsewhere in this admin (plugin settings' password fields: blank means "keep the current
   * secret").
   */
  @bound private async saveCloudflareToken(): Promise<void> {
    const token = this.cloudflareTokenInput.trim();
    if (!token) return;

    this.isSavingCloudflareToken = true;
    this.cloudflareTokenMessage = '';
    try {
      const result = await CertificatesClient.setCloudflareToken(token);
      this.isCloudflareConfigured = result.isCloudflareConfigured;
      this.cloudflareTokenInput = '';
      this.cloudflareTokenMessage = AdminI18n.t('settings.infrastructure.savedDns01WildcardCertificates');
    } catch (err: any) {
      this.pendingToken?.failed();
      this.cloudflareTokenMessage = err?.message || AdminI18n.t('settings.infrastructure.couldNotSaveTheCloudflare');
    } finally {
      this.isSavingCloudflareToken = false;
    }
  }

  /** The only control that actually clears a saved token. */
  @bound private async clearCloudflareToken(): Promise<void> {
    this.isSavingCloudflareToken = true;
    this.cloudflareTokenMessage = '';
    try {
      const result = await CertificatesClient.setCloudflareToken('');
      this.isCloudflareConfigured = result.isCloudflareConfigured;
      this.cloudflareTokenInput = '';
      this.cloudflareTokenMessage = AdminI18n.t('settings.infrastructure.clearedDns01WildcardIssuance');
    } catch (err: any) {
      this.cloudflareTokenMessage = err?.message || AdminI18n.t('settings.infrastructure.couldNotClearTheCloudflare');
    } finally {
      this.isSavingCloudflareToken = false;
    }
  }

  private get options(): Array<{ label: string; value: string }> {
    return [{ value: '', label: AdminI18n.t('settings.infrastructure.notSetAutomaticCertificatesAre') }, ...AcmeDirectory.options()];
  }

  @bound private async save(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSaving = true;
    try {
      await AdminSystemSettingsClient.update({
        certificate_acme_directory: this.directory.trim(),
        certificate_acme_contact_email: this.contactEmail.trim(),
        certificate_platform_addresses: this.addresses.trim(),
      });
      addNotification({
        title: AdminI18n.t('settings.infrastructure.saved'),
        message: this.directory.trim() && this.addresses.trim()
          ? AdminI18n.t('settings.infrastructure.thePlatformCanNowObtain')
          : AdminI18n.t('settings.infrastructure.automaticCertificatesStayOffUntil'),
        type: 'info' as any,
      });
    } catch (err: any) {
      this.pending?.failed();
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.couldNotSaveTheCertificate'), type: 'error' as any });
    } finally {
      this.isSaving = false;
    }
  }

  render(): ReactNode {
    if (!this.isLoaded) return null;
    return (
      <RecordCard title={AdminI18n.t('settings.infrastructure.certificates')}>
        <div className="fc-form-stack">
          <Text size="small" muted as="p">{AdminI18n.t('settings.infrastructure.leaveTheseBlankAndThe')}</Text>

          <div className="fc-form-grid">
            <div className="fc-form-stack">
              <div className="fc-field-stack">
                <Select label={AdminI18n.t('settings.infrastructure.certificateAuthority')} value={this.directory} onChange={this.onDirectory} options={this.options} theme={this.theme} />
                <Hint>{AdminI18n.t('settings.infrastructure.pickTheStagingAuthorityTo')}</Hint>
              </div>
              <div className="fc-field-stack">
                <Input label={AdminI18n.t('settings.infrastructure.contactEmailForTheAuthority')} value={this.contactEmail} onChange={this.onContact} placeholder="ssl@example.com" />
                <Hint>{AdminI18n.t('settings.infrastructure.optionalUsedForAccountNotices')}</Hint>
              </div>
            </div>
            <div className="fc-field-stack">
              <Label>{AdminI18n.t('settings.infrastructure.publicAddressesOfThisPlatform')}</Label>
              <PlatformAddressSuggestion candidates={this.candidates} onUse={this.applyDetected} />
              <TextArea value={this.addresses} onChange={this.onAddresses} placeholder={'203.0.113.10'} />
              <Hint>{AdminI18n.t('settings.infrastructure.onePerLineTheseAre')}</Hint>
            </div>
          </div>

          <div className="fc-form-foot">
            <div className="fc-form-grid">
              <div className="fc-field-stack">
                <Input
                  label={AdminI18n.t('settings.infrastructure.cloudflareApiTokenDns01')}
                  value={this.cloudflareTokenInput}
                  onChange={this.onCloudflareToken}
                  type="password"
                  autoComplete="off"
                  placeholder={this.isCloudflareConfigured ? AdminI18n.t('settings.infrastructure.savedLeaveBlankToKeep') : AdminI18n.t('settings.infrastructure.pasteACloudflareApiToken')}
                />
                <Hint variant={this.isCloudflareConfigured && !this.cloudflareTokenMessage ? 'success' : 'info'}>
                  {this.cloudflareTokenMessage || (this.isCloudflareConfigured ? AdminI18n.t('settings.infrastructure.aTokenIsSaved') : AdminI18n.t('settings.infrastructure.noTokenIsSavedWildcard'))}
                </Hint>
                {this.isCloudflareConfigured ? (
                  <div><Button variant={ButtonVariant.SECONDARY} onClick={this.clearCloudflareToken} isLoading={this.isSavingCloudflareToken}>{AdminI18n.t('settings.infrastructure.clear')}</Button></div>
                ) : null}
              </div>
              <Text size="small" muted as="p"><AdminRichText k="settings.infrastructure.dnsTokenHint" /></Text>
            </div>
          </div>
        </div>
      </RecordCard>
    );
  }
}
