import { describe, expect, it } from 'vitest';
import { TyporSyntaxPlugin } from '../tsmi-syntax-plugin';

const IMPORT = "import { Typor } from '@fromcode119/typescript-multiple-inheritance'; ";

describe('TyporSyntaxPlugin.transform', () => {
  it('rewrites a class with several bases into one mixin', () => {
    expect(TyporSyntaxPlugin.transform('class A extends B, C { x = 1; }'))
      .toBe(`${IMPORT}class A extends Typor.mixin(B, C) { x = 1; }`);
  });

  it('leaves a single base whose type argument holds an arrow function untouched', () => {
    const source = 'class A extends B<{ onChanged: () => Promise<void> | void; }> { run(a, b) { return a + b; } }';
    expect(TyporSyntaxPlugin.transform(source)).toBe(source);
  });

  it('keeps the class body out of the bases when a base type holds an arrow', () => {
    const source = 'export class A extends Base<{ f: () => void }>, Mixin<X, Y> { m(a, b) { return (c) => c; } }';
    expect(TyporSyntaxPlugin.transform(source))
      .toBe(`${IMPORT}export class A extends Typor.mixin(Base<{ f: () => void }>, Mixin<X, Y>) { m(a, b) { return (c) => c; } }`);
  });

  it('splits bases at top-level commas only, past an arrow in a type argument', () => {
    expect(TyporSyntaxPlugin.transform('class A extends B<(x: number) => string>, C {}'))
      .toBe(`${IMPORT}class A extends Typor.mixin(B<(x: number) => string>, C) {}`);
  });
});
