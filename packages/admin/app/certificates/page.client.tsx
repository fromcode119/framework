import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { CertificateHost } from '@/lib/certificates/certificate-host';
import { CertificateHostTable } from '@/app/certificates/components/certificate-host-table.client';
import { CertificateUploadDialog } from '@/app/certificates/components/certificate-upload-dialog.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';

/**
 * Every TLS certificate on the platform, in one list.
 *
 * It answers the question an operator actually has — "what is about to break?" — so it is ordered by
 * what runs out soonest and it includes hosts with no certificate at all.
 *
 * TWO THINGS ARE STATED RATHER THAN ASSUMED. Whether this installation can store a key at all, and
 * whether anything here is actually SERVING what it stores. Without the second, an operator uploads
 * a certificate, sees a green badge, and finds the site still broken — the product having quietly
 * implied something it never checked.
 */
export class CertificatesPageClient extends AdminComponent {
  @state private entries: CertificateHost[] = [];
  @state private encryptionAvailable = false;
  @state private edge: Record<string, unknown> | null = null;
  @state private isLoading = true;
  @state private loadError = '';
  @state private uploadHost = '';
  @state private uploadError = '';
  @state private isSaving = false;

  componentDidMount(): void {
    void this.load();
  }

  @bound private async load(): Promise<void> {
    try {
      const result = await CertificatesClient.list();
      this.entries = result.hosts;
      this.encryptionAvailable = result.encryptionAvailable;
      this.edge = result.edge;
      this.loadError = '';
    } catch (error: any) {
      this.loadError = String(error?.message || 'Could not load certificates.');
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
      // The api answers a refusal with its REASON CODE, which becomes the one sentence that says
      // which of the two boxes is wrong.
      this.uploadError = CertificatesClient.reasonLabel(String(error?.message || ''));
    } finally {
      this.isSaving = false;
    }
  }

  @bound private async removeHost(host: string): Promise<void> {
    await CertificatesClient.remove(host).catch(() => undefined);
    await this.load();
  }

  /** What this deployment's own edge reports — never an inference from the fact a row exists. */
  private renderEdgeNotice(dark: boolean): ReactNode {
    if (!this.edge) {
      return (
        <p className={`text-xs leading-snug rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
          The platform gateway could not be reached, so what is actually serving these certificates is unknown.
        </p>
      );
    }
    if (this.edge.tls === true) {
      return (
        <p className={`text-xs leading-snug rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          This platform’s gateway is terminating TLS and currently holds {String(this.edge.certificates ?? 0)} certificate(s).
        </p>
      );
    }
    return (
      <p className={`text-xs leading-snug rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
        This deployment’s gateway is not terminating TLS, so stored certificates are not being served by anything here.
        Something in front of the platform holds the certificates it serves.
      </p>
    );
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    if (this.isLoading) return <Loader />;

    return (
      <div className="fc-certificates">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Lock size={18} strokeWidth={2} />}
          title="Certificates"
          subtitle="Every address this platform answers for, and what it serves HTTPS with. Soonest to expire first."
        />
        <div className="fc-certificates__body">
        <Card title="TLS">
          {this.renderEdgeNotice(dark)}

          {!this.encryptionAvailable ? (
            <p className={`text-xs leading-snug rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>
              No SECRET_KEY is configured on this server, so a private key cannot be stored. Uploading is disabled
              until one is set.
            </p>
          ) : null}

          {this.loadError ? (
            <p className={`text-xs rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{this.loadError}</p>
          ) : null}

          <CertificateHostTable
            entries={this.entries}
            canUpload={this.encryptionAvailable}
            showSite
            onUpload={this.openUpload}
            onRemove={this.removeHost}
          />
        </Card>
        </div>

        <CertificateUploadDialog
          host={this.uploadHost}
          isOpen={this.uploadHost.length > 0}
          isSaving={this.isSaving}
          error={this.uploadError}
          onClose={this.closeUpload}
          onConfirm={this.confirmUpload}
        />
      </div>
    );
  }
}
