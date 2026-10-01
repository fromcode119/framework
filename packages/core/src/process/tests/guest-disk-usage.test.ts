import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuestDiskUsage } from '@core/process/guest-disk-usage';

/** A plugin's disk is every file its own user owns — in its data dir and in the places anyone may write. */
describe('GuestDiskUsage', () => {
  const roots: string[] = [];
  const temp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-disk-')); roots.push(dir); return dir; };
  const uid = process.getuid?.() ?? 0;
  afterEach(() => { vi.restoreAllMocks(); while (roots.length) fs.rmSync(roots.pop() as string, { recursive: true, force: true }); });

  it('adds up the bytes and files its user owns, nested folders included', () => {
    const dir = temp();
    fs.writeFileSync(path.join(dir, 'a.bin'), Buffer.alloc(1000));
    fs.mkdirSync(path.join(dir, 'deep', 'er'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'deep', 'er', 'b.bin'), Buffer.alloc(2500));
    vi.spyOn(GuestDiskUsage, 'SHARED_DIRS', 'get').mockReturnValue([]);
    expect(GuestDiskUsage.measure(uid, [dir])).toEqual({ bytes: 3500, files: 2 });
  });

  it('does not count what another user owns', () => {
    const dir = temp();
    fs.writeFileSync(path.join(dir, 'a.bin'), Buffer.alloc(1000));
    vi.spyOn(GuestDiskUsage, 'SHARED_DIRS', 'get').mockReturnValue([]);
    expect(GuestDiskUsage.measure(uid + 1, [dir])).toEqual({ bytes: 0, files: 0 });
  });

  it('does not follow a symlink out of its folder', () => {
    const outside = temp();
    fs.writeFileSync(path.join(outside, 'big.bin'), Buffer.alloc(50_000));
    const dir = temp();
    fs.symlinkSync(outside, path.join(dir, 'link'));
    vi.spyOn(GuestDiskUsage, 'SHARED_DIRS', 'get').mockReturnValue([]);
    expect(GuestDiskUsage.measure(uid, [dir])).toEqual({ bytes: 0, files: 0 });
  });

  it('counts what it left in the shared places too', () => {
    const shared = temp();
    fs.writeFileSync(path.join(shared, 'left-behind.tmp'), Buffer.alloc(700));
    vi.spyOn(GuestDiskUsage, 'SHARED_DIRS', 'get').mockReturnValue([shared]);
    expect(GuestDiskUsage.measure(uid, [])).toEqual({ bytes: 700, files: 1 });
  });
});

describe('GuestDiskUsage.removeShared', () => {
  const roots: string[] = [];
  const uid = process.getuid?.() ?? 0;
  afterEach(() => { vi.restoreAllMocks(); while (roots.length) fs.rmSync(roots.pop() as string, { recursive: true, force: true }); });

  it('removes what the user left in the shared places, including folders it made, and nothing of anyone else', () => {
    const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-shared-'));
    roots.push(shared);
    fs.writeFileSync(path.join(shared, 'left.bin'), Buffer.alloc(10));
    fs.mkdirSync(path.join(shared, 'its-own-dir'));
    fs.writeFileSync(path.join(shared, 'its-own-dir', 'x'), 'x');
    vi.spyOn(GuestDiskUsage, 'SHARED_DIRS', 'get').mockReturnValue([shared]);
    expect(GuestDiskUsage.removeShared(uid + 1)).toBe(0);
    expect(fs.readdirSync(shared).sort()).toEqual(['its-own-dir', 'left.bin']);
    expect(GuestDiskUsage.removeShared(uid)).toBe(2);
    expect(fs.readdirSync(shared)).toEqual([]);
  });
});
