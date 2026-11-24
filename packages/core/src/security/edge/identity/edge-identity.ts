import { SystemConstants } from '@core/constants/system.constants';
import { EdgeCertificateAuthority } from '@core/security/edge/identity/edge-certificate-authority';
import { EdgeControlEndpoint } from '@core/security/edge/identity/edge-control-endpoint';
import { EdgeEnrollmentService } from '@core/security/edge/identity/edge-enrollment-service';
import { EdgeIdentityPolicy } from '@core/security/edge/identity/edge-identity-policy';
import { EdgeX509 } from '@core/security/edge/identity/edge-x509';
import type { IEdgeIssued } from '@core/security/edge/identity/interfaces/edge-issued.interface';

/**
 * Edge identity for one deployment, over its database and its settings: the authority, adding and
 * removing edges, and the certificate the gateway's control channel presents to them.
 *
 * The policy and the control endpoint are read from the settings on every use, so a change in
 * Settings → Security → Edges applies to the next certificate without a restart.
 */
export class EdgeIdentity {
  readonly authority: EdgeCertificateAuthority;
  readonly enrollment: EdgeEnrollmentService;

  constructor(
    db: any,
    private readonly settings: Map<string, string>,
    /** The platform's own API host, which edge identities are issued under. */
    private readonly trustDomain: () => string,
    now: () => number = Date.now,
  ) {
    const policy = () => this.policy();
    this.authority = new EdgeCertificateAuthority(db, policy, now);
    this.enrollment = new EdgeEnrollmentService(db, this.authority, policy, now);
  }

  policy(): EdgeIdentityPolicy {
    return EdgeIdentityPolicy.from(this.settings, this.trustDomain());
  }

  /** Where edges reach the control channel, or null while it is not configured. */
  control(): EdgeControlEndpoint | null {
    const keys = SystemConstants.META_KEY;
    return EdgeControlEndpoint.from(this.settings.get(keys.EDGE_CONTROL_ADDRESS), this.settings.get(keys.EDGE_CONTROL_PORT));
  }

  /**
   * A certificate for the gateway's control listener, for the configured address, so an edge can check
   * it reached the platform. Null while there is no control endpoint or the request is not valid.
   */
  async controlCertificate(requestPem: string): Promise<IEdgeIssued | null> {
    const control = this.control();
    const publicKey = await EdgeX509.readRequest(requestPem);
    if (!control || !publicKey) return null;
    const names = control.isAddress ? { ipAddresses: [control.address] } : { dnsNames: [control.address] };
    const issued = await this.authority.issue(publicKey, control.address, names, { serverAuth: true });
    return { edgeId: '', certificatePem: issued.certificatePem, chainPem: issued.chainPem, trustPem: await this.authority.trustBundle(), notAfter: issued.notAfter.toISOString() };
  }
}
