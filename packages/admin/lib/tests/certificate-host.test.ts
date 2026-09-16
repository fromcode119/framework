import { describe, expect, it } from 'vitest';
import { CertificateHost } from '@/lib/certificates/certificate-host';

/**
 * The "covers *.host" claim must reflect the certificate actually served (`subjectAltNames`), never
 * the operator's INTENT (`source`/`wildcard`). `setSource` flips `wildcard` to true the instant a
 * host is switched to the DNS-01 variant, before any order has run — deriving the claim from intent
 * would show "covers *.host" while the certificate on the wire has no such SAN, which is exactly the
 * kind of unverifiable claim Rule Zero forbids.
 *
 * `isAutomaticHttp01`/`isAutomaticDns01` are the INTENT-based flags the button row uses to decide
 * which Automatic variant to offer — they read `source`/`challenge`, not the certificate.
 */
describe('CertificateHost', () => {
  const raw = (overrides: Record<string, any> = {}) => ({
    host: 'admin.fromcode.com',
    role: 'platform_admin',
    isPlatformHost: true,
    state: 'serving',
    tone: 'positive',
    certificate: {
      source: 'automatic',
      challenge: 'dns-01',
      wildcard: true,
      subjectAltNames: ['admin.fromcode.com'],
      notAfter: '2030-01-01T00:00:00.000Z',
      ...overrides.certificate,
    },
    ...overrides,
  });

  describe('isDnsWildcard — the served certificate, not the intent', () => {
    it('is false when the source/wildcard intent says dns-01 wildcard but the served SANs have no wildcard yet', () => {
      const host = CertificateHost.from(raw());
      expect(host.isPlatformManaged).toBe(true);
      expect(host.challenge).toBe('dns-01');
      // Intent says wildcard, but no *.host SAN has actually been issued yet.
      expect(host.isDnsWildcard).toBe(false);
    });

    it('is true once the served certificate actually carries a wildcard SAN', () => {
      const host = CertificateHost.from(raw({
        certificate: { subjectAltNames: ['admin.fromcode.com', '*.admin.fromcode.com'] },
      }));
      expect(host.isDnsWildcard).toBe(true);
    });

    it('is true from the SAN alone even for a host whose source/wildcard intent has since reverted', () => {
      // A previously-issued wildcard certificate is still being served even after the operator
      // switches the host back to plain Automatic — the served cert has not changed yet.
      const host = CertificateHost.from(raw({
        certificate: { source: 'automatic', challenge: 'http-01', wildcard: false, subjectAltNames: ['admin.fromcode.com', '*.admin.fromcode.com'] },
      }));
      expect(host.isDnsWildcard).toBe(true);
    });

    it('is false for an uploaded certificate with no wildcard SAN', () => {
      const host = CertificateHost.from(raw({
        certificate: { source: 'uploaded', challenge: '', wildcard: false, subjectAltNames: ['admin.fromcode.com'] },
      }));
      expect(host.isDnsWildcard).toBe(false);
    });

    it('is false when the SAN is a wildcard for a DIFFERENT zone than this host, even though it validly covers this host over TLS', () => {
      // A zone-level wildcard cert for example.com (SANs example.com, *.example.com) is valid TLS
      // coverage for shop.example.com, but it carries no `*.shop.example.com` SAN — this row must not
      // claim coverage the certificate does not have.
      const host = CertificateHost.from(raw({
        host: 'shop.example.com',
        certificate: { source: 'uploaded', challenge: '', wildcard: false, subjectAltNames: ['example.com', '*.example.com'] },
      }));
      expect(host.isDnsWildcard).toBe(false);
    });

    it('is true only for the exact *.<host> SAN, not a substring or superstring wildcard', () => {
      const host = CertificateHost.from(raw({
        host: 'shop.example.com',
        certificate: { subjectAltNames: ['shop.example.com', '*.shop.example.com'] },
      }));
      expect(host.isDnsWildcard).toBe(true);
    });
  });

  describe('isAutomaticHttp01 / isAutomaticDns01 — intent, drives which button shows', () => {
    it('a host on plain Automatic (http-01) reports isAutomaticHttp01 and not dns01', () => {
      const host = CertificateHost.from(raw({ certificate: { source: 'automatic', challenge: 'http-01', wildcard: false } }));
      expect(host.isAutomaticHttp01).toBe(true);
      expect(host.isAutomaticDns01).toBe(false);
    });

    it('a host on Automatic (wildcard/dns-01) reports isAutomaticDns01 and not http01', () => {
      const host = CertificateHost.from(raw({ certificate: { source: 'automatic', challenge: 'dns-01', wildcard: true } }));
      expect(host.isAutomaticDns01).toBe(true);
      expect(host.isAutomaticHttp01).toBe(false);
    });

    it('a host not platform-managed at all reports neither', () => {
      const host = CertificateHost.from(raw({ certificate: { source: 'uploaded', challenge: '', wildcard: false } }));
      expect(host.isAutomaticHttp01).toBe(false);
      expect(host.isAutomaticDns01).toBe(false);
    });
  });

  describe('isDnsWildcard and isAutomaticDns01 are independent claims — how obtained vs what is covered', () => {
    it('an UPLOADED wildcard certificate covers *.host but was never obtained via DNS-01', () => {
      // Concrete failure this guards against: hand-pasting a wildcard cert must never render "DNS-01"
      // — that text asserts the platform automated the order, which never happened here.
      const host = CertificateHost.from(raw({
        certificate: { source: 'uploaded', challenge: 'http-01', wildcard: false, subjectAltNames: ['admin.fromcode.com', '*.admin.fromcode.com'] },
      }));
      expect(host.isDnsWildcard).toBe(true);
      expect(host.isAutomaticDns01).toBe(false);
    });

    it('a host newly switched to automatic DNS-01 is isAutomaticDns01 before any order has produced a wildcard SAN', () => {
      const host = CertificateHost.from(raw({
        certificate: { source: 'automatic', challenge: 'dns-01', wildcard: true, subjectAltNames: ['admin.fromcode.com'] },
      }));
      expect(host.isAutomaticDns01).toBe(true);
      expect(host.isDnsWildcard).toBe(false);
    });
  });
});
