import { describe, expect, it } from 'vitest';
import { CertificateBundle } from '@core/certificates/certificate-bundle';

/**
 * A wildcard certificate has to serve the names it covers.
 *
 * Before this, "Automatic (wildcard)" ordered a certificate that really did carry the `*.` SAN and
 * then served only the bare name it was ordered for — so every subdomain still needed its own
 * certificate, and an operator who picked the wildcard got a control that did not do what it said.
 * `CertificateBundle` even documented the opposite ("stored against each host that uses it"), which
 * no code ever carried out.
 *
 * The rules being pinned here are X.509's, not ours: one label deep, and never a substitute for an
 * exact match.
 */
describe('CertificateBundle — a wildcard certificate covers its subdomains', () => {
  const entry = (host: string, wildcard: boolean) => ({
    host,
    certificatePem: `-----BEGIN CERTIFICATE-----${host}-----END CERTIFICATE-----`,
    privateKeyPem: `-----BEGIN PRIVATE KEY-----${host}-----END PRIVATE KEY-----`,
    notAfter: new Date(Date.now() + 86_400_000).toISOString(),
    wildcard,
  });

  const bundle = (...items: Array<Record<string, unknown>>) => CertificateBundle.fromJson({ certificates: items });

  it('serves a subdomain from the wildcard row', () => {
    const found = bundle(entry('fromcode.com', true)).find('console.fromcode.com');

    expect(found?.host).toBe('fromcode.com');
    expect(found?.wildcard).toBe(true);
  });

  it('serves every subdomain from ONE wildcard row', () => {
    const held = bundle(entry('fromcode.com', true));

    for (const host of ['console.fromcode.com', 'api.fromcode.com', 'staging.fromcode.com']) {
      expect(held.find(host)?.host, host).toBe('fromcode.com');
    }
  });

  it('still serves the bare name itself', () => {
    expect(bundle(entry('fromcode.com', true)).find('fromcode.com')?.host).toBe('fromcode.com');
  });

  /** The regression guard: a NON-wildcard row must never answer for anything but itself. */
  it('a non-wildcard certificate covers only its own host', () => {
    const held = bundle(entry('fromcode.com', false));

    expect(held.find('fromcode.com')?.host).toBe('fromcode.com');
    expect(held.find('console.fromcode.com')).toBeUndefined();
  });

  it('an exact row always wins over a wildcard that would also cover it', () => {
    const held = bundle(entry('fromcode.com', true), entry('console.fromcode.com', false));

    expect(held.find('console.fromcode.com')?.host).toBe('console.fromcode.com');
  });

  /** `*.example.com` matches one label. `a.b.example.com` is NOT covered — same as any browser. */
  it('matches one label deep only', () => {
    const held = bundle(entry('fromcode.com', true));

    expect(held.find('a.b.fromcode.com')).toBeUndefined();
  });

  it('never lets a wildcard row answer for an unrelated domain', () => {
    const held = bundle(entry('fromcode.com', true));

    expect(held.find('fromcode.com.evil.test')).toBeUndefined();
    expect(held.find('notfromcode.com')).toBeUndefined();
    expect(held.find('tagiqx.com')).toBeUndefined();
  });

  /**
   * A wildcard row for a public suffix must not be able to answer for everything under it. `com`
   * has no dot of its own, so `parentOf` refuses to climb that far.
   */
  it('never climbs to a bare public suffix', () => {
    const held = bundle(entry('com', true));

    expect(held.find('fromcode.com')).toBeUndefined();
  });

  it('normalises the asked-for name before matching', () => {
    const held = bundle(entry('fromcode.com', true));

    expect(held.find('CONSOLE.FromCode.com')?.host).toBe('fromcode.com');
    expect(held.find('console.fromcode.com.')?.host).toBe('fromcode.com');
    expect(held.find('console.fromcode.com:443')?.host).toBe('fromcode.com');
  });

  it('a name nothing covers is still not served', () => {
    expect(bundle(entry('fromcode.com', true)).find('tagiqx.com')).toBeUndefined();
    expect(bundle().find('anything.test')).toBeUndefined();
  });
});
