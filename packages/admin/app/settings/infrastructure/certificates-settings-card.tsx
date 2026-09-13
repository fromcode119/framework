import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { AcmeDirectory, ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * What the platform needs before it can obtain a certificate on its own.
 *
 * BOTH FIELDS ARE BLANK BY DEFAULT AND BLANK MEANS OFF. Neither can be guessed: an authority the
 * platform would start placing orders with, and the address customers are told to point DNS at. A
 * default for either would be this product inventing a fact about somebody's deployment, and the
 * address in particular would send every customer's domain to a machine nobody chose.
 */
export class CertificatesSettingsCard extends AdminComponent {
  @state private directory = '';
  @state private contactEmail = '';
  @state private addresses = '';
  @state private isSaving = false;
  @state private isLoaded = false;

  async componentDidMount(): Promise<void> {
    const settings = await AdminSystemSettingsClient.getAll().catch(() => ({} as Record<string, any>));
    this.directory = String(settings?.certificate_acme_directory ?? '');
    this.contactEmail = String(settings?.certificate_acme_contact_email ?? '');
    this.addresses = String(settings?.certificate_platform_addresses ?? '');
    this.isLoaded = true;
  }

  @bound private onDirectory(e: ChangeEvent<HTMLSelectElement>): void { this.directory = e.target.value; }
  @bound private onContact(e: ChangeEvent<HTMLInputElement>): void { this.contactEmail = e.target.value; }
  @bound private onAddresses(e: ChangeEvent<HTMLTextAreaElement>): void { this.addresses = e.target.value; }

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

  private field(dark: boolean): string {
    return `w-full rounded-lg border px-3 py-2 text-sm ${
      dark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`;
  }

  render(): ReactNode {
    if (!this.isLoaded) return null;
    const dark = this.theme === ThemeMode.DARK;
    const label = `block text-xs font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`;
    const help = `mt-1 text-[11px] leading-snug ${dark ? 'text-slate-500' : 'text-slate-400'}`;

    return (
      <Card title="Certificates">
        <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Leave these blank and the platform never obtains a certificate itself — hosts keep whatever was uploaded.
        </p>

        <label className={label}>Certificate authority</label>
        <select value={this.directory} onChange={this.onDirectory} className={this.field(dark)}>
          <option value="">Not set — automatic certificates are off</option>
          {AcmeDirectory.options().map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className={help}>Pick the staging authority to test the whole flow without spending a production rate limit. Its certificates are not trusted by browsers.</p>

        <label className={`${label} mt-4`}>Public addresses of this platform</label>
        <textarea
          value={this.addresses}
          onChange={this.onAddresses}
          spellCheck={false}
          placeholder={'88.99.185.7\n2a01:4f8:1c1e:8865::1'}
          className={`${this.field(dark)} h-20 font-mono text-[11px] resize-y`}
        />
        <p className={help}>
          One per line. These are printed as the DNS instructions a customer follows, and a domain is checked
          against them before any certificate is ordered — so a wrong value here sends people to the wrong machine.
        </p>

        <label className={`${label} mt-4`}>Contact address for the authority</label>
        <input value={this.contactEmail} onChange={this.onContact} placeholder="ssl@example.com" className={this.field(dark)} />
        <p className={help}>Optional. Used for account notices only — expiry warnings come from this platform, not from the authority.</p>

        <div className="mt-4 flex justify-end">
          <Button onClick={this.save} isLoading={this.isSaving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
        </div>
      </Card>
    );
  }
}
