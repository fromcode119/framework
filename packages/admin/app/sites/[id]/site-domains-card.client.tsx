import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { CertificateHost } from '@/lib/certificates/certificate-host';
import { CertificateHostTable } from '@/app/certificates/components/certificate-host-table.client';
import { CertificateUploadDialog } from '@/app/certificates/components/certificate-upload-dialog.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';

/**
 * This site's addresses and what each one serves HTTPS with.
 *
 * The same rows as the platform-wide list, narrowed to one site, because the question "is this
 * site's certificate about to run out" is asked while looking at the site — not while looking at a
 * list of every host on the platform.
 */
export class SiteDomainsCard extends AdminComponent {
  declare props: Pick<SiteDomainsCard, 'tenantId'>;

  @prop declare tenantId: string;

  @state private entries: CertificateHost[] = [];
  @state private encryptionAvailable = false;
  @state private isLoading = true;
  @state private uploadHost = '';
  @state private uploadError = '';
  @state private isSaving = false;

  componentDidMount(): void {
    void this.load();
  }

  @bound private async load(): Promise<void> {
    try {
      const result = await CertificatesClient.list(this.tenantId);
      this.entries = result.hosts;
      this.encryptionAvailable = result.encryptionAvailable;
    } finally {
      this.isLoading = false;
    }
  }

  @bound private openUpload(host: string): void {
    this.uploadError = '';
    this.uploadHost = host;
  }

  @bound private closeUpload(): void {
    this.uploadHost = '';
    this.uploadError = '';
  }

  @bound private async confirmUpload(certificatePem: string, privateKeyPem: string): Promise<void> {
    this.isSaving = true;
    try {
      await CertificatesClient.upload(this.uploadHost, certificatePem, privateKeyPem);
      this.closeUpload();
      await this.load();
    } catch (error: any) {
      this.uploadError = CertificatesClient.reasonLabel(String(error?.message || ''));
    } finally {
      this.isSaving = false;
    }
  }

  @bound private async removeHost(host: string): Promise<void> {
    await CertificatesClient.remove(host).catch(() => undefined);
    await this.load();
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;

    return (
      <Card title="Domains">
        <p className={`text-sm mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          The addresses this site answers on. A certificate is what lets each one be served over HTTPS;
          an uploaded certificate is never renewed automatically, so it has to be replaced before it expires.
        </p>

        {this.isLoading ? (
          <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Loading…</p>
        ) : (
          <CertificateHostTable
            entries={this.entries}
            canUpload={this.encryptionAvailable}
            onUpload={this.openUpload}
            onRemove={this.removeHost}
          />
        )}

        <CertificateUploadDialog
          host={this.uploadHost}
          isOpen={this.uploadHost.length > 0}
          isSaving={this.isSaving}
          error={this.uploadError}
          onClose={this.closeUpload}
          onConfirm={this.confirmUpload}
        />
      </Card>
    );
  }
}
