import { describe, expect, it } from 'vitest';
import { OopGuardPatterns } from '../src/oop-guard-rules/oop-guard-patterns';

// The "never beside a class" rule used the exported-only patterns, so a module-private contract above a
// class passed every guard (storefront-document-cache.ts held `interface IStoredDocument` that way).
const names = (re: RegExp, src: string): string[] => [...src.matchAll(re)].map((m) => m[1]);

describe('contract-beside-a-class patterns', () => {
  it('see a module-private interface as well as an exported one', () => {
    const src = 'interface IStoredDocument {\n  body: Uint8Array;\n}\nexport interface IOther { a: string }\nexport class Cache {}\n';
    expect(names(OopGuardPatterns.ANY_INTERFACE_DECL, src)).toEqual(['IStoredDocument', 'IOther']);
  });

  it('see module-private and exported type aliases, generic ones included', () => {
    const src = 'type LoadResult = { contents: string } | undefined;\nexport type Box<T> = { value: T };\nexport class X {}\n';
    expect(names(OopGuardPatterns.ANY_TYPE_ALIAS, src)).toEqual(['LoadResult', 'Box']);
  });

  it('leave a global augmentation alone (indented inside declare global)', () => {
    const src = 'declare global {\n  interface Window { fc: unknown }\n}\nexport class X {}\n';
    expect(names(OopGuardPatterns.ANY_INTERFACE_DECL, src)).toEqual([]);
  });

  it('do not mistake a re-export for a declaration', () => {
    const src = "export type { IFoo } from './foo';\nexport class X {}\n";
    expect(names(OopGuardPatterns.ANY_TYPE_ALIAS, src)).toEqual([]);
  });
});
