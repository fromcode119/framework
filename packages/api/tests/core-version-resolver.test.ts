import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreVersionResolver } from '@api/server/core-version-resolver';

/**
 * `/health` reports the engine version a process is serving. It is read from the root manifest on every
 * call so a core update shows without a restart, and parsed again only when the file has changed.
 */
describe('CoreVersionResolver', () => {
  const dirs: string[] = [];
  const project = (version: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-version-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@fromcode119/framework', version }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    return dir;
  };
  afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('reports the manifest version', () => {
    project('9.9.9');
    expect(CoreVersionResolver.resolve()).toBe('9.9.9');
  });

  it('follows a manifest that changed after it was first read', () => {
    const dir = project('1.0.0');
    expect(CoreVersionResolver.resolve()).toBe('1.0.0');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@fromcode119/framework', version: '1.0.10' }));
    expect(CoreVersionResolver.resolve()).toBe('1.0.10');
  });

  it('reads the file once while it stays as it is', () => {
    project('2.0.0');
    const parse = vi.spyOn(JSON, 'parse');
    for (let i = 0; i < 5; i += 1) expect(CoreVersionResolver.resolve()).toBe('2.0.0');
    expect(parse.mock.calls.filter(([text]) => String(text).includes('"version":"2.0.0"'))).toHaveLength(1);
  });

  it('answers 0.0.0 when no manifest is there, and recovers when one appears', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-version-'));
    dirs.push(dir);
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    expect(CoreVersionResolver.resolve()).toBe('0.0.0');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@fromcode119/framework', version: '3.1.4' }));
    expect(CoreVersionResolver.resolve()).toBe('3.1.4');
  });
});
