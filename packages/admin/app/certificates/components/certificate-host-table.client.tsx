import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Hint } from '@/components/ui/view/hint.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
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
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CertificateAttemptStatus } from '@/app/certificates/components/certificate-attempt-status.client';

/**
 * Every host the platform serves, and what it has to serve HTTPS with.
 *
 * A host with NO certificate is a row here, not an omission — it is the row that matters most, and a
 * table built from stored certificates could never show it.
 */
export class CertificateHostTable extends AdminComponent {
  declare props: Pick<CertificateHostTable, 'entries' | 'canUpload' | 'canAutomate' | 'canAutomateWildcard' | 'terminatesTls' | 'platformAddresses' | 'checkIntervalMinutes' | 'busyHost' | 'showSite' | 'onUpload' | 'onRemove' | 'onAutomate' | 'onAutomateWildcard'>;

  @prop declare entries: CertificateHost[];
  @prop declare canUpload: boolean;
  @prop declare canAutomate?: boolean;
  /** Whether a Cloudflare token is saved, so the DNS-01/wildcard variant of Automatic is offered too. */
  @prop declare canAutomateWildcard?: boolean;
  /** Whether this deployment's own gateway is the thing terminating TLS. See `renderMeta`. */
  @prop declare terminatesTls?: boolean;
  @prop declare platformAddresses?: string[];
  /** How often queued hosts are checked, from the api — so a waiting row can say when. */
  @prop declare checkIntervalMinutes?: number;
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
    return <Hint>{AdminI18n.t('certificates.pointHostAt', { host: entry.host, addresses: addresses.join(', ') })}</Hint>;
  }

  private renderMeta(entry: CertificateHost): ReactNode {
    if (!entry.hasCertificate) {
      // WHAT "NOTHING STORED" MEANS DEPENDS ON WHO TERMINATES TLS, and the platform must not claim
      // more than it knows. When its own gateway is not terminating, something in front of it is —
      // and that something holds the certificate this platform has no row for. Saying "cannot be
      // served over HTTPS" there is flatly contradicted by the browser that just loaded the host.
      // A WILDCARD stored elsewhere may already cover this host — `*.example.com` lives on the
      // `example.com` row — and the gateway serves it from there. Saying "nothing stored" would be
      // true of this row and false of the host, and would invite a second certificate for a name
      // that already has one. Name where it lives, so the operator can go to it.
      if (entry.coveredByHost) {
        return (
          <span className="fc-dt-quiet">
            {entry.coveredByExpiryDate ? AdminI18n.t('certificates.servedByWildcardUntil', { host: entry.coveredByHost, date: entry.coveredByExpiryDate }) : AdminI18n.t('certificates.servedByWildcard', { host: entry.coveredByHost })}
          </span>
        );
      }

      return (
        <span className="fc-dt-quiet">
          {this.terminatesTls
            ? AdminI18n.t('certificates.nothingStoredThisHostCannot')
            : AdminI18n.t('certificates.nothingStoredHereTlsFor')}
        </span>
      );
    }
    return (
      <span className="fc-dt-quiet">
        {entry.issuer ? `${entry.issuer} · ` : ''}{AdminI18n.t('certificates.until', { date: entry.expiryDate })}
        {entry.isUploaded ? AdminI18n.t('certificates.uploadedNotRenewedAutomatically') : ''}
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

  /**
   * What can be done with one host. A host already Automatic is on exactly ONE variant (http-01 or
   * dns-01); whichever it is NOT on stays offered, so there is always a path between the two.
   */
  private menu(entry: CertificateHost): any[] {
    const items: any[] = [];
    if (this.canAutomate && !entry.isAutomaticHttp01) {
      items.push({ label: entry.isPlatformManaged ? AdminI18n.t('certificates.switchToPlainHttp01') : AdminI18n.t('certificates.automatic'), icon: <FrameworkIcons.Refresh size={15} />, onClick: this.automate(entry.host) });
    }
    if (this.canAutomateWildcard && !entry.isAutomaticDns01) {
      items.push({ label: entry.isPlatformManaged ? AdminI18n.t('certificates.switchToWildcardDns01') : AdminI18n.t('certificates.automaticWildcard'), icon: <FrameworkIcons.Refresh size={15} />, onClick: this.automateWildcard(entry.host) });
    }
    if (this.canUpload) {
      items.push({ label: entry.hasCertificate ? AdminI18n.t('certificates.replace') : AdminI18n.t('certificates.upload'), icon: <FrameworkIcons.Upload size={15} />, onClick: this.upload(entry.host) });
    }
    if (entry.hasCertificate) {
      items.push({ label: AdminI18n.t('certificates.removeCertificate'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: this.remove(entry.host) });
    }
    return items;
  }

  private renderRow(entry: CertificateHost): ReactNode {
    const under = <><CertificateAttemptStatus entry={entry} checkIntervalMinutes={this.checkIntervalMinutes ?? 0} />{this.renderDnsInstructions(entry)}</>;
    const waiting = Boolean(entry.lastError) || entry.state === 'waiting_for_dns';
    return (
      <div key={entry.host}>
        <ListRow
          icon={entry.isPlatformHost ? <FrameworkIcons.Shield size={16} /> : <FrameworkIcons.Globe size={16} />}
          title={<code className="fc-dt-code">{entry.host}</code>}
          badges={<CertificateStateBadge entry={entry} />}
          description={<>{entry.roleLabel}{this.showSite && entry.tenantSlug ? ` · ${entry.tenantSlug}` : ''} · {this.renderMeta(entry)}</>}
          meta={entry.remainingLabel || undefined}
          actions={this.busyHost === entry.host ? <Loader /> : undefined}
          menu={this.menu(entry)}
        />
        {waiting ? <div className="fc-list-band fc-list-band--under fc-stack">{under}</div> : null}
      </div>
    );
  }

  render(): ReactNode {
    if (!this.entries.length) return <EmptyState title={AdminI18n.t('certificates.noHostsAreConfiguredOn')} />;
    return <div>{this.entries.map((entry) => this.renderRow(entry))}</div>;
  }
}
