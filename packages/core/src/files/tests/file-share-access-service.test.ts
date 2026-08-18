import { describe, it, expect, beforeEach } from 'vitest';
import { FileShareAccessService } from '@core/files/file-share-access-service';
import { FileGrantRepository } from '@core/files/file-grant-repository';
import { GrantTokenService } from '@core/security/grant-token-service';
import { GrantOutcome } from '@core/security/enums/grant-outcome.enum';

/**
 * The property under test: a caller who is not entitled learns nothing, and a valid token opens exactly
 * the files in ITS share — never the media library at large.
 */
describe('FileShareAccessService', () => {
  const RAW = 'a'.repeat(64);
  let rows: { grants: any[]; shares: any[]; media: any[] };
  let service: FileShareAccessService;

  const db = {
    findOne: async (table: string, where: any) => {
      if (table.includes('file_grants')) return rows.grants.find((g) => g.token_hash === where.token_hash) || null;
      if (table.includes('file_shares')) return rows.shares.find((s) => s.id === where.id) || null;
      if (table === 'media') return rows.media.find((m) => m.id === where.id) || null;
      return null;
    },
    find: async () => [],
    insert: async () => ({ id: 1 }),
    update: async () => ({ id: 1 }),
  } as any;

  beforeEach(() => {
    rows = {
      grants: [{
        id: 1, share_id: 1, email: 'a@b.c', user_id: null,
        token_hash: GrantTokenService.hash(RAW),
        expires_at: null, max_downloads: 0, download_count: 0,
        require_confirmation: 0, require_account: 0, revoked_at: null,
      }],
      shares: [{ id: 1, title: 'Handbook', message: 'Enjoy', media_ids: JSON.stringify([10, 11]) }],
      media: [
        { id: 10, original_name: 'a.pdf', path: 'a.pdf', visibility: 'private', file_size: 5, mime_type: 'application/pdf' },
        { id: 11, original_name: 'b.pdf', path: 'b.pdf', visibility: 'private', file_size: 7, mime_type: 'application/pdf' },
        { id: 99, original_name: 'secret.pdf', path: 'secret.pdf', visibility: 'private', file_size: 9, mime_type: 'application/pdf' },
      ],
    };
    service = new FileShareAccessService(db, new FileGrantRepository(db));
  });

  it('opens a valid token and lists its files', async () => {
    const result = await service.resolveForView(RAW, null);
    expect(result.outcome).toBe(GrantOutcome.GRANTED);
    expect(result.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('returns NO files on every refusal', async () => {
    // This is the disclosure rule expressed as a test: a dead link must not reveal what it held.
    const cases: Array<[string, any]> = [
      ['revoked', { revoked_at: '2026-01-01T00:00:00.000Z' }],
      ['expired', { expires_at: '2020-01-01T00:00:00.000Z' }],
      ['over limit', { max_downloads: 1, download_count: 1 }],
    ];

    for (const [, patch] of cases) {
      rows.grants[0] = { ...rows.grants[0], ...patch };
      const result = await service.resolveForView(RAW, null);
      expect(result.outcome.isGranted).toBe(false);
      expect(result.files).toEqual([]);
      expect(result.share).toBeNull();
    }
  });

  it('reads an unknown token as UNKNOWN without touching shares', async () => {
    const result = await service.resolveForView('b'.repeat(64), null);
    expect(result.outcome).toBe(GrantOutcome.UNKNOWN);
    expect(result.grant).toBeNull();
    expect(result.files).toEqual([]);
  });

  it('refuses a file that belongs to a DIFFERENT share', async () => {
    // Without this the media id beside a valid token would be a key to the whole library.
    const result = await service.resolveForDownload(RAW, 99, null);
    expect(result.outcome).toBe(GrantOutcome.UNKNOWN);
    expect(result.files).toEqual([]);
  });

  it('narrows a download to the single requested file', async () => {
    const result = await service.resolveForDownload(RAW, 11, null);
    expect(result.outcome).toBe(GrantOutcome.GRANTED);
    expect(result.files.map((f) => f.id)).toEqual([11]);
  });

  it('requires the matching signed-in address when the grant demands an account', async () => {
    rows.grants[0].require_account = 1;

    expect((await service.resolveForView(RAW, null)).outcome).toBe(GrantOutcome.ACCOUNT_REQUIRED);
    expect((await service.resolveForView(RAW, 'someone@else.com')).outcome).toBe(GrantOutcome.ACCOUNT_REQUIRED);
    expect((await service.resolveForView(RAW, 'A@B.C')).outcome).toBe(GrantOutcome.GRANTED);
  });

  it('withholds until the emailed code is confirmed when the grant demands it', async () => {
    rows.grants[0].require_confirmation = 1;

    expect((await service.resolveForView(RAW, null)).outcome).toBe(GrantOutcome.CONFIRMATION_REQUIRED);
    expect((await service.resolveForView(RAW, null, [1])).outcome).toBe(GrantOutcome.GRANTED);
  });

  it('treats a share deleted out from under its grant as unknown', async () => {
    rows.shares = [];
    const result = await service.resolveForView(RAW, null);
    expect(result.outcome).toBe(GrantOutcome.UNKNOWN);
    expect(result.files).toEqual([]);
  });

  it('skips missing media rather than inventing entries', async () => {
    rows.shares[0].media_ids = JSON.stringify([10, 404]);
    const result = await service.resolveForView(RAW, null);
    expect(result.files.map((f) => f.id)).toEqual([10]);
  });

  it('survives a corrupt media list instead of throwing', async () => {
    rows.shares[0].media_ids = 'not json';
    const result = await service.resolveForView(RAW, null);
    expect(result.outcome).toBe(GrantOutcome.GRANTED);
    expect(result.files).toEqual([]);
  });
});
