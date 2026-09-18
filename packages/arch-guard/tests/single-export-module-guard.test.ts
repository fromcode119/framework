import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SingleExportModuleGuard } from '../src/single-export-module-guard';

describe('SingleExportModuleGuard.scan', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  /** A throwaway package: package.json + src/<fileName>, scanned as one root. */
  const scanPackage = (fileName: string, source: string, packageJson: Record<string, unknown> = { name: 'pkg' }) => {
    dir = mkdtempSync(path.join(tmpdir(), 'single-export-module-guard-'));
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(packageJson), 'utf8');
    writeFileSync(path.join(dir, 'src', fileName), source, 'utf8');
    return SingleExportModuleGuard.scan([{ area: 'test', dir }]);
  };

  it('is clean for an interface file with only the interface', () => {
    const { offenders } = scanPackage('foo.interface.ts', 'export interface IFoo { run(): void; }');
    expect(offenders).toEqual([]);
  });

  it('flags an interface file that also exports something else', () => {
    const { offenders } = scanPackage('ref.decorator.ts', `
      export interface Ref<T> { current: T | null; }
      export function ref(): void {}
    `);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].exports.map((e) => e.kind)).toEqual(['interface', 'function']);
  });

  it('flags a *.interface.ts file that exports a class instead of an interface', () => {
    const { offenders } = scanPackage('marketplace-plugin.interface.ts', 'export class MarketplacePlugin { declare slug: string; }');
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/must export an interface, found a class/);
  });

  it('is clean for an enum-pattern file with one class extending Enum', () => {
    const { offenders } = scanPackage('status.enum.ts', `
      import { Enum } from '@fromcode119/reactor';
      export class Status extends Enum {
        static readonly ACTIVE = new Status('active');
      }
    `);
    expect(offenders).toEqual([]);
  });

  it('is clean for a class module with exactly one class', () => {
    const { offenders } = scanPackage('service.ts', 'export class SomeService { run(): void {} }');
    expect(offenders).toEqual([]);
  });

  it('flags a class module with a class and an interface (the original case)', () => {
    const { offenders } = scanPackage('plugin-sandbox-host-reload-service.ts', `
      export interface IPluginSandboxHostAccess { get(slug: string): unknown | null; }
      export class PluginSandboxHostReloadService { apply(): void {} }
    `);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].exports).toEqual(expect.arrayContaining([
      { kind: 'interface', name: 'IPluginSandboxHostAccess' },
      { kind: 'class', name: 'PluginSandboxHostReloadService' },
    ]));
  });

  it('flags a class module with multiple classes', () => {
    const { offenders } = scanPackage('manifest.ts', `
      export class PluginManifestSchema {}
      export class RegistryPluginSchema {}
    `);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].exports).toHaveLength(2);
  });

  it('does not flag a published barrel with many exports', () => {
    const { offenders } = scanPackage('client.ts', `
      export class Foo {}
      export class Bar {}
      export interface IBaz { x: number; }
    `, { name: 'pkg', exports: { '.': { types: './dist/client.d.ts', default: './dist/client.js' } } });
    expect(offenders).toEqual([]);
  });

  it('does not flag a function/type-only utility file with no class or interface', () => {
    const { offenders } = scanPackage('union-to-intersection.ts', `
      export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
      export function identity<T>(x: T): T { return x; }
    `);
    expect(offenders).toEqual([]);
  });

  it('counts an anonymous default-exported class correctly', () => {
    const { offenders } = scanPackage('default-class.ts', `
      export interface IFoo { x: number; }
      export default class { run(): void {} }
    `);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].exports).toEqual(expect.arrayContaining([
      { kind: 'interface', name: 'IFoo' },
      { kind: 'class', name: '(default)' },
    ]));
  });

  it('counts a class expression assigned to a const correctly', () => {
    const { offenders } = scanPackage('widget.ts', `
      export const Widget = class Inner { run(): void {} };
      export function helper(): void {}
    `);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].exports).toEqual(expect.arrayContaining([
      { kind: 'class', name: 'Widget' },
      { kind: 'function', name: 'helper' },
    ]));
  });

  it('reports a file that fails to parse as unparseable, not as clean', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'single-export-module-guard-'));
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'pkg' }), 'utf8');
    writeFileSync(path.join(dir, 'src', 'broken.ts'), 'export class Foo { broken(: void {} }', 'utf8');
    const { offenders, unparseable } = SingleExportModuleGuard.scan([{ area: 'test', dir }]);
    expect(offenders).toEqual([]);
    expect(unparseable).toHaveLength(1);
  });
});
