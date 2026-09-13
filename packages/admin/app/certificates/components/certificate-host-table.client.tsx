import type { ReactNode } from 'react';
import { bound, prop } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { CertificateHost } from '@/lib/certificates/certificate-host';
import { CertificateStateBadge } from '@/app/certificates/components/certificate-state-badge.client';

/**
 * Every host the platform serves, and what it has to serve HTTPS with.
 *
 * A host with NO certificate is a row here, not an omission — it is the row that matters most, and a
 * table built from stored certificates could never show it.
 */
export class CertificateHostTable extends AdminComponent {
  declare props: Pick<CertificateHostTable, 'entries' | 'canUpload' | 'busyHost' | 'showSite' | 'onUpload' | 'onRemove'>;

  @prop declare entries: CertificateHost[];
  @prop declare canUpload: boolean;
  @prop declare busyHost?: string;
  @prop declare showSite?: boolean;
  @prop declare onUpload: (host: string) => void;
  @prop declare onRemove: (host: string) => void;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  @bound private upload(host: string): () => void {
    return () => this.onUpload(host);
  }

  @bound private remove(host: string): () => void {
    return () => this.onRemove(host);
  }

  private renderMeta(entry: CertificateHost): ReactNode {
    const dark = this.isDark;
    if (!entry.hasCertificate) {
      return (
        <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Nothing stored — this host cannot be served over HTTPS by this platform.
        </span>
      );
    }
    return (
      <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        {entry.issuer ? `${entry.issuer} · ` : ''}until {entry.expiryDate}
        {entry.isUploaded ? ' · uploaded, not renewed automatically' : ''}
      </span>
    );
  }

  private renderRow(entry: CertificateHost): ReactNode {
    const dark = this.isDark;
    const busy = this.busyHost === entry.host;
    return (
      <div key={entry.host} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${dark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
        <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
          entry.needsAttention
            ? (dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')
            : (dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
        >
          {entry.isPlatformHost ? <FrameworkIcons.Shield size={15} strokeWidth={1.5} /> : <FrameworkIcons.Globe size={15} strokeWidth={1.5} />}
        </div>

        <div className="flex-1 min-w-0 basis-56">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tracking-tight truncate font-mono ${dark ? 'text-white' : 'text-slate-900'}`}>{entry.host}</span>
            <CertificateStateBadge entry={entry} />
          </div>
          <div className="truncate">
            <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {entry.roleLabel}{this.showSite && entry.tenantSlug ? ` · ${entry.tenantSlug}` : ''} ·{' '}
            </span>
            {this.renderMeta(entry)}
          </div>
          {entry.lastError ? (
            <p className={`mt-0.5 text-[11px] font-mono truncate ${dark ? 'text-red-400' : 'text-red-600'}`}>{entry.lastError}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className={`text-[11px] tabular-nums ${
            entry.needsAttention ? (dark ? 'text-amber-400' : 'text-amber-600') : (dark ? 'text-slate-500' : 'text-slate-400')}`}
          >
            {entry.remainingLabel}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant={ButtonVariant.GHOST}
              size={FieldSize.SM}
              onClick={this.upload(entry.host)}
              isLoading={busy}
              disabled={!this.canUpload}
              icon={<FrameworkIcons.Upload size={13} />}
            >
              {entry.hasCertificate ? 'Replace' : 'Upload'}
            </Button>
            {entry.hasCertificate ? (
              <Button variant={ButtonVariant.GHOST} size={FieldSize.SM} onClick={this.remove(entry.host)} icon={<FrameworkIcons.Trash size={13} />}>
                {/* Icon-only by design — the row is already dense — but the action still needs a name
                    for anyone not reading it by sight. */}
                <span className="sr-only">Remove certificate</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const dark = this.isDark;
    if (!this.entries.length) {
      return <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>No hosts are configured on this platform yet.</p>;
    }
    return (
      <div className={`rounded-lg border overflow-hidden divide-y ${dark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
        {this.entries.map((entry) => this.renderRow(entry))}
      </div>
    );
  }
}
