import { Alert } from '@/components/ui/view/alert.client';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CertificateNoticeTone } from '@/app/certificates/enums/certificate-notice-tone.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The three facts this screen must state rather than imply.
 *
 * Can this installation store a key at all; is anything here actually SERVING what it stores; and
 * can the platform obtain certificates itself. Every one of them is a way for the page to look like
 * it is working when it is not, so each is printed with the reason instead of being left to a green
 * badge to suggest.
 */
export class CertificateStatusNotices extends AdminComponent {
  declare props: Pick<CertificateStatusNotices, 'edge' | 'automation' | 'encryptionAvailable'>;

  @prop declare edge: Record<string, unknown> | null;
  @prop declare automation: Record<string, unknown> | null;
  @prop declare encryptionAvailable: boolean;


  /** A note in the kit's tones: good, warn and bad are its own; a plain fact is the quiet one. */
  private notice(tone: CertificateNoticeTone, body: ReactNode): ReactNode {
    const tones: Record<string, 'success' | 'warning' | 'danger' | 'info'> = { good: 'success', warn: 'warning', bad: 'danger', muted: 'info' };
    return <Alert tone={tones[String(tone.value)]}>{body}</Alert>;
  }

  /** What the platform's own edge reports — never inferred from a row existing. */
  private renderEdge(): ReactNode {
    if (!this.edge) {
      return this.notice(CertificateNoticeTone.MUTED, AdminI18n.t('certificates.thePlatformGatewayCouldNot'));
    }
    if (this.edge.tls === true) {
      return this.notice(CertificateNoticeTone.GOOD, AdminI18n.t('certificates.thisPlatformSGatewayIs', { count: String(this.edge.certificates ?? 0) }));
    }
    return this.notice(CertificateNoticeTone.WARN,
      AdminI18n.t('certificates.gatewayNotTerminating'));
  }

  /** Whether the platform can obtain certificates itself, and which half is missing when it cannot. */
  private renderAutomation(): ReactNode {
    if (!this.automation) return null;
    if (this.automation.isAvailable !== true) {
      return this.notice(CertificateNoticeTone.MUTED, AdminI18n.t('certificates.automaticCertificatesAreOff', { reason: AdminI18n.optional(`certificates.blocked.${String(this.automation.blockedCode || '')}`) || String(this.automation.blockedReason || '') }));
    }

    const authority = String(this.automation.directoryLabel || '');
    if (this.automation.isTestAuthority === true) {
      return this.notice(CertificateNoticeTone.WARN,
        AdminI18n.t('certificates.stagingAuthorityWarning', { authority: authority }));
    }
    return this.notice(CertificateNoticeTone.MUTED, AdminI18n.t('certificates.automaticCertificatesComeFrom', { authority: authority }));
  }

  render(): ReactNode {
    return (
      <div className="fc-stack">
        {this.renderEdge()}
        {this.renderAutomation()}
        {!this.encryptionAvailable
          ? this.notice(CertificateNoticeTone.BAD, AdminI18n.t('certificates.noSecretKeyIsConfigured'))
          : null}
      </div>
    );
  }
}
