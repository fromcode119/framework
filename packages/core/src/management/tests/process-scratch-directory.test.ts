import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProcessScratchDirectory } from '@core/management/process-scratch-directory';

describe('ProcessScratchDirectory', () => {
  const created: string[] = [];
  const track = (dir: string): string => {
    created.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('makes folders inside this run and keeps them through a sweep', () => {
    const dir = ProcessScratchDirectory.make('upload-');
    fs.writeFileSync(path.join(dir, 'chunk'), 'x');

    ProcessScratchDirectory.sweepStale();

    expect(path.dirname(path.dirname(dir))).toBe(ProcessScratchDirectory.ROOT);
    expect(fs.existsSync(path.join(dir, 'chunk'))).toBe(true);
  });

  it('removes a previous run of this same pid and a run whose process is gone', () => {
    const previous = track(path.join(ProcessScratchDirectory.ROOT, `${process.pid}-1`));
    const dead = track(path.join(ProcessScratchDirectory.ROOT, '2147483646-1'));
    fs.mkdirSync(previous, { recursive: true });
    fs.mkdirSync(dead, { recursive: true });

    ProcessScratchDirectory.sweepStale();

    expect(fs.existsSync(previous)).toBe(false);
    expect(fs.existsSync(dead)).toBe(false);
  });

  it('keeps the run folder of another live process', () => {
    const sibling = track(path.join(ProcessScratchDirectory.ROOT, `${process.ppid}-1`));
    fs.mkdirSync(sibling, { recursive: true });

    ProcessScratchDirectory.sweepStale();

    expect(fs.existsSync(sibling)).toBe(true);
  });

  it('removes old folders written by the previous layout, but not recent ones', () => {
    const old = track(path.join(os.tmpdir(), 'fromcode-tenant-import-chunks-oldtest'));
    const recent = track(path.join(os.tmpdir(), 'fromcode-tenant-import-chunks-newtest'));
    fs.mkdirSync(old, { recursive: true });
    fs.mkdirSync(recent, { recursive: true });
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fs.utimesSync(old, twoDaysAgo, twoDaysAgo);

    ProcessScratchDirectory.sweepStale();

    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  });
});
