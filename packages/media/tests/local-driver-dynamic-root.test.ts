import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageDriver } from '@media/drivers/local-driver';

/**
 * The driver's root, resolved when it is USED rather than when it was built.
 *
 * A deployment serving several sites gives each its own subdirectory, and which one applies depends
 * on the request in flight. The driver was constructed at boot — no request — so it captured the
 * shared parent and every site wrote into it for the life of the process.
 *
 * This package knows nothing about sites and must not: it knows only that its root is a question it
 * asks each time, and the caller answers.
 */
describe('LocalStorageDriver — a root that can move', () => {
  let base: string;
  let current: string;
  let driver: LocalStorageDriver;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'local-driver-'));
    current = path.join(base, 'first');
    driver = new LocalStorageDriver(() => current, '/uploads');
  });

  afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

  it('writes into the directory in force at the time of the write', async () => {
    const name = await driver.save(Buffer.from('one'), 'a.txt');
    expect(fs.existsSync(path.join(current, name))).toBe(true);
  });

  it('follows the root when it changes between writes — the per-request case', async () => {
    const first = await driver.save(Buffer.from('one'), 'a.txt');

    current = path.join(base, 'second');
    const second = await driver.save(Buffer.from('two'), 'b.txt');

    expect(fs.existsSync(path.join(base, 'first', first))).toBe(true);
    expect(fs.existsSync(path.join(base, 'second', second))).toBe(true);
    // The point: the second write did NOT land beside the first.
    expect(fs.existsSync(path.join(base, 'first', second))).toBe(false);
  });

  it('reads from the directory in force at the time of the read', async () => {
    const name = await driver.save(Buffer.from('mine'), 'a.txt');

    expect((await driver.read(name)).toString()).toBe('mine');

    current = path.join(base, 'second');
    fs.mkdirSync(current, { recursive: true });
    // Another site's directory does not contain it, and the driver does not go looking in the parent.
    await expect(driver.read(name)).rejects.toThrow();
  });

  it('still accepts a plain string root, for a deployment that has one directory', async () => {
    const fixed = new LocalStorageDriver(path.join(base, 'fixed'), '/uploads');
    const name = await fixed.save(Buffer.from('x'), 'a.txt');

    expect(fs.existsSync(path.join(base, 'fixed', name))).toBe(true);
  });

  it('keeps containment relative to the CURRENT root', async () => {
    // `stream` resolves inside the root or throws. That check has to move with the root, or it would
    // be confining to a directory the caller is no longer using.
    current = path.join(base, 'second');
    fs.mkdirSync(current, { recursive: true });

    await expect(driver.stream('../first/escape.txt')).rejects.toThrow();
  });
});
