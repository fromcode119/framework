import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { AcmeDirectory, ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { PlatformAddressSuggestion } from '@/app/settings/infrastructure/platform-address-suggestion.client';
import { Select } from '@/components/ui/view/select.client';
import { TextArea } from '@/components/ui/view/text-area.client';

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

  async componentDidMount(): Promise<void> {
    const settings = await AdminSystemSettingsClient.getAll().catch(() => ({} as Record<string, any>));
    this.directory = String(settings?.certificate_acme_directory ?? '');
    this.contactEmail = String(settings?.certificate_acme_contact_email ?? '');
    this.addresses = String(settings?.certificate_platform_addresses ?? '');
    this.isLoaded = true;
    this.candidates = await CertificatesClient.detectPlatformAddresses();
    const automation = (await CertificatesClient.list().catch(() => null))?.automation;
    this.isCloudflareConfigured = automation?.isCloudflareConfigured === true;
  }

  @bound private onDirectory(value: string): void { this.directory = value; }
  @bound private onContact(e: ChangeEvent<HTMLInputElement>): void { this.contactEmail = e.target.value; }
  @bound private onAddresses(e: ChangeEvent<HTMLTextAreaElement>): void { this.addresses = e.target.value; }
  @bound private useDetected(addresses: string): void { this.addresses = addresses; }
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
      this.cloudflareTokenMessage = 'Saved. DNS-01/wildcard certificates can now be ordered.';
    } catch (err: any) {
      this.cloudflareTokenMessage = err?.message || 'Could not save the Cloudflare token.';
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
      this.cloudflareTokenMessage = 'Cleared. DNS-01/wildcard issuance is off until a token is saved again.';
    } catch (err: any) {
      this.cloudflareTokenMessage = err?.message || 'Could not clear the Cloudflare token.';
    } finally {
      this.isSavingCloudflareToken = false;
    }
  }

  private get options(): Array<{ label: string; value: string }> {
    return [{ value: '', label: 'Not set — automatic certificates are off' }, ...AcmeDirectory.options()];
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
        title: 'Saved',
        message: this.directory.trim() && this.addresses.trim()
          ? 'The platform can now obtain certificates for hosts set to Automatic.'
          : 'Automatic certificates stay off until both an authority and a platform address are set.',
        type: 'info' as any,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Could not save the certificate settings.', type: 'error' as any });
    } finally {
      this.isSaving = false;
    }
  }

  render(): ReactNode {
    if (!this.isLoaded) return null;
    const dark = this.theme === ThemeMode.DARK;
    const label = `block text-xs font-semibold mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`;
    const help = `mt-1.5 text-[11px] leading-snug ${dark ? 'text-slate-500' : 'text-slate-400'}`;

    return (
      <Card title="Certificates">
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Leave these blank and the platform never obtains a certificate itself — hosts keep whatever was uploaded.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className={label}>Certificate authority</label>
            <Select value={this.directory} onChange={this.onDirectory} options={this.options} theme={this.theme} />
            <p className={help}>
              Pick the staging authority to test the whole flow without spending a production rate limit.
              Its certificates are not trusted by browsers.
            </p>

            <label className={`${label} mt-5`}>Contact email for the authority</label>
            <Input value={this.contactEmail} onChange={this.onContact} placeholder="ssl@example.com" />
            <p className={help}>
              Optional. Used for account notices only — expiry warnings come from this platform, not from the authority.
            </p>
          </div>

          <div>
            <label className={label}>Public addresses of this platform</label>
            <PlatformAddressSuggestion candidates={this.candidates} onUse={this.useDetected} />
            <TextArea
              value={this.addresses}
              onChange={this.onAddresses}
              placeholder={'88.99.185.7'}
              inputClassName="h-24 font-mono text-[11px] resize-y"
            />
            <p className={help}>
              One per line. These are printed as the DNS instructions a customer follows, and a domain is
              checked against them before any certificate is ordered — so a wrong value here sends people to
              the wrong machine. The record must point straight at these addresses, not through a proxy or
              CDN; a proxied host can only use an uploaded certificate.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={this.save} isLoading={this.isSaving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
        </div>

        <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/10' : 'border-slate-200'}`}>
          <label className={label}>Cloudflare API token (DNS-01 / wildcard)</label>
          <p className={`text-sm mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            Needed only to order a WILDCARD certificate (<code>*.example.com</code>) — that can only be proven
            through DNS, never HTTP. Leave it blank and every host keeps ordering the single-name HTTP-01
            certificate above. The token needs Zone → DNS → Edit on the zone it will manage; it is stored
            encrypted and is never shown again once saved.
          </p>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              value={this.cloudflareTokenInput}
              onChange={this.onCloudflareToken}
              type="password"
              placeholder={this.isCloudflareConfigured ? 'Saved — leave blank to keep, or use Clear to remove' : 'Paste a Cloudflare API token'}
            />
            <Button onClick={this.saveCloudflareToken} isLoading={this.isSavingCloudflareToken} icon={<FrameworkIcons.Save size={14} />}>
              Save
            </Button>
            {this.isCloudflareConfigured ? (
              <Button variant={ButtonVariant.GHOST} onClick={this.clearCloudflareToken} isLoading={this.isSavingCloudflareToken}>
                Clear
              </Button>
            ) : null}
          </div>
          {this.cloudflareTokenMessage ? (
            <p className={`mt-2 text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{this.cloudflareTokenMessage}</p>
          ) : (
            <p className={`mt-2 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {this.isCloudflareConfigured ? 'A token is saved.' : 'No token is saved — wildcard issuance is off.'}
            </p>
          )}
        </div>
      </Card>
    );
  }
}
