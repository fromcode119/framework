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
import { CertificateStatusNotices } from '@/app/certificates/components/certificate-status-notices.client';
import { CertificateUploadDialog } from '@/app/certificates/components/certificate-upload-dialog.client';
import { CertificatesClient } from '@/lib/certificates/certificates-client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

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
  @state private automation: Record<string, unknown> | null = null;
  /**
   * 'platform' for the whole-box read, or a tenant id when the api narrowed the list to one site — an
   * operator can land on this SAME platform-wide screen while their session is bound to a site, and
   * the list is silently scoped to that site's hosts underneath them. The subtitle has to say whose
   * hosts these are rather than always claiming platform-wide coverage (see `subtitle` below).
   */
  @state private scope = 'platform';
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
      this.automation = result.automation;
      this.scope = result.scope;
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

  /** Hand a host to the platform. A refusal carries the api's reason, which is shown as-is. */
  @bound private async automate(host: string): Promise<void> {
    try {
      await CertificatesClient.setSource(host, 'automatic');
      this.loadError = '';
    } catch (error: any) {
      this.loadError = String(error?.message || 'Could not switch this host to automatic.');
    }
    await this.load();
  }

  /** Same as `automate`, but asks for the DNS-01 variant that also covers `*.<host>`. */
  @bound private async automateWildcard(host: string): Promise<void> {
    try {
      await CertificatesClient.setSource(host, 'automatic', true);
      this.loadError = '';
    } catch (error: any) {
      this.loadError = String(error?.message || 'Could not switch this host to automatic (wildcard).');
    }
    await this.load();
  }

  /**
   * The subtitle claims exactly what `this.scope` says it does — platform-wide only when the read
   * actually was. A bound request answers `forTenant`, so anything other than the literal `'platform'`
   * means the list below is one site's hosts, and the copy must say "this site", not "this platform".
   */
  private get subtitle(): string {
    const key = this.scope === 'platform' ? 'certificates.subtitlePlatform' : 'certificates.subtitleSite';
    return AdminDictionary.translate(AdminDictionary.FALLBACK_LOCALE, key);
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
          subtitle={this.subtitle}
        />
        <div className="fc-certificates__body">
        <Card title="TLS">
          <CertificateStatusNotices
            edge={this.edge}
            automation={this.automation}
            encryptionAvailable={this.encryptionAvailable}
          />

          {this.loadError ? (
            <p className={`text-xs rounded-lg px-3 py-2 mb-3 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{this.loadError}</p>
          ) : null}

          <CertificateHostTable
            entries={this.entries}
            canUpload={this.encryptionAvailable}
            canAutomate={this.automation?.isAvailable === true}
            canAutomateWildcard={this.automation?.dnsWildcardAvailable === true}
            terminatesTls={this.edge?.tls === true}
            platformAddresses={(this.automation?.platformAddresses as string[]) ?? []}
            showSite
            onUpload={this.openUpload}
            onRemove={this.removeHost}
            onAutomate={this.automate}
            onAutomateWildcard={this.automateWildcard}
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
