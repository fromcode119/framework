import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The adapter's two jobs for Phase 1: build the CSR with `altNames` only when a wildcard order asks
 * for them (HTTP-01's existing single-name CSR must not change shape), and route DNS-01's challenge
 * create/remove to the injected `IDnsChallengeProvider` instead of `AcmeChallengeStore` — while
 * HTTP-01 keeps using the store exactly as before.
 *
 * The adapter never constructs a concrete DNS provider itself — that is the whole point of this
 * refactor — so these tests inject a plain fake object satisfying `IDnsChallengeProvider` rather
 * than mocking `CloudflareDnsProvider`.
 *
 * `acme-client` is loaded with `await import(...)` inside the adapter, so it is mocked at the module
 * level; `client.auto()` is stubbed to just CALL the two challenge functions once each and return a
 * fixed PEM, which is enough to exercise the create/remove wiring without a real ACME order.
 */

const createCsr = vi.fn(async (options: any) => [{ toString: () => 'PRIVATE_KEY_PEM' }, 'CSR_BYTES', options]);
const autoMock = vi.fn();
const clientCtor = vi.fn();

vi.mock('acme-client', () => ({
  Client: class {
    constructor(options: any) { clientCtor(options); }
    auto = autoMock;
    getAccountUrl() { return 'https://authority.test/account/1'; }
  },
  crypto: {
    createCsr: (options: any) => createCsr(options),
    createPrivateKey: async () => ({ toString: () => 'ACCOUNT_KEY_PEM' }),
  },
}));

const createChallengeRecord = vi.fn(async () => ({ zoneId: 'zone-1', recordId: 'record-1' }));
const removeChallengeRecord = vi.fn(async () => {});

const fakeDnsProvider = { createChallengeRecord, removeChallengeRecord };

import { AcmeChallengeType } from '@core/enums/acme-challenge-type.enum';
import { AcmeClientAdapter } from '@core/certificates/acme/acme-client-adapter';

describe('AcmeClientAdapter', () => {
  const challengeStore = { put: vi.fn(async () => {}), remove: vi.fn(async () => {}) };

  beforeEach(() => {
    vi.clearAllMocks();
    autoMock.mockImplementation(async (opts: any) => {
      const authz = { identifier: { value: 'example.test' } };
      await opts.challengeCreateFn(authz, { token: 'tok-1', url: 'https://authority.test/authz/1/chall/1' }, 'key-auth-1');
      await opts.challengeRemoveFn(authz, { token: 'tok-1', url: 'https://authority.test/authz/1/chall/1' });
      return 'CERT_PEM';
    });
  });

  it('HTTP-01, no altNames: builds the CSR EXACTLY as before (commonName only)', async () => {
    const adapter = new AcmeClientAdapter(challengeStore as any);
    await adapter.issue({
      directoryUrl: 'https://authority.test/directory',
      accountKeyPem: 'ACCOUNT_KEY_PEM',
      host: 'example.test',
    });

    expect(createCsr).toHaveBeenCalledWith({ commonName: 'example.test' });
    expect(autoMock.mock.calls[0][0].challengePriority).toEqual(['http-01']);
  });

  it('HTTP-01 still publishes and withdraws through AcmeChallengeStore, unchanged', async () => {
    const adapter = new AcmeClientAdapter(challengeStore as any);
    await adapter.issue({
      directoryUrl: 'https://authority.test/directory',
      accountKeyPem: 'ACCOUNT_KEY_PEM',
      host: 'example.test',
    });

    expect(challengeStore.put).toHaveBeenCalledWith('tok-1', 'example.test', 'key-auth-1');
    expect(challengeStore.remove).toHaveBeenCalledWith('tok-1');
    expect(createChallengeRecord).not.toHaveBeenCalled();
  });

  it('DNS-01 wildcard: builds the CSR with commonName AND altNames', async () => {
    const adapter = new AcmeClientAdapter(challengeStore as any);
    await adapter.issue({
      directoryUrl: 'https://authority.test/directory',
      accountKeyPem: 'ACCOUNT_KEY_PEM',
      host: 'example.test',
      challengeType: AcmeChallengeType.DNS_01,
      altNames: ['*.example.test'],
      dnsProvider: fakeDnsProvider,
    });

    expect(createCsr).toHaveBeenCalledWith({ commonName: 'example.test', altNames: ['*.example.test'] });
    expect(autoMock.mock.calls[0][0].challengePriority).toEqual(['dns-01']);
  });

  it('DNS-01 routes challenge create/remove to the injected DnsChallengeProvider, at "_acme-challenge.<identifier>", never AcmeChallengeStore', async () => {
    const adapter = new AcmeClientAdapter(challengeStore as any);
    await adapter.issue({
      directoryUrl: 'https://authority.test/directory',
      accountKeyPem: 'ACCOUNT_KEY_PEM',
      host: 'example.test',
      challengeType: AcmeChallengeType.DNS_01,
      altNames: ['*.example.test'],
      dnsProvider: fakeDnsProvider,
    });

    expect(createChallengeRecord).toHaveBeenCalledWith('example.test', '_acme-challenge.example.test', 'key-auth-1');
    expect(removeChallengeRecord).toHaveBeenCalledWith({ zoneId: 'zone-1', recordId: 'record-1' });
    expect(challengeStore.put).not.toHaveBeenCalled();
    expect(challengeStore.remove).not.toHaveBeenCalled();
  });

  it('DNS-01 with no DNS challenge provider injected refuses before ordering anything', async () => {
    const adapter = new AcmeClientAdapter(challengeStore as any);
    await expect(adapter.issue({
      directoryUrl: 'https://authority.test/directory',
      accountKeyPem: 'ACCOUNT_KEY_PEM',
      host: 'example.test',
      challengeType: AcmeChallengeType.DNS_01,
      altNames: ['*.example.test'],
    })).rejects.toThrow(/no DNS challenge provider/i);

    expect(autoMock).not.toHaveBeenCalled();
  });
});
