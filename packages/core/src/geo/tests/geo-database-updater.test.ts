import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { GeoDatabaseSource } from '@core/geo/geo-database-source';
import { GeoDatabaseStore } from '@core/geo/geo-database-store';
import { GeoDatabaseUpdater } from '@core/geo/geo-database-updater';
import { GeoIpLookup } from '@core/geo/geo-ip-lookup';

/**
 * The IP-location database follows its switch: on keeps a current edition installed, off removes it —
 * so "off" means no location data on the server, and the admin card reports the file's real state.
 */
describe('GeoDatabaseUpdater', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  const setup = (enabled: boolean, published: string[]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-geo-'));
    dirs.push(dir);
    const store = new GeoDatabaseStore(dir);
    const requested: string[] = [];
    const fetcher = (async (url: string) => {
      requested.push(url);
      const edition = /(\d{4}-\d{2})\.mmdb\.gz$/.exec(url)?.[1] ?? '';
      if (!published.includes(edition)) return new Response('not found', { status: 404 });
      return new Response(zlib.gzipSync(Buffer.from(`mmdb ${edition}`)), { status: 200 });
    }) as unknown as typeof fetch;
    const db = { findOne: async () => ({ value: enabled ? 'true' : 'false' }) };
    const logger = { info: () => undefined, error: () => undefined };
    const updater = new GeoDatabaseUpdater(db, logger, store, () => new Date('2026-10-02T08:00:00Z'), fetcher);
    return { store, updater, requested, dir };
  };

  it('installs the current month when it is published', async () => {
    const { store, updater } = setup(true, ['2026-10', '2026-09']);
    const status = await updater.apply();
    expect(status).toMatchObject({ enabled: true, edition: '2026-10', lastError: '' });
    expect(fs.readFileSync(store.databasePath, 'utf8')).toBe('mmdb 2026-10');
    expect(status.source).toEqual(GeoDatabaseSource.attribution());
  });

  it('falls back to last month early in the month — the normal state, not an error', async () => {
    const { store, updater } = setup(true, ['2026-09']);
    const status = await updater.apply();
    expect(status.edition).toBe('2026-09');
    expect(fs.readFileSync(store.databasePath, 'utf8')).toBe('mmdb 2026-09');
    expect(status.lastError).toBe('');
  });

  it('does not download again what is already installed', async () => {
    const { updater, requested } = setup(true, ['2026-10']);
    await updater.apply();
    await updater.apply();
    expect(requested.filter((url) => url.includes('2026-10'))).toHaveLength(1);
  });

  it('removes the database when switched off, and installs nothing', async () => {
    const on = setup(true, ['2026-10']);
    await on.updater.apply();
    const off = new GeoDatabaseUpdater({ findOne: async () => ({ value: 'false' }) }, { info: () => undefined, error: () => undefined }, on.store, () => new Date('2026-10-02T08:00:00Z'));
    const status = await off.apply();
    expect(fs.existsSync(on.store.databasePath)).toBe(false);
    expect(status).toMatchObject({ enabled: false, edition: '', sizeBytes: 0 });
  });

  it('reports a failed update instead of pretending a database exists', async () => {
    const { store, updater } = setup(true, []);
    const status = await updater.apply();
    expect(fs.existsSync(store.databasePath)).toBe(false);
    expect(status.edition).toBe('');
    expect(status.lastError).toMatch(/HTTP 404/);
  });
});

describe('GeoDatabaseSource', () => {
  it('names editions by UTC month and steps back across a year', () => {
    expect(GeoDatabaseSource.editionFor(new Date('2026-01-01T00:30:00Z'))).toBe('2026-01');
    expect(GeoDatabaseSource.previousEdition('2026-01')).toBe('2025-12');
    expect(GeoDatabaseSource.downloadUrl('2026-09')).toBe('https://download.db-ip.com/free/dbip-city-lite-2026-09.mmdb.gz');
    expect(() => GeoDatabaseSource.downloadUrl('../etc')).toThrow(/Invalid geo database edition/);
  });
});

describe('GeoIpLookup', () => {
  it('answers null — never a guess — for a private address or with no database installed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-geo-empty-'));
    try {
      const lookup = new GeoIpLookup(new GeoDatabaseStore(dir));
      expect(lookup.lookup('10.0.0.5')).toBeNull();
      expect(lookup.lookup('192.168.1.10')).toBeNull();
      expect(lookup.lookup('88.99.185.7')).toBeNull();
      expect(lookup.lookup('not an address')).toBeNull();
      expect(lookup.available()).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
