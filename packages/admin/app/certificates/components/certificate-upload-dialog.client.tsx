import type { ChangeEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { TextArea } from '@/components/ui/view/text-area.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Hint } from '@/components/ui/view/hint.client';

/**
 * Paste a certificate and its key for one host.
 *
 * Two boxes and nothing clever: no file picker that hides which file went where, no parsing in the
 * browser. The server does every check and names the ONE thing that is wrong, which is the
 * difference between fixing this in a minute and re-downloading both files from the issuer.
 *
 * The key box is a plain textarea and its content is never echoed back by the server afterwards —
 * once this dialog closes, nothing in the admin can show that key again.
 *
 * A form, so it is the console's side drawer (`EditSheet`): the host under the title, the two boxes,
 * the server's one complaint above the buttons.
 */
export class CertificateUploadDialog extends AdminComponent {
  declare props: Pick<CertificateUploadDialog, 'host' | 'isOpen' | 'isSaving' | 'error' | 'onClose' | 'onConfirm'>;

  @prop declare host: string;
  @prop declare isOpen: boolean;
  @prop declare isSaving?: boolean;
  @prop declare error?: string;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (certificatePem: string, privateKeyPem: string) => void;

  @state certificatePem = '';
  @state privateKeyPem = '';

  componentDidUpdate(prev: Readonly<Record<string, unknown>>): void {
    // Never leave a private key sitting in a closed dialog's state.
    if (prev.isOpen !== this.isOpen && !this.isOpen) {
      this.certificatePem = '';
      this.privateKeyPem = '';
    }
  }

  @bound private onCertificate(e: ChangeEvent<HTMLTextAreaElement>): void {
    this.certificatePem = e.target.value;
  }

  @bound private onKey(e: ChangeEvent<HTMLTextAreaElement>): void {
    this.privateKeyPem = e.target.value;
  }

  @bound private submit(): void {
    if (this.certificatePem.trim() && this.privateKeyPem.trim()) {
      this.onConfirm(this.certificatePem.trim(), this.privateKeyPem.trim());
    }
  }

  render(): ReactNode {
    return (
      <EditSheet
        isOpen={this.isOpen}
        onClose={this.onClose}
        onSave={this.submit}
        saving={this.isSaving}
        error={this.error}
        title={AdminI18n.t('certificates.uploadCertificate')}
        subtitle={<span className="fc-mono">{this.host}</span>}
        saveLabel={AdminI18n.t('certificates.storeCertificate')}
        cancelLabel={AdminI18n.t('certificates.cancel')}
      >
        <div className="fc-form-stack">
          <TextArea
            label={AdminI18n.t('certificates.certificateChainPem')}
            value={this.certificatePem}
            onChange={this.onCertificate}
            spellCheck={false}
            autoFocus
            placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
            inputClassName="fc-pem-input"
          />
          <div className="fc-field-stack">
            <TextArea
              label={AdminI18n.t('certificates.privateKeyPem')}
              value={this.privateKeyPem}
              onChange={this.onKey}
              spellCheck={false}
              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              inputClassName="fc-pem-input"
            />
            <Hint>{AdminI18n.t('certificates.storedEncryptedItIsNever')}</Hint>
          </div>
        </div>
      </EditSheet>
    );
  }
}
