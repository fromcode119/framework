import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { MediaOverlayStore } from '@core/media/media-overlay-store';
import { MediaOverlayContext } from '@core/plugin/context/media-overlay';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

const SPEC = { overlayMediaId: '7', position: 'bottom-right', opacityPercent: 40, sizePercent: 20, marginPercent: 3 };

class MemoryMeta {
  rows = new Map<string, string>();
  async findOne(_table: string, where: Record<string, unknown>) {
    const value = this.rows.get(String(where.key));
    return value === undefined ? null : { key: where.key, value };
  }
  async insert(_table: string, data: Record<string, unknown>) { this.rows.set(String(data.key), String(data.value)); }
  async update(_table: string, where: Record<string, unknown>, data: Record<string, unknown>) { this.rows.set(String(where.key), String(data.value)); }
  async delete(_table: string, where: Record<string, unknown>) { this.rows.delete(String(where.key)); }
}

describe('MediaOverlayStore', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-store-'));
    vi.spyOn(ProjectPaths, 'getDataDir').mockReturnValue(root);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('gives the same spec the same hash and any change a new one', () => {
    expect(MediaOverlayStore.hash(SPEC)).toBe(MediaOverlayStore.hash({ ...SPEC }));
    expect(MediaOverlayStore.hash(SPEC)).not.toBe(MediaOverlayStore.hash({ ...SPEC, opacityPercent: 41 }));
    expect(MediaOverlayStore.hash(SPEC)).toMatch(/^[a-f0-9]{16}$/);
  });

  it('stores the spec and drops every cached image when it changes or is switched off', async () => {
    const meta = new MemoryMeta();
    const store = new MediaOverlayStore(meta as never);
    await store.write('shop', SPEC);
    expect(await store.read('shop')).toEqual(SPEC);

    const cached = MediaOverlayStore.cacheFile('shop', MediaOverlayStore.hash(SPEC), '12');
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, 'x');

    await store.write('shop', { ...SPEC });
    expect(fs.existsSync(cached)).toBe(true);

    await store.write('shop', { ...SPEC, position: 'center' });
    expect(fs.existsSync(cached)).toBe(false);

    await store.write('shop', null);
    expect(await store.read('shop')).toBeNull();
  });

  it('refuses an owner that is not one path segment', () => {
    expect(() => MediaOverlayStore.cacheFile('../x', 'a', '1')).toThrow();
  });

  it('clamps the numbers and requires a media id', () => {
    expect(MediaOverlayContext.normalize({ ...SPEC, opacityPercent: 140, sizePercent: 0, marginPercent: -2 })).toMatchObject({ opacityPercent: 100, sizePercent: 1, marginPercent: 0 });
    expect(() => MediaOverlayContext.normalize({ ...SPEC, overlayMediaId: '' })).toThrow();
  });

  it('keeps a day to start from, and drops one that is not a date', () => {
    expect(MediaOverlayContext.normalize({ ...SPEC, uploadedFrom: '2026-11-05' }).uploadedFrom).toBe('2026-11-05');
    expect(MediaOverlayContext.normalize({ ...SPEC, uploadedFrom: 'soon' })).not.toHaveProperty('uploadedFrom');
    expect(MediaOverlayStore.hash(SPEC)).not.toBe(MediaOverlayStore.hash({ ...SPEC, uploadedFrom: '2026-11-05' }));
  });

  it('marks only images uploaded on or after the stated day', async () => {
    vi.spyOn(SiteBaseUrl, 'apiUrlForCurrentSite').mockImplementation(async (p: string) => `https://shop.test${p}`);
    const media = [
      { id: 1, visibility: 'public', mime_type: 'image/jpeg', created_at: '2026-11-04T23:59:59Z' },
      { id: 2, visibility: 'public', mime_type: 'image/jpeg', created_at: '2026-11-05T00:00:00Z' },
      { id: 3, visibility: 'public', mime_type: 'image/png', created_at: new Date('2026-12-01T10:00:00Z') },
    ];
    const meta = new MemoryMeta();
    const db = Object.assign(meta, { find: async () => media });
    const context = new MediaOverlayContext({ db } as never, 'shop');
    const all = await context.urls([1, 2, 3], SPEC);
    expect([...all.keys()]).toEqual(['1', '2', '3']);
    const recent = await context.urls([1, 2, 3], { ...SPEC, uploadedFrom: '2026-11-05' });
    expect([...recent.keys()]).toEqual(['2', '3']);
  });
});
