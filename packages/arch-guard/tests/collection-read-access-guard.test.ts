import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionReadAccessGuard } from '../src/collection-read-access-guard';

describe('CollectionReadAccessGuard', () => {
  let dir: string;
  let output: string[];

  const collection = (name: string, access: string) => `export class ${name} {
  static readonly slug = 'fcp_demo_${name}' as const;
${access}
  static readonly fields = [{ name: 'title', type: 'text' }];
}
`;

  const write = (file: string, body: string) => {
    const target = path.join(dir, 'demo', 'src', 'collections', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-access-'));
    process.env.PLUGINS_DIR = dir;
    output = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => { output.push(String(line)); });
  });

  afterEach(() => {
    delete process.env.PLUGINS_DIR;
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('passes collections that declare read, however it is written', () => {
    write('a.ts', collection('A', '  static readonly access = { read: true } as const;'));
    write('b.ts', collection('B', '  static readonly access = { read: ({ user }) => !!user, update: false } as const;'));
    write('c.ts', collection('C', '  static readonly access = SharedAccess.public;'));
    expect(CollectionReadAccessGuard.run()).toBe(0);
    expect(output.join('\n')).toContain('Scanned 3 non-system');
  });

  it('flags a collection with no access, and one whose access has no read', () => {
    write('a.ts', collection('A', ''));
    write('b.ts', collection('B', '  static readonly access = { update: false } as const;'));
    write('ok.ts', collection('Ok', '  static readonly access = { read: true } as const;'));
    expect(CollectionReadAccessGuard.run()).toBe(1);
    const text = output.join('\n');
    expect(text).toContain('2 collection(s) without access.read');
    expect(text).toContain('a.ts');
    expect(text).toContain('b.ts');
    expect(text).not.toContain('ok.ts');
  });

  it('ignores classes that are not collections', () => {
    write('settings.ts', "export class S { static readonly fields = [{ name: 'x' }]; }");
    expect(CollectionReadAccessGuard.run()).toBe(0);
    expect(output.join('\n')).toContain('Scanned 0');
  });
});
