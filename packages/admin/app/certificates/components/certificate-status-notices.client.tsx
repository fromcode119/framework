import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
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

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  private notice(tone: CertificateNoticeTone, body: ReactNode): ReactNode {
    const dark = this.isDark;
    const tones: Record<string, string> = {
      good: dark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
      warn: dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700',
      bad: dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700',
      muted: dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500',
    };
    return <p className={`text-xs leading-snug rounded-lg px-3 py-2 mb-3 ${tones[String(tone.value)]}`}>{body}</p>;
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
      <>
        {this.renderEdge()}
        {this.renderAutomation()}
        {!this.encryptionAvailable
          ? this.notice(CertificateNoticeTone.BAD, AdminI18n.t('certificates.noSecretKeyIsConfigured'))
          : null}
      </>
    );
  }
}
