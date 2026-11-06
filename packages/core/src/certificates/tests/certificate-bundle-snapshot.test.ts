import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CertificateBundleSnapshot } from '@core/certificates/certificate-bundle-snapshot';

/**
 * The gateway's restart copy of the certificates. An upgrade that restarted every container started
 * the gateway with nothing in memory, and every handshake was refused until the api had booted. The
 * copy holds private keys, so what matters is that it round-trips, is unreadable on disk, and opens
 * only with the deployment's own secret.
 */
describe('CertificateBundleSnapshot', () => {
  const bundle = { certificates: [{ host: 'shop.test', certificatePem: '-----BEGIN CERTIFICATE-----\nAAA', privateKeyPem: '-----BEGIN PRIVATE KEY-----\nBBB' }] };
  let dir = '';
  let saved: string | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-cert-snapshot-'));
    saved = process.env.INTERNAL_SERVICE_SECRET;
    process.env.INTERNAL_SERVICE_SECRET = 'a'.repeat(64);
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.INTERNAL_SERVICE_SECRET; else process.env.INTERNAL_SERVICE_SECRET = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const file = () => path.join(dir, CertificateBundleSnapshot.FILE_NAME);

  it('reads back exactly what was written', () => {
    expect(CertificateBundleSnapshot.write(bundle, dir)).toBe(true);
    expect(CertificateBundleSnapshot.read(dir)).toEqual(bundle);
  });

  it('keeps no key material readable on disk, and the file is private to its owner', () => {
    CertificateBundleSnapshot.write(bundle, dir);
    const raw = fs.readFileSync(file(), 'utf8');
    expect(raw).not.toContain('PRIVATE KEY');
    expect(raw).not.toContain('shop.test');
    expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
  });

  it('opens only with the secret it was written under', () => {
    CertificateBundleSnapshot.write(bundle, dir);
    process.env.INTERNAL_SERVICE_SECRET = 'b'.repeat(64);
    expect(CertificateBundleSnapshot.read(dir)).toBeNull();
  });

  it('writes and reads nothing without a secret', () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    expect(CertificateBundleSnapshot.write(bundle, dir)).toBe(false);
    expect(fs.existsSync(file())).toBe(false);
    expect(CertificateBundleSnapshot.read(dir)).toBeNull();
  });

  it('treats a damaged file as no snapshot', () => {
    fs.writeFileSync(file(), '{"v":1,"iv":"x","tag":"y","data":"z"}');
    expect(CertificateBundleSnapshot.read(dir)).toBeNull();
  });

  it('rewrites only when the bundle changed, and a removed certificate leaves the copy', () => {
    CertificateBundleSnapshot.write(bundle, dir);
    expect(CertificateBundleSnapshot.write(bundle, dir)).toBe(false);
    expect(CertificateBundleSnapshot.write({ certificates: [] }, dir)).toBe(true);
    expect(CertificateBundleSnapshot.read(dir)).toEqual({ certificates: [] });
  });
});
