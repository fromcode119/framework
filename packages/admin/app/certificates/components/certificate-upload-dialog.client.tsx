import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';

/**
 * Paste a certificate and its key for one host.
 *
 * Two boxes and nothing clever: no file picker that hides which file went where, no parsing in the
 * browser. The server does every check and names the ONE thing that is wrong, which is the
 * difference between fixing this in a minute and re-downloading both files from the issuer.
 *
 * The key box is a plain textarea and its content is never echoed back by the server afterwards —
 * once this dialog closes, nothing in the admin can show that key again.
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

  @bound private submit(e?: FormEvent): void {
    e?.preventDefault();
    if (this.certificatePem.trim() && this.privateKeyPem.trim()) {
      this.onConfirm(this.certificatePem.trim(), this.privateKeyPem.trim());
    }
  }

  private box(dark: boolean): string {
    return `w-full h-28 rounded-lg border px-3 py-2 font-mono text-[11px] leading-snug resize-y ${
      dark ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600'
           : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;
  }

  render(): ReactNode {
    if (!this.isOpen) return null;
    const dark = this.theme === ThemeMode.DARK;

    return (
      <RootFramework>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={this.onClose} />
          <form
            onSubmit={this.submit}
            className={`relative w-full max-w-lg my-auto rounded-xl border shadow-2xl p-6 animate-in zoom-in-95 duration-300 ${
              dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2.5 rounded-lg flex-shrink-0 ${dark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.Lock size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-base font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Upload certificate</h3>
                <p className={`mt-0.5 text-xs leading-relaxed font-mono truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{this.host}</p>
              </div>
            </div>

            <label className={`block text-[11px] font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              Certificate chain (PEM)
            </label>
            <textarea
              value={this.certificatePem}
              onChange={this.onCertificate}
              spellCheck={false}
              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
              className={this.box(dark)}
            />

            <label className={`block text-[11px] font-semibold mt-3 mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              Private key (PEM)
            </label>
            <textarea
              value={this.privateKeyPem}
              onChange={this.onKey}
              spellCheck={false}
              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              className={this.box(dark)}
            />
            <p className={`mt-1.5 text-[11px] leading-snug ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              Stored encrypted. It is never shown again and never leaves the server.
            </p>

            {this.error ? (
              <p className={`mt-3 text-xs leading-snug rounded-lg px-3 py-2 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>
                {this.error}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant={ButtonVariant.GHOST} onClick={this.onClose} type="button">Cancel</Button>
              <Button type="submit" isLoading={this.isSaving} icon={<FrameworkIcons.Lock size={14} />}>Store certificate</Button>
            </div>
          </form>
        </div>
      </RootFramework>
    );
  }
}
