import { createHash, randomBytes, webcrypto, X509Certificate } from 'crypto';
import { isIPv4, isIPv6 } from 'net';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import type { IEdgeCertificateSpec } from '@core/security/edge/identity/interfaces/edge-certificate-spec.interface';

/**
 * The X.509 the edge authority needs, and nothing more: ECDSA P-256 keys, certificates for the authority
 * and for edges, and reading a certificate request. Built on pkijs over Node's own WebCrypto, so no global
 * is patched and no key ever leaves this process except as encrypted PEM.
 *
 * P-256 with SHA-256 is what SPIRE issues by default and what TLS 1.3 offers everywhere.
 */
export class EdgeX509 {
  static readonly ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
  static readonly HASH = 'SHA-256';
  private static readonly OID = {
    CN: '2.5.4.3',
    BASIC_CONSTRAINTS: '2.5.29.19',
    KEY_USAGE: '2.5.29.15',
    EXT_KEY_USAGE: '2.5.29.37',
    SUBJECT_ALT_NAME: '2.5.29.17',
    SUBJECT_KEY_ID: '2.5.29.14',
    AUTHORITY_KEY_ID: '2.5.29.35',
    CLIENT_AUTH: '1.3.6.1.5.5.7.3.2',
    SERVER_AUTH: '1.3.6.1.5.5.7.3.1',
  };
  /** Key usage bits, as they sit in the first byte of the bit string. */
  private static readonly USAGE = { DIGITAL_SIGNATURE: 0x80, KEY_CERT_SIGN: 0x04, CRL_SIGN: 0x02 };

  private static engineReady = false;

  private static engine(): void {
    if (EdgeX509.engineReady) return;
    pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));
    EdgeX509.engineReady = true;
  }

  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return webcrypto.subtle.generateKey(EdgeX509.ALGORITHM, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
  }

  /**
   * A random, positive 128-bit serial number, as hex. The first byte is 0x01–0x7f: positive, and never a
   * leading zero, which DER forbids — a serial starting 0x00 is a certificate verifiers refuse.
   */
  static serial(): string {
    const bytes = randomBytes(16);
    bytes[0] = (bytes[0] & 0x7f) || 0x01;
    return bytes.toString('hex');
  }

  static async exportPrivateKey(key: CryptoKey): Promise<string> {
    return EdgeX509.pem('PRIVATE KEY', new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', key)));
  }

  static async importPrivateKey(pem: string): Promise<CryptoKey> {
    return webcrypto.subtle.importKey('pkcs8', EdgeX509.der(pem), EdgeX509.ALGORITHM, false, ['sign']) as Promise<CryptoKey>;
  }

  /** A certificate request for `commonName`, signed with the key it asks a certificate for. */
  static async request(commonName: string, keys: CryptoKeyPair): Promise<string> {
    EdgeX509.engine();
    const csr = new pkijs.CertificationRequest();
    csr.subject = EdgeX509.distinguishedName(commonName);
    await csr.subjectPublicKeyInfo.importKey(keys.publicKey);
    await csr.sign(keys.privateKey, EdgeX509.HASH);
    return EdgeX509.pem('CERTIFICATE REQUEST', new Uint8Array(csr.toSchema().toBER(false)));
  }

  /** The public key a request carries, once its signature proves the requester holds the private key. Null otherwise. */
  static async readRequest(pem: string): Promise<pkijs.PublicKeyInfo | null> {
    EdgeX509.engine();
    try {
      const csr = pkijs.CertificationRequest.fromBER(EdgeX509.der(pem));
      if (!(await csr.verify())) return null;
      const info = csr.subjectPublicKeyInfo;
      // Only the curve this authority issues for: a request for anything else is refused, not converted.
      const curve = (info.algorithm.algorithmParams as asn1js.ObjectIdentifier | undefined)?.valueBlock?.toString();
      return curve === '1.2.840.10045.3.1.7' ? info : null;
    } catch {
      return null;
    }
  }

  /** A signed certificate, as PEM. */
  static async certificate(spec: IEdgeCertificateSpec): Promise<string> {
    EdgeX509.engine();
    const cert = new pkijs.Certificate();
    cert.version = 2;
    cert.serialNumber = new asn1js.Integer({ valueHex: Buffer.from(spec.serial, 'hex') });
    cert.subject = EdgeX509.distinguishedName(spec.subject);
    cert.issuer = EdgeX509.distinguishedName(spec.issuer);
    cert.notBefore.value = spec.notBefore;
    cert.notAfter.value = spec.notAfter;
    if (spec.publicKey instanceof pkijs.PublicKeyInfo) cert.subjectPublicKeyInfo = spec.publicKey;
    else await cert.subjectPublicKeyInfo.importKey(spec.publicKey);

    const keyId = EdgeX509.keyId(cert.subjectPublicKeyInfo);
    const usage = spec.authority
      ? EdgeX509.USAGE.KEY_CERT_SIGN | EdgeX509.USAGE.CRL_SIGN | EdgeX509.USAGE.DIGITAL_SIGNATURE
      : EdgeX509.USAGE.DIGITAL_SIGNATURE;
    const constraints = new pkijs.BasicConstraints(spec.authority ? { cA: true, ...(spec.pathLength !== undefined ? { pathLenConstraint: spec.pathLength } : {}) } : { cA: false });
    const extensions = [
      EdgeX509.extension(EdgeX509.OID.BASIC_CONSTRAINTS, true, constraints.toSchema()),
      EdgeX509.extension(EdgeX509.OID.KEY_USAGE, true, new asn1js.BitString({ valueHex: new Uint8Array([usage]).buffer })),
      EdgeX509.extension(EdgeX509.OID.SUBJECT_KEY_ID, false, new asn1js.OctetString({ valueHex: keyId })),
    ];
    if (spec.issuerKeyId) {
      extensions.push(EdgeX509.extension(EdgeX509.OID.AUTHORITY_KEY_ID, false, new pkijs.AuthorityKeyIdentifier({ keyIdentifier: new asn1js.OctetString({ valueHex: spec.issuerKeyId }) }).toSchema()));
    }
    const purposes = [...(spec.clientAuth ? [EdgeX509.OID.CLIENT_AUTH] : []), ...(spec.serverAuth ? [EdgeX509.OID.SERVER_AUTH] : [])];
    if (purposes.length) extensions.push(EdgeX509.extension(EdgeX509.OID.EXT_KEY_USAGE, false, new pkijs.ExtKeyUsage({ keyPurposes: purposes }).toSchema()));
    const names = [
      ...(spec.uri ? [new pkijs.GeneralName({ type: 6, value: spec.uri })] : []),
      ...(spec.dnsNames ?? []).map((value) => new pkijs.GeneralName({ type: 2, value })),
      ...(spec.ipAddresses ?? []).map((value) => new pkijs.GeneralName({ type: 7, value: new asn1js.OctetString({ valueHex: EdgeX509.ipBytes(value) }) })),
    ];
    if (names.length) extensions.push(EdgeX509.extension(EdgeX509.OID.SUBJECT_ALT_NAME, false, new pkijs.GeneralNames({ names }).toSchema()));
    cert.extensions = extensions;

    await cert.sign(spec.signingKey, EdgeX509.HASH);
    return EdgeX509.pem('CERTIFICATE', new Uint8Array(cert.toSchema().toBER(false)));
  }

  /** The subject key identifier of a certificate (RFC 5280 method 1: SHA-1 of the public key bits). */
  static keyIdOf(certificatePem: string): ArrayBuffer {
    EdgeX509.engine();
    return EdgeX509.keyId(pkijs.Certificate.fromBER(EdgeX509.der(certificatePem)).subjectPublicKeyInfo);
  }

  /**
   * The one certificate `pem` holds, re-encoded from what was parsed — or null when it holds none, more than
   * one, or anything else. A reader that takes the FIRST block of a bundle would check one certificate and
   * let the rest be trusted with it.
   */
  static single(pem: string): string | null {
    const text = String(pem ?? '');
    const blocks = text.match(/-----BEGIN [A-Z0-9 ]+-----/g) ?? [];
    if (blocks.length !== 1 || blocks[0] !== '-----BEGIN CERTIFICATE-----') return null;
    try { return new X509Certificate(text).toString(); } catch { return null; }
  }

  /** `sha256:<hex>` of the one certificate in `pem` — what an edge is given to pin the platform's root. Empty when it is not exactly one. */
  static fingerprint(pem: string): string {
    const single = EdgeX509.single(pem);
    return single ? `sha256:${createHash('sha256').update(new X509Certificate(single).raw).digest('hex')}` : '';
  }

  static pem(label: string, der: Uint8Array): string {
    const body = Buffer.from(der).toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }

  static der(pem: string): ArrayBuffer {
    const body = String(pem ?? '').replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s+/g, '');
    const bytes = Buffer.from(body, 'base64');
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  private static keyId(info: pkijs.PublicKeyInfo): ArrayBuffer {
    const digest = createHash('sha1').update(Buffer.from(info.subjectPublicKey.valueBlock.valueHexView)).digest();
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength) as ArrayBuffer;
  }

  private static distinguishedName(commonName: string): pkijs.RelativeDistinguishedNames {
    return new pkijs.RelativeDistinguishedNames({
      typesAndValues: [new pkijs.AttributeTypeAndValue({ type: EdgeX509.OID.CN, value: new asn1js.Utf8String({ value: commonName }) })],
    });
  }

  private static extension(id: string, critical: boolean, value: asn1js.AsnType): pkijs.Extension {
    return new pkijs.Extension({ extnID: id, critical, extnValue: value.toBER(false) });
  }

  /** An IPv4 or IPv6 address as the 4 or 16 bytes a certificate carries. */
  private static ipBytes(address: string): ArrayBuffer {
    if (isIPv4(address)) return new Uint8Array(address.split('.').map(Number)).buffer;
    if (!isIPv6(address)) throw new Error(`"${address}" is not an IP address.`);
    const [head, tail = ''] = address.split('::');
    const groups = (part: string): string[] => (part ? part.split(':') : []);
    const left = groups(head);
    const right = address.includes('::') ? groups(tail) : [];
    const words = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
    const bytes = new Uint8Array(16);
    words.forEach((word, index) => {
      const value = Number.parseInt(word, 16);
      bytes[index * 2] = value >> 8;
      bytes[index * 2 + 1] = value & 0xff;
    });
    return bytes.buffer;
  }
}
