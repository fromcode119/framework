import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { DatabaseFactory } from '@fromcode119/database';
import { EdgeIdentityMigration } from '@core/database/migrations/074_edge_identity';
import { EdgeCertificateAuthority } from '@core/security/edge/identity/edge-certificate-authority';
import { EdgeEnrollmentService } from '@core/security/edge/identity/edge-enrollment-service';
import { EdgeIdentityPolicy } from '@core/security/edge/identity/edge-identity-policy';
import { EdgeX509 } from '@core/security/edge/identity/edge-x509';

/** The authority and enrollment on a real database, with time under the test's control. */
describe('EdgeEnrollmentService', () => {
  let file = '';
  let db: any;
  let now = Date.parse('2026-11-24T10:00:00Z');
  const policy = () => new EdgeIdentityPolicy('platform.test', 10, 24, 30);
  const previousKey = process.env.SECRET_KEY;

  beforeEach(async () => {
    process.env.SECRET_KEY = 'test-secret-key-for-edge-identity-0123456789';
    now = Date.parse('2026-11-24T10:00:00Z');
    file = path.join(os.tmpdir(), `fromcode-edge-identity-${Date.now()}-${Math.random()}.db`);
    db = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    await new EdgeIdentityMigration().up(db);
  });
  afterEach(async () => {
    await db.disconnect?.();
    fs.rmSync(file, { force: true });
    process.env.SECRET_KEY = previousKey;
  });

  const services = () => {
    const authority = new EdgeCertificateAuthority(db, policy, () => now);
    return { authority, enrollment: new EdgeEnrollmentService(db, authority, policy, () => now) };
  };
  const requestFor = async () => {
    const keys = await EdgeX509.generateKeyPair();
    return EdgeX509.request('edge', keys);
  };

  it('enrolls once with a token, issues a 24-hour certificate with the identity, and verifies it per connection', async () => {
    const { enrollment } = services();
    const { edge, token } = await enrollment.add('Relay EU', 'ops@example.test');
    const issued = await enrollment.enroll(token, await requestFor(), { address: '198.51.100.9', version: '0.2.700' });
    expect(issued).not.toBeNull();
    const certificate = new X509Certificate(issued!.certificatePem);
    expect(certificate.subjectAltName).toBe(`URI:spiffe://platform.test/edge/${edge.id}`);
    expect(Date.parse(certificate.validTo) - now).toBe(24 * 3_600_000);
    expect(certificate.verify(new X509Certificate(issued!.chainPem).publicKey)).toBe(true);
    expect(new X509Certificate(issued!.chainPem).verify(new X509Certificate(issued!.trustPem).publicKey)).toBe(true);
    expect((await enrollment.verify(certificate.serialNumber))?.id).toBe(edge.id);
    expect((await enrollment.find(edge.id))).toMatchObject({ lastAddress: '198.51.100.9', version: '0.2.700' });

    // Spent: the same token never works twice.
    expect(await enrollment.enroll(token, await requestFor(), {})).toBeNull();
  });

  it('refuses an expired token, an unknown one, and a forged request', async () => {
    const { enrollment } = services();
    const { token } = await enrollment.add('Relay', 'ops');
    expect(await enrollment.enroll('not-a-token', await requestFor(), {})).toBeNull();
    expect(await enrollment.enroll(token, 'garbage', {})).toBeNull();
    now += 11 * 60_000;
    expect(await enrollment.enroll(token, await requestFor(), {})).toBeNull();
  });

  it('removing an edge refuses its certificate at once, its renewal, and its unused token', async () => {
    const { enrollment } = services();
    const { edge, token } = await enrollment.add('Relay', 'ops');
    const issued = await enrollment.enroll(token, await requestFor(), {});
    const serial = new X509Certificate(issued!.certificatePem).serialNumber;
    const fresh = await enrollment.reissueToken(edge.id);
    expect(await enrollment.revoke(edge.id, 'ops')).toBe(true);
    expect(await enrollment.verify(serial)).toBeNull();
    expect(await enrollment.renew(edge.id, await requestFor(), {})).toBeNull();
    expect(await enrollment.enroll(fresh!.token, await requestFor(), {})).toBeNull();
    expect(await enrollment.revoke(edge.id, 'ops')).toBe(false);
  });

  it('renews with a new key, and the old certificate stops verifying once it runs out', async () => {
    const { enrollment } = services();
    const { edge, token } = await enrollment.add('Relay', 'ops');
    const first = await enrollment.enroll(token, await requestFor(), {});
    now += 12 * 3_600_000;
    const second = await enrollment.renew(edge.id, await requestFor(), {});
    expect(second).not.toBeNull();
    now += 13 * 3_600_000;
    expect(await enrollment.verify(new X509Certificate(first!.certificatePem).serialNumber)).toBeNull();
    expect((await enrollment.verify(new X509Certificate(second!.certificatePem).serialNumber))?.id).toBe(edge.id);
  });

  it('rotates the working certificate on schedule and still trusts what the previous one signed', async () => {
    const { authority, enrollment } = services();
    const { edge, token } = await enrollment.add('Relay', 'ops');
    const before = await enrollment.enroll(token, await requestFor(), {});
    const firstWorking = before!.chainPem;
    now += 30 * 86_400_000 + 1;
    const after = await enrollment.renew(edge.id, await requestFor(), {});
    expect(after!.chainPem).not.toBe(firstWorking);
    // One root throughout: everything either working certificate signed chains to it.
    expect(after!.trustPem).toBe(before!.trustPem);
    const root = new X509Certificate(after!.trustPem);
    expect(new X509Certificate(firstWorking).verify(root.publicKey)).toBe(true);
    expect(Date.parse(new X509Certificate(firstWorking).validTo)).toBeGreaterThan(now + 24 * 3_600_000);
    expect((await authority.describe()).workingSince).toBe(new Date(now - 5 * 60_000).toISOString());
  });

  it('two processes creating the authority at once end with one root', async () => {
    const one = services();
    const two = services();
    await Promise.all([one.authority.trustBundle(), two.authority.trustBundle()]);
    expect(await one.authority.trustBundle()).toBe(await two.authority.trustBundle());
    const roots = await db.count("_system_edge_ca", { where: { kind: "root", retired_at: null } });
    expect(roots).toBe(1);
  });

  it('never stores a key it cannot encrypt', async () => {
    delete process.env.SECRET_KEY;
    delete process.env.INTEGRATION_SECRET_KEY;
    await expect(services().authority.trustBundle()).rejects.toThrow(/SECRET_KEY/);
  });

  it('refuses a policy whose working certificate would not outlive two edge certificates', () => {
    expect(() => EdgeIdentityPolicy.from(new Map([['edge_certificate_hours', '24'], ['edge_ca_intermediate_days', '1']]), 'platform.test')).toThrow(/twice/);
    expect(() => EdgeIdentityPolicy.from(new Map(), '')).toThrow(/API/);
    expect(EdgeIdentityPolicy.from(new Map(), 'Platform.Test')).toMatchObject({ trustDomain: 'platform.test', tokenMinutes: 10, certificateHours: 24, intermediateDays: 30 });
  });
});
