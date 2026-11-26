import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StackImagePackages } from '@cli/services/stack/stack-image-packages';

describe('StackImagePackages', () => {
  it('names a package without its range, scoped or not', () => {
    expect(StackImagePackages.nameOf('@zxing/browser@^0.2.1')).toBe('@zxing/browser');
    expect(StackImagePackages.nameOf('zod@3.1.0')).toBe('zod');
    expect(StackImagePackages.nameOf('zod')).toBe('zod');
  });

  it('lists only what the container does not have', () => {
    const declared = ['@zxing/browser@^0.2.1', 'zod@^3', 'react@^19'];
    expect(StackImagePackages.missing(declared, new Set(['zod', 'react']))).toEqual(['@zxing/browser@^0.2.1']);
    expect(StackImagePackages.missing(declared, new Set(['zod', 'react', '@zxing/browser']))).toEqual([]);
  });
  it('counts what a workspace package the app uses declares, not only the app itself', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-packages-'));
    const write = (name: string, dependencies: Record<string, string>) => {
      fs.mkdirSync(path.join(root, 'packages', name), { recursive: true });
      fs.writeFileSync(path.join(root, 'packages', name, 'package.json'), JSON.stringify({ dependencies }));
    };
    write('api', { '@fromcode119/core': '*', express: '^5' });
    write('core', { '@fromcode119/database': '*', pkijs: '4.0.1', '@fromcode119/api': '*' });
    write('database', { pg: '^8', local: 'file:../x' });
    expect(StackImagePackages.declaredBy(root, 'api').sort()).toEqual(['express@^5', 'pg@^8', 'pkijs@4.0.1']);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it('looks beside every workspace package that declares one, not only at the root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-folders-'));
    const write = (name: string, dependencies: Record<string, string>) => {
      fs.mkdirSync(path.join(root, 'packages', name), { recursive: true });
      fs.writeFileSync(path.join(root, 'packages', name, 'package.json'), JSON.stringify({ dependencies }));
    };
    write('api', { '@fromcode119/core': '*' });
    write('core', { pkijs: '4.0.1' });
    expect(StackImagePackages.foldersOf(root, 'api', 'pkijs@4.0.1')).toEqual(['/app/node_modules/pkijs', '/app/packages/core/node_modules/pkijs']);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
