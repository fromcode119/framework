import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageDriver } from '@media/drivers/local-driver';

/**
 * `read` and `delete` used to `path.join` the caller's path onto the upload directory with no
 * containment, so `delete('../../…')` unlinked any file the api process could write — reachable from a
 * plugin through `context.storage.remove`. They now resolve through the same check `stream` uses.
 */
describe('LocalStorageDriver read/delete containment', () => {
  let root = '';
  let outside = '';
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-local-driver-'));
    await fs.mkdir(path.join(root, 'uploads'), { recursive: true });
    outside = path.join(root, 'secret.env');
    await fs.writeFile(outside, 'KEEP=1');
    driver = new LocalStorageDriver(path.join(root, 'uploads'), '/uploads');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('refuses to delete a file outside the upload directory, and leaves it in place', async () => {
    await expect(driver.delete('../secret.env')).rejects.toThrow(/escapes the storage directory/);
    await expect(fs.readFile(outside, 'utf8')).resolves.toBe('KEEP=1');
  });

  it('refuses to read a file outside the upload directory', async () => {
    await expect(driver.read('../secret.env')).rejects.toThrow(/escapes the storage directory/);
  });

  it('still reads and deletes its own files, with or without the public prefix', async () => {
    const stored = await driver.save(Buffer.from('mine'), 'notes.txt');

    expect((await driver.read(`/uploads/${stored}`)).toString('utf8')).toBe('mine');
    await driver.delete(stored);
    await expect(fs.access(path.join(root, 'uploads', stored))).rejects.toThrow();
  });
});
