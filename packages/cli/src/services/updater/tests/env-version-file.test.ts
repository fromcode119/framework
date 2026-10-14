import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { EnvVersionFile } from '@cli/services/updater/env-version-file';

describe('EnvVersionFile', () => {
  const dirs: string[] = [];
  const make = (content: string, mode: number) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-version-'));
    dirs.push(dir);
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, content);
    fs.chmodSync(file, mode);
    return file;
  };
  afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('changes only the VERSION line and keeps every other line', () => {
    const file = make('COMPOSE_PROJECT_NAME=site\nVERSION=v0.2.391\nINTERNAL_SERVICE_SECRET=abc\n', 0o600);

    new EnvVersionFile(file).write('v0.2.392');

    expect(fs.readFileSync(file, 'utf8')).toBe('COMPOSE_PROJECT_NAME=site\nVERSION=v0.2.392\nINTERNAL_SERVICE_SECRET=abc\n');
    expect(new EnvVersionFile(file).read()).toBe('v0.2.392');
  });

  /** `.env` can hold secrets; the updater runs as root and must not widen who can read it. */
  it('keeps the file\'s own permissions', () => {
    const file = make('VERSION=v0.2.391\nINTERNAL_SERVICE_SECRET=abc\n', 0o600);

    new EnvVersionFile(file).write('v0.2.392');

    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('adds the line when the file has none', () => {
    const file = make('COMPOSE_PROJECT_NAME=site\n', 0o640);

    new EnvVersionFile(file).write('v0.2.392');

    expect(fs.readFileSync(file, 'utf8')).toBe('COMPOSE_PROJECT_NAME=site\nVERSION=v0.2.392\n');
    expect(fs.statSync(file).mode & 0o777).toBe(0o640);
  });

  it('leaves no temporary copy of the file behind', () => {
    const file = make('VERSION=v0.2.391\n', 0o600);

    new EnvVersionFile(file).write('v0.2.392');

    expect(fs.readdirSync(path.dirname(file))).toEqual(['.env']);
  });
});
