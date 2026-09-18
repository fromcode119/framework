import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModuleExportReader } from '../src/module-export-reader';

describe('ModuleExportReader', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const write = (fileName: string, source: string): string => {
    dir = mkdtempSync(path.join(tmpdir(), 'module-export-reader-'));
    const file = path.join(dir, fileName);
    writeFileSync(file, source, 'utf8');
    return file;
  };

  const exportsOf = (fileName: string, source: string) => {
    const file = write(fileName, source);
    const sourceFile = ModuleExportReader.parse(file);
    expect(sourceFile).not.toBeNull();
    return ModuleExportReader.exportsOf(sourceFile!);
  };

  it('reads a single exported class', () => {
    expect(exportsOf('a.ts', 'export class Foo { run(): void {} }')).toEqual([{ kind: 'class', name: 'Foo' }]);
  });

  it('reads a single exported interface', () => {
    expect(exportsOf('a.interface.ts', 'export interface IFoo { run(): void; }')).toEqual([{ kind: 'interface', name: 'IFoo' }]);
  });

  it('counts a class and an interface as two separate exports', () => {
    const exports = exportsOf('a.ts', `
      export interface IFoo { run(): void; }
      export class Foo implements IFoo { run(): void {} }
    `);
    expect(exports).toHaveLength(2);
    expect(exports).toEqual(expect.arrayContaining([
      { kind: 'interface', name: 'IFoo' },
      { kind: 'class', name: 'Foo' },
    ]));
  });

  it('does not count a class declared inside a template literal (codegen scaffolding text)', () => {
    const exports = exportsOf('scaffold.ts', `
      export class ScaffoldFiles {
        static themeBoot(): string {
          return \`
export class ThemeBoot {
  static start(): void {}
}
\`;
        }
      }
    `);
    expect(exports).toEqual([{ kind: 'class', name: 'ScaffoldFiles' }]);
  });

  it('does not count a class mentioned inside a comment', () => {
    const exports = exportsOf('ref.ts', `
      /**
       *   export class Composer extends Reactor {
       *     render() {}
       *   }
       */
      export interface Ref<T> { current: T | null; }
      export function ref(): void {}
    `);
    expect(exports).toEqual(expect.arrayContaining([
      { kind: 'interface', name: 'Ref' },
      { kind: 'function', name: 'ref' },
    ]));
    expect(exports).toHaveLength(2);
  });

  it('counts an anonymous default-exported class', () => {
    expect(exportsOf('a.ts', 'export default class { run(): void {} }')).toEqual([{ kind: 'class', name: '(default)' }]);
  });

  it('counts a class expression assigned to an exported const', () => {
    expect(exportsOf('a.ts', 'export const Widget = class Inner { run(): void {} };')).toEqual([{ kind: 'class', name: 'Widget' }]);
  });

  it('resolves the kind of a local export-list re-export', () => {
    const exports = exportsOf('a.ts', `
      class Foo { run(): void {} }
      function helper(): void {}
      export { Foo, helper };
    `);
    expect(exports).toEqual(expect.arrayContaining([
      { kind: 'class', name: 'Foo' },
      { kind: 'function', name: 'helper' },
    ]));
  });

  it('does not misparse a legacy type assertion in a .ts file as JSX', () => {
    const exports = exportsOf('a.ts', `
      export function identity<T>(x: T): T { return <T>x; }
      export class Trailing { run(): void {} }
    `);
    expect(exports).toEqual(expect.arrayContaining([
      { kind: 'function', name: 'identity' },
      { kind: 'class', name: 'Trailing' },
    ]));
    expect(exports).toHaveLength(2);
  });

  it('returns null for a file that fails to parse cleanly', () => {
    const file = write('broken.ts', 'export class Foo { broken(: void {} }');
    expect(ModuleExportReader.parse(file)).toBeNull();
  });
});
