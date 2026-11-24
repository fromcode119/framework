import type * as pkijs from 'pkijs';

/** What one certificate the edge authority signs says, and what signs it. */
export interface IEdgeCertificateSpec {
  /** Hex, positive. */
  serial: string;
  /** Common names of the subject and of the issuer (the same for a root). */
  subject: string;
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  /** The key the certificate is for: a generated one, or the one a verified request carries. */
  publicKey: CryptoKey | pkijs.PublicKeyInfo;
  /** The issuer's private key (the subject's own, for a root). */
  signingKey: CryptoKey;
  /** The issuer's subject key identifier; absent only for a root. */
  issuerKeyId?: ArrayBuffer;
  /** An authority may sign certificates; `pathLength` limits how many authorities may sit below it. */
  authority?: boolean;
  pathLength?: number;
  /** What the key may be used for in TLS. */
  clientAuth?: boolean;
  serverAuth?: boolean;
  /** The identity: a SPIFFE-style URI, host names and addresses the certificate is valid for. */
  uri?: string;
  dnsNames?: string[];
  ipAddresses?: string[];
}
