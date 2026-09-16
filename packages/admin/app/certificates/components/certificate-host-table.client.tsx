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
  declare props: Pick<CertificateHostTable, 'entries' | 'canUpload' | 'canAutomate' | 'canAutomateWildcard' | 'terminatesTls' | 'platformAddresses' | 'busyHost' | 'showSite' | 'onUpload' | 'onRemove' | 'onAutomate' | 'onAutomateWildcard'>;

  @prop declare entries: CertificateHost[];
  @prop declare canUpload: boolean;
  @prop declare canAutomate?: boolean;
  /** Whether a Cloudflare token is saved, so the DNS-01/wildcard variant of Automatic is offered too. */
  @prop declare canAutomateWildcard?: boolean;
  /** Whether this deployment's own gateway is the thing terminating TLS. See `renderMeta`. */
  @prop declare terminatesTls?: boolean;
  @prop declare platformAddresses?: string[];
  @prop declare busyHost?: string;
  @prop declare showSite?: boolean;
  @prop declare onUpload: (host: string) => void;
  @prop declare onRemove: (host: string) => void;
  @prop declare onAutomate?: (host: string) => void;
  @prop declare onAutomateWildcard?: (host: string) => void;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  @bound private upload(host: string): () => void {
    return () => this.onUpload(host);
  }

  @bound private remove(host: string): () => void {
    return () => this.onRemove(host);
  }

  @bound private automate(host: string): () => void {
    return () => this.onAutomate?.(host);
  }

  @bound private automateWildcard(host: string): () => void {
    return () => this.onAutomateWildcard?.(host);
  }

  /**
   * What a host waiting on DNS needs its operator to do.
   *
   * The addresses come from the declared platform setting, never from anything inferred — they are
   * what a customer will be told to point a domain at, and a guess here sends them to a machine
   * nobody chose.
   */
  private renderDnsInstructions(entry: CertificateHost): ReactNode {
    const addresses = this.platformAddresses ?? [];
    if (entry.state !== 'waiting_for_dns' || !addresses.length) return null;
    const dark = this.isDark;
    return (
      <p className={`mt-0.5 text-[11px] leading-snug ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
        Point {entry.host} at {addresses.join(' and ')}, then this is retried automatically.
      </p>
    );
  }

  private renderMeta(entry: CertificateHost): ReactNode {
    const dark = this.isDark;
    if (!entry.hasCertificate) {
      // WHAT "NOTHING STORED" MEANS DEPENDS ON WHO TERMINATES TLS, and the platform must not claim
      // more than it knows. When its own gateway is not terminating, something in front of it is —
      // and that something holds the certificate this platform has no row for. Saying "cannot be
      // served over HTTPS" there is flatly contradicted by the browser that just loaded the host.
      return (
        <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {this.terminatesTls
            ? 'Nothing stored — this host cannot be served over HTTPS by this platform.'
            : 'Nothing stored here — TLS for this host is terminated before the platform, so its certificate lives there.'}
        </span>
      );
    }
    return (
      <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        {entry.issuer ? `${entry.issuer} · ` : ''}until {entry.expiryDate}
        {entry.isUploaded ? ' · uploaded, not renewed automatically' : ''}
        {/*
          Two independent claims about two different things — how the certificate was OBTAINED
          (isAutomaticDns01, the platform's ordering intent/method) vs what the STORED certificate
          actually COVERS (isDnsWildcard, read from its own SANs). A hand-uploaded wildcard cert
          covers *.host without having been obtained via DNS-01; neither claim may stand in for
          the other.
        */}
        {entry.isAutomaticDns01 ? ' · DNS-01' : ''}
        {entry.isDnsWildcard ? ' · covers *.'.concat(entry.host) : ''}
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
          {this.renderDnsInstructions(entry)}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className={`text-[11px] tabular-nums ${
            entry.needsAttention ? (dark ? 'text-amber-400' : 'text-amber-600') : (dark ? 'text-slate-500' : 'text-slate-400')}`}
          >
            {entry.remainingLabel}
          </span>

          <div className="flex items-center gap-1">
            {/*
              A host already Automatic is on exactly ONE variant (http-01 or dns-01). Whichever one
              it is NOT currently on stays offered, so there is always a path between the two — a
              host on plain Automatic can switch to wildcard, and a host on wildcard can switch back.
              Never hide both for an already-automatic host.
            */}
            {this.canAutomate && !entry.isAutomaticHttp01 ? (
              <Button
                variant={ButtonVariant.GHOST}
                size={FieldSize.SM}
                onClick={this.automate(entry.host)}
                icon={<FrameworkIcons.Refresh size={13} />}
              >
                {entry.isPlatformManaged ? 'Switch to plain (HTTP-01)' : 'Automatic'}
              </Button>
            ) : null}
            {this.canAutomateWildcard && !entry.isAutomaticDns01 ? (
              <Button
                variant={ButtonVariant.GHOST}
                size={FieldSize.SM}
                onClick={this.automateWildcard(entry.host)}
                icon={<FrameworkIcons.Refresh size={13} />}
              >
                {entry.isPlatformManaged ? 'Switch to wildcard (DNS-01)' : 'Automatic (wildcard)'}
              </Button>
            ) : null}
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
