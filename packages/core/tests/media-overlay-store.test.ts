import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { MediaOverlayStore } from '@core/media/media-overlay-store';
import { MediaOverlayContext } from '@core/plugin/context/media-overlay';

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
});
