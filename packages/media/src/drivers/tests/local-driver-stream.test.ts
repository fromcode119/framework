import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageDriver } from '@media/drivers/local-driver';

/**
 * These cover the read-back path a PRIVATE, entitlement-gated route depends on. The traversal case is
 * the point of the suite: everything else in this package resolves paths it wrote itself, so containment
 * was never load-bearing until bytes started being served to strangers.
 */
describe('LocalStorageDriver.stream', () => {
  let root = '';
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-local-driver-'));
    await fs.mkdir(path.join(root, 'uploads'), { recursive: true });
    driver = new LocalStorageDriver(path.join(root, 'uploads'), '/uploads');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function collect(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }

  it('streams the stored bytes back', async () => {
    const stored = await driver.save(Buffer.from('private payload'), 'notes.txt');
    expect(await collect(await driver.stream(stored))).toBe('private payload');
  });

  it('accepts a path carrying the public prefix, as read() does', async () => {
    const stored = await driver.save(Buffer.from('prefixed'), 'notes.txt');
    expect(await collect(await driver.stream(`/uploads/${stored}`))).toBe('prefixed');
  });

  it('refuses a path that escapes the storage directory', async () => {
    await fs.writeFile(path.join(root, 'outside.txt'), 'do not serve me');
    await expect(driver.stream('../outside.txt')).rejects.toThrow(/escapes the storage directory/);
  });

  it('refuses an escape hidden behind a public prefix', async () => {
    await fs.writeFile(path.join(root, 'outside.txt'), 'do not serve me');
    await expect(driver.stream('/uploads/../../outside.txt')).rejects.toThrow(/escapes the storage directory/);
  });

  it('rejects a missing file before the caller can commit headers', async () => {
    await expect(driver.stream('never-written.txt')).rejects.toThrow();
  });
});
